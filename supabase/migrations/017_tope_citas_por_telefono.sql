-- ============================================================
-- 017 — TOPE de citas activas por teléfono
-- ============================================================
-- Contexto (PRP-004 F2): el rate limit de la F1 frena las ráfagas, pero un
-- atacante paciente rota IPs y espera entre intentos. Lo que de verdad
-- protege la agenda es un techo por persona: nadie necesita tener diez
-- citas abiertas a la vez.
--
-- Decisión del señor Ignacio (26-jul): máximo 4 citas activas por teléfono,
-- configurable desde el panel — un número de negocio no debería exigir un
-- despliegue para cambiarse.
--
-- Va en un TRIGGER y no en el endpoint a propósito: la policy
-- `solicitud_publica_pendiente` permite insertar en `sesiones` desde
-- PostgREST con la clave pública, así que un atacante puede saltarse el
-- endpoint por completo. Un control que vive solo en la aplicación es un
-- control que se puede rodear. Acá no hay vuelta.

ALTER TABLE public.disponibilidad_config
  ADD COLUMN IF NOT EXISTS max_citas_activas_telefono INTEGER NOT NULL DEFAULT 4
  CHECK (max_citas_activas_telefono BETWEEN 0 AND 50);

COMMENT ON COLUMN public.disponibilidad_config.max_citas_activas_telefono IS
  'Citas sin completar que puede tener un mismo teléfono. 0 = sin tope.';

CREATE OR REPLACE FUNCTION public.limita_citas_por_telefono()
RETURNS TRIGGER AS $$
DECLARE
  v_max     INTEGER;
  v_activas INTEGER;
  v_tel     TEXT;
BEGIN
  /* OJO: `telefono_norm` es una columna GENERADA, y Postgres las calcula
     DESPUÉS de los triggers BEFORE — acá `NEW.telefono_norm` siempre llega
     NULL. La primera versión de esta función preguntaba por ella y salía
     sin hacer nada: el trigger existía, aparecía instalado, y no frenaba
     absolutamente nada (cazado el 26-jul probándolo de verdad).
     Se normaliza a mano desde el teléfono en crudo. */
  v_tel := regexp_replace(COALESCE(NEW.contacto_telefono, ''), '\D', '', 'g');
  IF length(v_tel) > 9 AND left(v_tel, 2) = '56' THEN
    v_tel := substr(v_tel, 3);
  END IF;

  -- Sin teléfono no hay a quién contarle las citas (la policy pública lo
  -- exige, pero el equipo sí puede crear filas sin él).
  IF v_tel = '' THEN
    RETURN NEW;
  END IF;

  -- El equipo no tiene tope: si Rodolfo agenda seis citas para un criadero,
  -- es su negocio. El límite existe para el formulario público.
  IF COALESCE(public.get_rol(), '') IN ('admin', 'trabajador') THEN
    RETURN NEW;
  END IF;

  SELECT max_citas_activas_telefono INTO v_max
    FROM public.disponibilidad_config WHERE singleton;

  IF v_max IS NULL OR v_max <= 0 THEN
    RETURN NEW;  -- 0 = el admin desactivó el tope a propósito
  END IF;

  SELECT count(*) INTO v_activas
    FROM public.sesiones
   WHERE telefono_norm = v_tel
     -- "Activa" = todavía ocupa un lugar. Una cita completada o cancelada
     -- ya no cuenta: si contaran, un cliente fiel quedaría bloqueado para
     -- siempre, que es exactamente lo contrario de lo que se busca.
     AND estado IN ('pendiente', 'confirmada', 'en_proceso');

  IF v_activas >= v_max THEN
    RAISE EXCEPTION
      'Ya tiene % citas pendientes con este teléfono. Complete o cancele alguna, o escríbanos por WhatsApp.',
      v_activas
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.limita_citas_por_telefono() SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_limita_citas_por_telefono ON public.sesiones;
CREATE TRIGGER trg_limita_citas_por_telefono
  BEFORE INSERT ON public.sesiones
  FOR EACH ROW EXECUTE FUNCTION public.limita_citas_por_telefono();

-- Verificación post-aplicación (correr a mano):
-- SELECT max_citas_activas_telefono FROM public.disponibilidad_config;  -- 4
-- Insertar 5 solicitudes con el mismo teléfono desde el formulario público:
--   la quinta debe fallar con el mensaje de arriba.
