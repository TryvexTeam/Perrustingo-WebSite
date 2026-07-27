-- ============================================================
-- 012 — DISPONIBILIDAD: lead time, tramos atendidos y cupos
-- ============================================================
-- Contexto (PRP-001 Fase 5): el formulario aceptaba cualquier día futuro y
-- ninguna hora. Nadie controlaba cuántas citas caben a la vez, así que diez
-- personas podían pedir el mismo sábado a la misma hora y el equipo se
-- enteraba después, una por una, por WhatsApp.
--
-- Tres piezas:
--   1. lead time  — cuánta anticipación mínima exige el local
--   2. tramos     — qué horas se atienden cada día de la semana
--   3. capacidad  — cuántas citas caben en paralelo (= peluqueros marcados
--                   en la Fase 1; ver `perfiles.es_peluquero`)

-- ── Configuración general (singleton) ────────────────────────
-- Mismo patrón que `tarifas_extras`: PK booleana forzada a TRUE, así el
-- UPDATE no necesita conocer ningún id.
CREATE TABLE IF NOT EXISTS public.disponibilidad_config (
  singleton           BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  -- Días de anticipación mínima. 0 = se puede pedir para hoy.
  lead_time_dias      INTEGER NOT NULL DEFAULT 1 CHECK (lead_time_dias BETWEEN 0 AND 60),
  -- Largo de cada bloque ofrecido, en minutos.
  duracion_bloque_min INTEGER NOT NULL DEFAULT 60 CHECK (duracion_bloque_min BETWEEN 15 AND 240),
  -- Cuántas citas caben a la misma hora cuando NO hay peluqueros marcados.
  -- Sin esto, un equipo que todavía no marcó a nadie tendría capacidad 0 y
  -- el formulario no ofrecería ni un horario: el sistema se cerraría solo
  -- por una casilla sin marcar. Con peluqueros marcados, mandan ellos.
  capacidad_fallback  INTEGER NOT NULL DEFAULT 1 CHECK (capacidad_fallback BETWEEN 1 AND 20),
  -- ¿Una solicitud sin confirmar ocupa cupo?
  -- La regla de Rodolfo es que 'pendiente' NO bloquea la AGENDA pública
  -- (vista `agenda_ocupada`, que no se toca acá). Pero para los CUPOS es
  -- distinto: si no ocupa, veinte personas pueden pedir la misma hora y el
  -- equipo tiene que rechazar diecinueve a mano. Por defecto ocupa, y el
  -- admin puede apagarlo si prefiere sobrevender y filtrar después.
  pendiente_ocupa     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.disponibilidad_config (singleton) VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

-- ── Tramos atendidos por día de la semana ────────────────────
-- Un día puede tener varios tramos (mañana y tarde con colación en medio).
CREATE TABLE IF NOT EXISTS public.disponibilidad_tramos (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  -- 0 = domingo … 6 = sábado (igual que `EXTRACT(DOW)` y `Date.getDay()`,
  -- para no traducir en cada capa).
  dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin    TIME NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (hora_fin > hora_inicio)
);

-- Seed: lunes a sábado 9:00–19:00, que es el horario que hoy está fijo en
-- `lib/agenda.ts` (HORA_APERTURA/HORA_CIERRE, DIAS_SEMANA lun–sáb). Domingo
-- queda fuera, como hoy. Nada cambia hasta que el admin lo edite.
INSERT INTO public.disponibilidad_tramos (dia_semana, hora_inicio, hora_fin)
SELECT dia, TIME '09:00', TIME '19:00'
FROM generate_series(1, 6) AS dia
WHERE NOT EXISTS (SELECT 1 FROM public.disponibilidad_tramos);

ALTER TABLE public.disponibilidad_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidad_tramos ENABLE ROW LEVEL SECURITY;

-- Lectura pública: el formulario cotiza y ofrece horarios a visitantes sin
-- sesión, así que necesita saber qué se atiende y con cuánta anticipación.
CREATE POLICY "disponibilidad_config_publica" ON public.disponibilidad_config
  FOR SELECT USING (TRUE);
CREATE POLICY "disponibilidad_tramos_publicos" ON public.disponibilidad_tramos
  FOR SELECT USING (TRUE);

CREATE POLICY "admin_edita_disponibilidad_config" ON public.disponibilidad_config
  FOR ALL USING (public.get_rol() = 'admin') WITH CHECK (public.get_rol() = 'admin');
CREATE POLICY "admin_edita_disponibilidad_tramos" ON public.disponibilidad_tramos
  FOR ALL USING (public.get_rol() = 'admin') WITH CHECK (public.get_rol() = 'admin');

GRANT SELECT ON public.disponibilidad_config TO anon;
GRANT SELECT, UPDATE ON public.disponibilidad_config TO authenticated;
GRANT SELECT ON public.disponibilidad_tramos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disponibilidad_tramos TO authenticated;

-- ── Cuántos atienden en paralelo ─────────────────────────────
-- Cuenta los peluqueros marcados en la Fase 1. Es SECURITY DEFINER porque
-- un visitante anónimo NO puede leer `perfiles` (ni debe), pero sí necesita
-- saber cuántos cupos hay por hora. Devuelve un número, nunca datos de
-- personas.
CREATE OR REPLACE FUNCTION public.capacidad_paralela()
RETURNS INTEGER AS $$
  SELECT GREATEST(
    (SELECT count(*)::int FROM public.perfiles WHERE es_peluquero),
    (SELECT capacidad_fallback FROM public.disponibilidad_config WHERE singleton)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER FUNCTION public.capacidad_paralela() SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION public.capacidad_paralela() TO anon, authenticated;

-- ── Ocupación por bloque ─────────────────────────────────────
-- Cuántas citas hay en cada instante de inicio dentro de un rango. También
-- SECURITY DEFINER: expone SOLO (inicio, cantidad) — ni nombres, ni
-- teléfonos, ni servicios. Con eso el formulario puede tachar horarios
-- llenos sin filtrar quién reservó.
CREATE OR REPLACE FUNCTION public.ocupacion_por_bloque(desde TIMESTAMPTZ, hasta TIMESTAMPTZ)
RETURNS TABLE (inicio TIMESTAMPTZ, cantidad INTEGER) AS $$
  SELECT s.fecha_cita, count(*)::int
  FROM public.sesiones s, public.disponibilidad_config c
  WHERE c.singleton
    AND s.fecha_cita >= desde
    AND s.fecha_cita <  hasta
    AND (
      s.estado IN ('confirmada', 'en_proceso')
      OR (c.pendiente_ocupa AND s.estado = 'pendiente')
    )
  GROUP BY s.fecha_cita;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER FUNCTION public.ocupacion_por_bloque(TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION public.ocupacion_por_bloque(TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;

-- Índice para que el conteo por bloque no recorra la tabla entera cuando
-- haya años de citas (ya existe idx_sesiones_fecha sobre fecha_cita).

-- Verificación post-aplicación (correr a mano):
-- SELECT * FROM public.disponibilidad_config;                       -- 1 fila
-- SELECT dia_semana, hora_inicio, hora_fin FROM public.disponibilidad_tramos ORDER BY 1;  -- 6 filas (lun-sáb)
-- SELECT public.capacidad_paralela();                               -- ≥ 1 siempre
