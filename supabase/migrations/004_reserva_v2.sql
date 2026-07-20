-- ============================================================
-- Perrustingo — Migración 004: reserva v2 (feedback Rodolfo 19-jul)
-- Ejecutar DESPUÉS de 002 y 003 en Supabase → SQL Editor.
-- ============================================================

-- ── 1. Perfiles: apellido y comuna (registro obligatorio pide
--       nombre y apellido, comuna, teléfono, email) ───────────
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS apellido TEXT,
  ADD COLUMN IF NOT EXISTS comuna   TEXT;

-- El trigger de alta copia los campos nuevos desde el metadata del signup
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

-- ── 2. Fotos: tipo 'referencia' (imagen del corte deseado) ───
ALTER TABLE public.fotos_sesion DROP CONSTRAINT IF EXISTS fotos_sesion_tipo_check;
ALTER TABLE public.fotos_sesion
  ADD CONSTRAINT fotos_sesion_tipo_check
  CHECK (tipo IN ('antes','durante','despues','referencia'));

-- El cliente adjunta sus fotos al reservar (RLS: solo a sesiones suyas)
CREATE POLICY "cliente_adjunta_fotos" ON public.fotos_sesion
  FOR INSERT
  WITH CHECK (
    sesion_id IN (SELECT id FROM public.sesiones WHERE cliente_id = auth.uid())
  );

-- ── 3. Storage: bucket de fotos de reserva ───────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('reservas', 'reservas', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "reservas_lectura_publica" ON storage.objects
  FOR SELECT USING (bucket_id = 'reservas');

-- Solo usuarios logueados suben, y solo dentro de su carpeta (uid/...)
CREATE POLICY "reservas_sube_dueno" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'reservas'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 4. Regla de Rodolfo: la reserva NO bloquea el calendario
--       hasta que el equipo la confirme (antes 'pendiente'
--       aparecía como ocupado en la agenda pública) ───────────
CREATE OR REPLACE VIEW public.agenda_ocupada AS
  SELECT id, fecha_cita, fecha_fin, servicio, estado
  FROM public.sesiones
  WHERE estado IN ('confirmada', 'en_proceso')
    AND fecha_cita IS NOT NULL;

-- ── 5. Cupones (10% primera cita por registro + cupón de flyer) ──
CREATE TABLE IF NOT EXISTS public.cupones (
  codigo        TEXT PRIMARY KEY,
  descripcion   TEXT,
  descuento_pct INTEGER NOT NULL CHECK (descuento_pct BETWEEN 1 AND 50),
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;

-- Cualquiera valida un cupón activo por código; solo admin los administra
CREATE POLICY "cupones_lectura_publica" ON public.cupones
  FOR SELECT USING (activo = TRUE);

CREATE POLICY "admin_maneja_cupones" ON public.cupones
  FOR ALL USING (public.get_rol() = 'admin');

-- La sesión registra qué descuento se aplicó (informativo; el valor
-- final se confirma en puerta como siempre)
ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS cupon_codigo  TEXT,
  ADD COLUMN IF NOT EXISTS descuento_pct INTEGER DEFAULT 0;

-- Cupón de lanzamiento del flyer (Rodolfo define el % final; 10% provisorio)
INSERT INTO public.cupones (codigo, descripcion, descuento_pct)
VALUES ('LANZAMIENTO', 'Cupón del flyer de lanzamiento', 10)
ON CONFLICT (codigo) DO NOTHING;

-- ── 6. Grants de lo nuevo (política sin grant = 42501) ───────
GRANT SELECT ON public.cupones TO anon, authenticated;
GRANT SELECT ON public.agenda_ocupada TO anon, authenticated;
GRANT INSERT ON public.sesiones TO anon;  -- faltante de 002 (anon solo tenía SELECT)
GRANT INSERT ON public.fotos_sesion TO authenticated;
