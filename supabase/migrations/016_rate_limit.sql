-- ============================================================
-- 016 — RATE LIMIT que funcione en producción
-- ============================================================
-- Contexto (PRP-004 F1): el límite del endpoint de reservas era un `Map` en
-- memoria del proceso. En Vercel cada petición puede caer en una instancia
-- distinta, y cada una tiene su propio contador: el límite real no era "8
-- cada 10 minutos" sino "8 × instancias activas", y se reiniciaba en cada
-- despliegue o arranque en frío.
--
-- Medido en la auditoría del 26-jul: 14 intentos seguidos → 8 aceptadas.
-- Ocho reservas falsas bastan para llenar un día entero de agenda (10
-- bloques, capacidad 1). El daño no es técnico, es comercial: el equipo
-- llega el lunes con la agenda tomada por citas que nadie va a pagar.
--
-- El contador tiene que vivir donde todas las instancias lo vean: acá.

CREATE TABLE IF NOT EXISTS public.rate_limit (
  -- Clave opaca: un HMAC de lo que se limita (IP, teléfono), nunca el dato
  -- en claro. Así esta tabla no es un registro de quién entró al sitio ni
  -- desde dónde — solo un contador.
  clave          TEXT PRIMARY KEY,
  ventana_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contador       INTEGER NOT NULL DEFAULT 1
);

-- Para poder barrer lo vencido sin recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS idx_rate_limit_ventana ON public.rate_limit(ventana_inicio);

ALTER TABLE public.rate_limit ENABLE ROW LEVEL SECURITY;
-- Sin policies: nadie lee ni escribe esta tabla directamente. El único
-- camino es la función de abajo, que es SECURITY DEFINER.

REVOKE ALL ON public.rate_limit FROM anon, authenticated;

-- ── El contador ──────────────────────────────────────────────
-- Atómico por diseño: `INSERT ... ON CONFLICT DO UPDATE` toma el lock de la
-- fila, así que dos peticiones simultáneas no pueden leer el mismo valor y
-- pisarse. Un contador hecho con SELECT + UPDATE por separado deja pasar de
-- a dos justo cuando más importa (un ataque son muchas peticiones a la vez).
CREATE OR REPLACE FUNCTION public.consumir_rate_limit(
  p_clave       TEXT,
  p_max         INTEGER,
  p_ventana_seg INTEGER
)
RETURNS TABLE (permitido BOOLEAN, restantes INTEGER, reinicia_en INTEGER) AS $$
DECLARE
  v_contador INTEGER;
  v_inicio   TIMESTAMPTZ;
BEGIN
  IF p_clave IS NULL OR length(p_clave) < 16 THEN
    -- Una clave corta o vacía sería un contador compartido por todos: el
    -- primero que llegue quemaría el límite del resto. Mejor rechazar.
    RAISE EXCEPTION 'Clave de rate limit inválida' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rate_limit AS rl (clave, ventana_inicio, contador)
  VALUES (p_clave, NOW(), 1)
  ON CONFLICT (clave) DO UPDATE
    SET contador = CASE
          WHEN rl.ventana_inicio < NOW() - make_interval(secs => p_ventana_seg)
            THEN 1                      -- ventana vencida: empieza de nuevo
            ELSE rl.contador + 1
          END,
        ventana_inicio = CASE
          WHEN rl.ventana_inicio < NOW() - make_interval(secs => p_ventana_seg)
            THEN NOW()
            ELSE rl.ventana_inicio
          END
  RETURNING rl.contador, rl.ventana_inicio INTO v_contador, v_inicio;

  -- Barrido oportunista: una de cada cien llamadas limpia lo vencido hace
  -- rato. Hacerlo en cada petición sería pagar el costo siempre; dejarlo
  -- para un cron es una pieza más que puede fallar en silencio.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit WHERE ventana_inicio < NOW() - INTERVAL '1 day';
  END IF;

  RETURN QUERY SELECT
    v_contador <= p_max,
    GREATEST(0, p_max - v_contador),
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_inicio + make_interval(secs => p_ventana_seg) - NOW())))::INTEGER);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.consumir_rate_limit(TEXT, INTEGER, INTEGER)
  SET search_path = public, pg_temp;

-- `anon` puede ejecutarla porque el endpoint público corre con esa clave.
-- El riesgo de que alguien la llame directo para quemar el límite ajeno se
-- cierra con la clave: es un HMAC con un secreto del servidor, así que sin
-- ese secreto no se puede fabricar la clave de otra persona (ver
-- lib/rateLimit.ts). Y la función solo suma: no lee, no resetea, no
-- devuelve nada de quien está detrás de la clave.
GRANT EXECUTE ON FUNCTION public.consumir_rate_limit(TEXT, INTEGER, INTEGER)
  TO anon, authenticated;

-- Verificación post-aplicación (correr a mano):
-- SELECT * FROM public.consumir_rate_limit('clave-de-prueba-larga-0001', 3, 60);  -- permitido=true
-- (repetir 4 veces → la cuarta debe devolver permitido=false)
