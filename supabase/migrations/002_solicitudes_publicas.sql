-- ============================================================
-- Perrustingo — Migración 002: solicitudes de cita públicas
-- Permite que el formulario de reserva cree sesiones 'pendiente'
-- sin cuenta, guardando el contacto y el detalle completo del form.
-- Ejecutar DESPUÉS de schema.sql en Supabase → SQL Editor.
-- ============================================================

-- Contacto del solicitante (para citas sin cuenta) + snapshot del formulario
ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS contacto_nombre   TEXT,
  ADD COLUMN IF NOT EXISTS contacto_email    TEXT,
  ADD COLUMN IF NOT EXISTS contacto_telefono TEXT,
  ADD COLUMN IF NOT EXISTS detalle_form      JSONB;

-- Solicitud pública: cualquiera puede CREAR una cita, pero solo si
-- nace 'pendiente', sin asignaciones y con datos de contacto.
CREATE POLICY "solicitud_publica_pendiente" ON public.sesiones
  FOR INSERT
  WITH CHECK (
    estado = 'pendiente'
    AND trabajador_id IS NULL
    AND (cliente_id IS NULL OR cliente_id = auth.uid())
    AND contacto_nombre IS NOT NULL
    AND contacto_telefono IS NOT NULL
  );

-- La agenda pública muestra SOLO bloques ocupados (sin datos personales):
-- vista segura para usuarios anónimos.
CREATE OR REPLACE VIEW public.agenda_ocupada AS
  SELECT id, fecha_cita, fecha_fin, servicio, estado
  FROM public.sesiones
  WHERE estado IN ('pendiente', 'confirmada', 'en_proceso')
    AND fecha_cita IS NOT NULL;

GRANT SELECT ON public.agenda_ocupada TO anon, authenticated;
