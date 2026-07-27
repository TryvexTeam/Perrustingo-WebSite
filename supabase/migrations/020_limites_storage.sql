-- ============================================================
-- 020 — Límites y limpieza en Storage
-- ============================================================
-- Contexto (PRP-004 F4). Dos problemas, verificados el 26-jul:
--
-- 1. El bucket `reservas` **no tiene policy de DELETE**. Solo SELECT e
--    INSERT. Es decir: nadie —ni el dueño de la foto, ni un admin— puede
--    borrar un objeto con la clave pública. Lo comprobé al intentar limpiar
--    una foto de prueba: 403 Access denied, y hubo que borrarla a mano
--    desde el panel de Supabase.
--    Consecuencia: la retención de 12 meses que promete el PRP-002 **no
--    podría borrar nada**. Sería una promesa falsa.
--
-- 2. No hay tope de tamaño ni de tipo. Con el bucket abierto a cualquiera
--    con cuenta, se puede subir un video de 500 MB y agotar el
--    almacenamiento del plan gratuito (1 GB) de una sentada.

-- ── Poder borrar ─────────────────────────────────────────────
-- El equipo puede borrar cualquier foto (es quien limpia y quien maneja la
-- evidencia). El dueño puede borrar las suyas: subió una foto equivocada y
-- debe poder deshacerlo sin pedir permiso.
DROP POLICY IF EXISTS "reservas_borra_equipo" ON storage.objects;
CREATE POLICY "reservas_borra_equipo" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'reservas' AND public.get_rol() IN ('admin', 'trabajador')
  );

DROP POLICY IF EXISTS "reservas_borra_dueno" ON storage.objects;
CREATE POLICY "reservas_borra_dueno" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'reservas'
    AND auth.uid() IS NOT NULL
    -- Misma regla que la subida: el uid es la primera carpeta de la ruta.
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Tope de tamaño y tipo ────────────────────────────────────
-- Las fotos se comprimen en el navegador a ~200 KB (PRP-002 F1). 2 MB deja
-- margen de sobra para el caso en que el navegador no pueda comprimir y
-- suba el original, y frena en seco a quien intente subir un video.
--
-- Restringir los tipos evita además que el bucket se use para alojar
-- cualquier cosa: es almacenamiento del negocio, no un disco público.
UPDATE storage.buckets
   SET file_size_limit = 2 * 1024 * 1024,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
 WHERE id IN ('reservas', 'promos');

-- Verificación post-aplicación (correr a mano):
-- SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets
--  WHERE id IN ('reservas','promos');
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='storage' AND policyname LIKE 'reservas%';   -- debe incluir 2 DELETE
