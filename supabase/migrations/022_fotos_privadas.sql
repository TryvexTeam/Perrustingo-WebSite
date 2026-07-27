-- ============================================================
-- 022 — Las fotos dejan de ser públicas (PRP-002 F4)
-- ============================================================
-- Hasta acá el bucket `reservas` era público: cualquiera con el enlace veía
-- la foto del perrito de un cliente, sin sesión y sin dejar rastro. Para un
-- catálogo estaría bien; para lo que decidió el señor Ignacio el 26-jul
-- —que las fotos son RESPALDO DE EVIDENCIA del equipo— no.
--
-- Estado verificado antes de escribir esto (27-jul):
--   · fotos_sesion: 0 filas, 0 con URL pública guardada.
--   · bucket reservas: 1 objeto, y es un .emptyFolderPlaceholder de 0 bytes.
-- Es decir: el gotcha que anotaba el PRP ("migrar el bucket rompe las URLs
-- ya guardadas") NO aplica, porque no hay ninguna. Este es exactamente el
-- momento barato para cerrarlo; con mil fotos encima habría sido una
-- migración de datos.

-- ── 1. Guardar la ruta, no la URL ────────────────────────────
-- Una URL pública deja de existir cuando el bucket se cierra. La ruta dentro
-- del bucket sobrevive a cualquier cambio de política y es lo único que se
-- necesita para firmar un enlace temporal.
ALTER TABLE public.fotos_sesion
  ADD COLUMN IF NOT EXISTS ruta TEXT;

COMMENT ON COLUMN public.fotos_sesion.ruta IS
  'Ruta del objeto dentro del bucket `reservas`. Se firma al mostrarla; nunca es un enlace permanente.';

-- `url` queda para las filas viejas (hoy ninguna) y para no romper nada que
-- todavía la lea. Las nuevas guardan `ruta`.
ALTER TABLE public.fotos_sesion
  ALTER COLUMN url DROP NOT NULL;

-- Al menos una de las dos tiene que venir: una fila de foto sin foto es una
-- promesa de evidencia que no existe.
ALTER TABLE public.fotos_sesion
  DROP CONSTRAINT IF EXISTS fotos_sesion_tiene_origen;
ALTER TABLE public.fotos_sesion
  ADD CONSTRAINT fotos_sesion_tiene_origen
  CHECK (ruta IS NOT NULL OR url IS NOT NULL);

-- ── 2. Cerrar la lectura ─────────────────────────────────────
-- Esta era la policy que hacía público el contenido: SELECT para cualquiera,
-- incluido el visitante anónimo.
DROP POLICY IF EXISTS "reservas_lectura_publica" ON storage.objects;

-- El equipo ve todas las fotos: es quien atiende y quien responde un reclamo.
DROP POLICY IF EXISTS "reservas_lee_equipo" ON storage.objects;
CREATE POLICY "reservas_lee_equipo" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'reservas' AND public.get_rol() IN ('admin', 'trabajador')
  );

-- El dueño ve lo suyo. Además de ser razonable, la subida necesita poder
-- consultar el objeto: sin SELECT propio, el upload del cliente se rompe.
DROP POLICY IF EXISTS "reservas_lee_dueno" ON storage.objects;
CREATE POLICY "reservas_lee_dueno" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'reservas'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 3. Borrar es cosa de admin ───────────────────────────────
-- Decisión 3 del PRP-002, del señor Ignacio: "si el equipo pudiera borrar
-- libremente, desaparecería justo la prueba que se necesita".
--
-- Esto corrige la migración 020, donde yo había dado el borrado a
-- admin+trabajador razonando que "el equipo es quien limpia". Con las fotos
-- entendidas como evidencia, ese razonamiento se cae: quien podría querer
-- que una foto desaparezca es precisamente quien atendió esa cita.
DROP POLICY IF EXISTS "reservas_borra_equipo" ON storage.objects;
CREATE POLICY "reservas_borra_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'reservas' AND public.get_rol() = 'admin'
  );

-- Y el dueño tampoco borra: la foto del "antes" es justamente la prueba que
-- un reclamo pondría en duda.
-- Contrapartida asumida: si un cliente sube una foto equivocada, no puede
-- deshacerla; sube otra y el equipo ve las dos. Es el precio de que la
-- evidencia no se pueda hacer desaparecer.
DROP POLICY IF EXISTS "reservas_borra_dueno" ON storage.objects;

-- ── 4. El bucket, privado ────────────────────────────────────
-- `promos` NO se toca: son los anuncios de la portada y tienen que verse sin
-- sesión.
UPDATE storage.buckets SET public = FALSE WHERE id = 'reservas';

-- Verificación post-aplicación (correr a mano):
-- SELECT id, public FROM storage.buckets WHERE id IN ('reservas','promos');
--   -> reservas false, promos true
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='storage' AND policyname LIKE 'reservas%' ORDER BY cmd;
--   -> reservas_borra_admin (DELETE), reservas_sube_dueno (INSERT),
--      reservas_lee_equipo + reservas_lee_dueno (SELECT)
