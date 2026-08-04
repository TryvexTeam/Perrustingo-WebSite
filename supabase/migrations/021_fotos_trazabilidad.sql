-- ============================================================
-- 021 — Quién subió cada foto (PRP-002 F3)
-- ============================================================
-- Las fotos del antes y el después existen para respaldar al equipo ante un
-- reclamo. Una imagen suelta no es respaldo: hay que poder decir quién la
-- tomó y cuándo. `created_at` ya estaba; faltaba la persona.
--
-- Verificado antes de escribir esto (26-jul): fotos_sesion tiene
-- created_at, id, notas, sesion_id, tipo, url — y nada más.

ALTER TABLE public.fotos_sesion
  ADD COLUMN IF NOT EXISTS subida_por UUID
  -- SET NULL y no CASCADE: si mañana se borra la cuenta de un peluquero que
  -- ya no trabaja en el local, la evidencia de esas visitas NO se puede ir
  -- con él. Misma decisión que en la migración 019 con las fichas.
  REFERENCES public.perfiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.fotos_sesion.subida_por IS
  'Quién subió la foto. NULL = la subió el cliente al reservar, o la cuenta de quien la subió ya no existe.';

-- Las fotos del "después" se listan por cita y se ordenan por fecha. Sin
-- índice, cada ficha abierta hace un recorrido completo de la tabla.
CREATE INDEX IF NOT EXISTS fotos_sesion_sesion_idx
  ON public.fotos_sesion (sesion_id, created_at DESC);

-- Verificación post-aplicación (correr a mano):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='fotos_sesion' AND column_name='subida_por';   -- 1 fila
