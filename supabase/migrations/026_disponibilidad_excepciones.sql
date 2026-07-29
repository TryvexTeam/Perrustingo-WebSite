-- ============================================================
-- 026 — EXCEPCIONES POR FECHA: días libres que se ven como "sin cupo"
-- ============================================================
-- Contexto (reunión con Rodolfo, 27-jul): los tramos de la migración 012
-- son SEMANALES ("todos los martes 9-19"). No había forma de cerrar UNA
-- fecha puntual: para tomarse el martes 12 había que desactivar todos los
-- martes, y eso también cerraba los demás.
--
-- Y una regla de negocio explícita del cliente: el día libre NO se anuncia
-- como "cerrado". Se muestra como si los cupos se hubieran agotado, para no
-- proyectar que el local no está trabajando. Por eso hay dos textos por
-- fecha y viven separados:
--
--   mensaje       — lo que LEE EL CLIENTE ("No quedan cupos para este día")
--   nota_interna  — por qué lo cerró Rodolfo ("vacaciones", "hora médico").
--                   NUNCA sale al público: es el motivo real, y filtrarlo
--                   desarma justamente lo que la regla busca esconder.

-- ── Texto por defecto, editable desde el panel ───────────────
-- Sin esto Rodolfo tendría que escribir el mismo mensaje en cada fecha.
ALTER TABLE public.disponibilidad_config
  ADD COLUMN IF NOT EXISTS mensaje_dia_lleno TEXT NOT NULL
  DEFAULT 'Los cupos de este día ya están tomados. Pruebe con otra fecha 🐾';

-- ── Fechas bloqueadas ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disponibilidad_excepciones (
  -- La fecha ES la clave: una fecha se bloquea una sola vez. Un id suelto
  -- permitiría dos filas para el mismo día con mensajes distintos y habría
  -- que decidir cuál gana.
  fecha        DATE PRIMARY KEY,
  -- NULL = usar `mensaje_dia_lleno` de la config. Así cambiar el texto
  -- general no obliga a reeditar fecha por fecha.
  mensaje      TEXT CHECK (mensaje IS NULL OR length(trim(mensaje)) BETWEEN 1 AND 200),
  nota_interna TEXT CHECK (nota_interna IS NULL OR length(nota_interna) <= 200),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.disponibilidad_excepciones ENABLE ROW LEVEL SECURITY;

-- Solo el admin toca esta tabla, y solo el admin la LEE directamente.
-- Deliberadamente NO hay política de lectura pública: la tabla contiene
-- `nota_interna`. El formulario público no lee la tabla — usa la función
-- de abajo, que devuelve únicamente (fecha, mensaje).
CREATE POLICY "admin_maneja_excepciones" ON public.disponibilidad_excepciones
  FOR ALL USING (public.get_rol() = 'admin') WITH CHECK (public.get_rol() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disponibilidad_excepciones TO authenticated;

-- ── Lectura pública, acotada ─────────────────────────────────
-- Mismo patrón que `ocupacion_por_bloque` (012): SECURITY DEFINER para que
-- un visitante sin sesión pueda saber que un día no tiene cupo, exponiendo
-- solo lo justo. El motivo real de Rodolfo no cruza esta frontera.
CREATE OR REPLACE FUNCTION public.excepciones_en_rango(desde DATE, hasta DATE)
RETURNS TABLE (fecha DATE, mensaje TEXT) AS $$
  SELECT e.fecha,
         COALESCE(NULLIF(trim(e.mensaje), ''), c.mensaje_dia_lleno)
  FROM public.disponibilidad_excepciones e, public.disponibilidad_config c
  WHERE c.singleton
    AND e.fecha >= desde
    AND e.fecha <= hasta;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER FUNCTION public.excepciones_en_rango(DATE, DATE) SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION public.excepciones_en_rango(DATE, DATE) TO anon, authenticated;

-- Verificación post-aplicación (correr a mano):
-- SELECT mensaje_dia_lleno FROM public.disponibilidad_config;        -- texto por defecto
-- INSERT INTO public.disponibilidad_excepciones (fecha, nota_interna)
--   VALUES (CURRENT_DATE + 7, 'prueba');
-- SELECT * FROM public.excepciones_en_rango(CURRENT_DATE, CURRENT_DATE + 30);
--   -- devuelve (fecha, mensaje) — SIN nota_interna
-- DELETE FROM public.disponibilidad_excepciones WHERE nota_interna = 'prueba';
