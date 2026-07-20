-- ============================================================
-- PERRUSTINGO — RUNBOOK ÚNICO 2026-07-20 (idempotente)
-- Un solo paste en SQL Editor de perrustingodatos. Orden:
--   A) migración 002 (reserva pública: columnas + policy + vista)
--   B) migración 003 (storage promos + realtime)
--   C) migración 004 (reserva v2: perfiles, fotos, bucket, cupones)
--   D) fix seguridad: trigger anti-escalada de rol
--   E) restaurar rol admin + limpieza del test del 15-jul
--   F) verificaciones
-- Además (fuera de SQL): Auth → Sign In / Up → APAGAR "Confirm email"
-- ============================================================

-- ── A) 002: solicitudes públicas ─────────────────────────────
ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS contacto_nombre   TEXT,
  ADD COLUMN IF NOT EXISTS contacto_email    TEXT,
  ADD COLUMN IF NOT EXISTS contacto_telefono TEXT,
  ADD COLUMN IF NOT EXISTS detalle_form      JSONB;

DROP POLICY IF EXISTS "solicitud_publica_pendiente" ON public.sesiones;
CREATE POLICY "solicitud_publica_pendiente" ON public.sesiones
  FOR INSERT
  WITH CHECK (
    estado = 'pendiente'
    AND trabajador_id IS NULL
    AND (cliente_id IS NULL OR cliente_id = auth.uid())
    AND contacto_nombre IS NOT NULL
    AND contacto_telefono IS NOT NULL
  );

-- ── B) 003: storage promos + realtime ────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('promos', 'promos', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "promos_lectura_publica" ON storage.objects;
CREATE POLICY "promos_lectura_publica" ON storage.objects
  FOR SELECT USING (bucket_id = 'promos');

DROP POLICY IF EXISTS "promos_sube_equipo" ON storage.objects;
CREATE POLICY "promos_sube_equipo" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'promos' AND public.get_rol() IN ('admin', 'trabajador')
  );

DROP POLICY IF EXISTS "promos_edita_equipo" ON storage.objects;
CREATE POLICY "promos_edita_equipo" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'promos' AND public.get_rol() IN ('admin', 'trabajador')
  );

DROP POLICY IF EXISTS "promos_borra_equipo" ON storage.objects;
CREATE POLICY "promos_borra_equipo" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'promos' AND public.get_rol() IN ('admin', 'trabajador')
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sesiones;
EXCEPTION WHEN duplicate_object THEN
  NULL;  -- ya estaba en la publicación
END $$;

-- ── C) 004: reserva v2 ───────────────────────────────────────
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS apellido TEXT,
  ADD COLUMN IF NOT EXISTS comuna   TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, apellido, comuna, telefono)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nombre',
    NEW.raw_user_meta_data->>'apellido',
    NEW.raw_user_meta_data->>'comuna',
    NEW.raw_user_meta_data->>'telefono'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.fotos_sesion DROP CONSTRAINT IF EXISTS fotos_sesion_tipo_check;
ALTER TABLE public.fotos_sesion
  ADD CONSTRAINT fotos_sesion_tipo_check
  CHECK (tipo IN ('antes','durante','despues','referencia'));

DROP POLICY IF EXISTS "cliente_adjunta_fotos" ON public.fotos_sesion;
CREATE POLICY "cliente_adjunta_fotos" ON public.fotos_sesion
  FOR INSERT
  WITH CHECK (
    sesion_id IN (SELECT id FROM public.sesiones WHERE cliente_id = auth.uid())
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('reservas', 'reservas', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "reservas_lectura_publica" ON storage.objects;
CREATE POLICY "reservas_lectura_publica" ON storage.objects
  FOR SELECT USING (bucket_id = 'reservas');

DROP POLICY IF EXISTS "reservas_sube_dueno" ON storage.objects;
CREATE POLICY "reservas_sube_dueno" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'reservas'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Regla de Rodolfo: pendiente NO bloquea la agenda pública
CREATE OR REPLACE VIEW public.agenda_ocupada AS
  SELECT id, fecha_cita, fecha_fin, servicio, estado
  FROM public.sesiones
  WHERE estado IN ('confirmada', 'en_proceso')
    AND fecha_cita IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cupones (
  codigo        TEXT PRIMARY KEY,
  descripcion   TEXT,
  descuento_pct INTEGER NOT NULL CHECK (descuento_pct BETWEEN 1 AND 50),
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cupones_lectura_publica" ON public.cupones;
CREATE POLICY "cupones_lectura_publica" ON public.cupones
  FOR SELECT USING (activo = TRUE);

DROP POLICY IF EXISTS "admin_maneja_cupones" ON public.cupones;
CREATE POLICY "admin_maneja_cupones" ON public.cupones
  FOR ALL USING (public.get_rol() = 'admin');

ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS cupon_codigo  TEXT,
  ADD COLUMN IF NOT EXISTS descuento_pct INTEGER DEFAULT 0;

INSERT INTO public.cupones (codigo, descripcion, descuento_pct)
VALUES ('LANZAMIENTO', 'Cupón del flyer de lanzamiento', 10)
ON CONFLICT (codigo) DO NOTHING;

-- Grants (política sin grant = 42501)
GRANT SELECT ON public.cupones TO anon, authenticated;
GRANT SELECT ON public.agenda_ocupada TO anon, authenticated;
GRANT INSERT ON public.sesiones TO anon;
GRANT INSERT ON public.fotos_sesion TO authenticated;

-- ── D) Trigger anti-escalada de rol ──────────────────────────
-- (ver triggers previos: SELECT tgname FROM pg_trigger
--  WHERE tgrelid='public.perfiles'::regclass AND NOT tgisinternal;)
DROP TRIGGER IF EXISTS trg_protege_rol ON public.perfiles;
DROP TRIGGER IF EXISTS protege_rol ON public.perfiles;
DROP FUNCTION IF EXISTS public.protege_rol();

CREATE OR REPLACE FUNCTION public.protege_rol()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol
     AND auth.uid() IS NOT NULL
     AND COALESCE(public.get_rol(), '') <> 'admin'
  THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar roles'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_protege_rol
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.protege_rol();

-- Endurecimiento (revisión de Spike): SECURITY DEFINER sin search_path
-- fijo = patrón clásico de schema-hijacking en Postgres.
ALTER FUNCTION public.protege_rol() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_rol() SET search_path = public, pg_temp;

-- ── E) Restaurar admin (el test del 15-jul lo dejó 'trabajador') ──
-- El SQL editor pasa el guard (auth.uid() es NULL ahí).
UPDATE public.perfiles SET rol = 'admin'
WHERE id = '0951870d-0000-0000-0000-000000000000';  -- ⚠️ REEMPLAZAR con el uid completo (ver query de abajo)

-- Para encontrar el uid correcto si hace falta:
-- SELECT id, nombre, rol, created_at FROM public.perfiles ORDER BY created_at;

-- ── F) Verificaciones ────────────────────────────────────────
SELECT 'perfiles admin' AS check, count(*) FROM public.perfiles WHERE rol = 'admin';
SELECT 'columnas sesiones' AS check, count(*) FROM information_schema.columns
  WHERE table_name = 'sesiones'
  AND column_name IN ('contacto_nombre','detalle_form','cupon_codigo');
SELECT 'vista agenda' AS check, count(*) FROM information_schema.views
  WHERE table_name = 'agenda_ocupada';
SELECT 'cupones' AS check, count(*) FROM public.cupones;
SELECT 'trigger rol' AS check, count(*) FROM pg_trigger
  WHERE tgrelid = 'public.perfiles'::regclass AND tgname = 'trg_protege_rol';
