-- ============================================================
-- Perrustingo — Migración 005: auditoría de confirmación de
-- cita + notas del peluquero (historial por perro).
--
-- Ejecutar DESPUÉS de 002, 003 y 004 en Supabase → SQL Editor.
--
-- Nota de coordinación (2026-07-20): esta migración NO toca
-- `cupones` — esa tabla ya la creó y cubrió por completo la
-- migración 004 (rama feat/reserva-v2, Jarvis). Alcance acotado
-- a lo que quedó 100% sin dueño: el audit de confirmación y el
-- historial de notas por perro.
-- ============================================================

-- ============================================================
-- CONFIRMACIÓN DE CITA (auditoría: quién y cuándo)
-- ============================================================
ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS confirmada_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmada_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL;

-- El UPDATE en sí ya está permitido por la policy existente
-- "equipo_ve_todas_sesiones" (FOR ALL, admin/trabajador) y por el
-- chequeo de rol en `cambiarEstadoCita` (app/dashboard/citas/actions.ts).
-- Este trigger solo AUDITA la transición → confirmada; no necesita
-- SECURITY DEFINER porque no hace nada que el llamador no pueda
-- hacer ya (solo completa columnas de la fila que edita).
CREATE OR REPLACE FUNCTION public.registra_confirmacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'confirmada' AND OLD.estado IS DISTINCT FROM 'confirmada' THEN
    NEW.confirmada_at  := NOW();
    NEW.confirmada_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registra_confirmacion ON public.sesiones;
CREATE TRIGGER trg_registra_confirmacion
  BEFORE UPDATE ON public.sesiones
  FOR EACH ROW EXECUTE FUNCTION public.registra_confirmacion();

-- ============================================================
-- NOTAS DEL PELUQUERO (historial por PERRO, no por cita)
--
-- Reemplaza el patrón actual de PanelCita.tsx, que arma un
-- historial "a mano" leyendo `sesiones.notas_equipo` de citas
-- pasadas del mismo perro (funciona, pero se pisa cita a cita y
-- no distingue quién escribió qué). Esta tabla es aditiva: no
-- borra `notas_equipo`, así que no rompe nada en producción — la
-- migración de UI a este repo queda para cuando Jarvis la tome.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notas_perro (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  perro_id    UUID NOT NULL REFERENCES public.perros(id) ON DELETE CASCADE,
  sesion_id   UUID REFERENCES public.sesiones(id) ON DELETE SET NULL,
  autor_id    UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  detalle     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notas_perro ENABLE ROW LEVEL SECURITY;

-- Solo equipo: el brief de Rodolfo dice "tips entre colegas", no
-- menciona al dueño del perro.
CREATE POLICY "equipo_maneja_notas_perro" ON public.notas_perro
  FOR ALL USING (public.get_rol() IN ('admin','trabajador'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_perro TO authenticated;

CREATE INDEX IF NOT EXISTS idx_notas_perro_perro  ON public.notas_perro(perro_id);
CREATE INDEX IF NOT EXISTS idx_notas_perro_sesion ON public.notas_perro(sesion_id);
