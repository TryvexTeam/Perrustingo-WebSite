-- ============================================================
-- 031 — El último cupo no se puede vender dos veces
-- ============================================================
-- Hallazgo de la revisión del 30-jul (anotado como "sin urgencia" y
-- promovido por el señor Adley el mismo día).
--
-- La puerta de disponibilidad del endpoint de reservas mira la ocupación y
-- DESPUÉS inserta. Entre esa mirada y el insert hay un hueco: dos personas
-- pidiendo el último cupo del mismo bloque a la vez pasan ambas la
-- validación — las dos vieron el cupo libre — y las dos reservas entran.
-- Sobre-agenda sin que nadie haga nada mal.
--
-- El cierre correcto vive en la base, no en el código: un trigger BEFORE
-- INSERT que cuenta la ocupación del bloque y rechaza si ya está lleno.
--
-- La pieza clave es el advisory lock. Sin él, el trigger tendría LA MISMA
-- carrera que el código (dos transacciones contando a la vez ven lo mismo):
-- `pg_advisory_xact_lock` serializa a quienes compiten por el MISMO bloque
-- — el segundo espera a que el primero termine su transacción y recién
-- entonces cuenta, ya con la reserva del primero visible. Reservas de
-- bloques distintos no se estorban entre sí.
--
-- Qué NO toca este candado, a propósito:
--   · UPDATEs (el equipo moviendo o confirmando citas): el equipo ve la
--     agenda y decide con criterio; el candado es para el formulario
--     público, que es donde compiten desconocidos.
--   · Citas sin hora (el camino viejo, fecha 00:00): igual que la puerta
--     del endpoint, sin bloque no hay cupo que contar — se cuentan solo
--     contra su instante exacto, que para 00:00 es inofensivo.
--
-- El conteo replica el criterio de `ocupacion_por_bloque`: confirmada y
-- en_proceso siempre ocupan; pendiente ocupa según la configuración.

CREATE OR REPLACE FUNCTION public.candado_cupo_bloque()
RETURNS TRIGGER AS $$
DECLARE
  ocupados INTEGER;
  capacidad INTEGER;
  cuenta_pendiente BOOLEAN;
BEGIN
  -- Solo el nacimiento de una solicitud compite por cupo.
  IF NEW.estado <> 'pendiente' OR NEW.fecha_cita IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serializa a los que pelean por el MISMO bloque. Se libera solo al
  -- terminar la transacción.
  PERFORM pg_advisory_xact_lock(hashtext('cupo:' || NEW.fecha_cita::text));

  SELECT c.pendiente_ocupa INTO cuenta_pendiente
  FROM public.disponibilidad_config c WHERE c.singleton;

  SELECT count(*)::int INTO ocupados
  FROM public.sesiones s
  WHERE s.fecha_cita = NEW.fecha_cita
    AND (
      s.estado IN ('confirmada', 'en_proceso')
      OR (COALESCE(cuenta_pendiente, TRUE) AND s.estado = 'pendiente')
    );

  capacidad := public.capacidad_paralela();

  IF ocupados >= capacidad THEN
    RAISE EXCEPTION 'Ese horario acaba de llenarse. Elija otro bloque.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.candado_cupo_bloque() SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_candado_cupo_bloque ON public.sesiones;
CREATE TRIGGER trg_candado_cupo_bloque
  BEFORE INSERT ON public.sesiones
  FOR EACH ROW EXECUTE FUNCTION public.candado_cupo_bloque();

-- El código ya trata el 23514 como regla de negocio y muestra el mensaje
-- tal cual (app/api/reservas/route.ts, mismo camino que el tope por
-- teléfono de la 017). No hay que tocar nada del lado de la aplicación.

-- Verificación post-aplicación (correr a mano):
-- SELECT tgname FROM pg_trigger
--  WHERE tgrelid = 'public.sesiones'::regclass AND NOT tgisinternal;
--   -> debe incluir trg_candado_cupo_bloque
