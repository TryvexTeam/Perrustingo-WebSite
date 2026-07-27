-- ============================================================
-- 023 — La foto del cliente se guarda aunque reserve sin cuenta
-- ============================================================
-- Hallazgo del 27-jul, probando desde un celular: el señor Ignacio adjuntó
-- una foto, reservó sin cuenta, y la foto NO quedó en ninguna parte. La
-- reserva se creó, el panel no mostró nada, y en toda la base había 0 filas
-- en fotos_sesion.
--
-- La causa: la policy de subida (migración 004) exige que la primera carpeta
-- de la ruta sea el uid del usuario. Sin sesión no hay uid, la subida se
-- rechaza, y el código —que trata la foto como "falla suave" para no botar
-- la reserva— la descarta sin decir nada.
--
-- El costo real: reservar sin cuenta es el camino normal (decisión del señor
-- Ignacio en PRP-003). Es decir, la foto del "antes" no llegaba casi nunca.
--
-- La contrapartida asumida: esto abre la subida a quien no tiene cuenta. Se
-- acota con lo que ya existe —2 MB por archivo y solo imágenes (migración
-- 020), rate limit por IP y teléfono (016)— más una carpeta propia que
-- permite distinguir y limpiar lo anónimo sin tocar lo demás.

-- ── Subir sin cuenta, en su propia carpeta ───────────────────
-- `anon/` y no la raíz: así se sabe de un vistazo qué entró sin sesión, la
-- retención puede tratarlo aparte, y nadie puede escribir dentro de la
-- carpeta de un usuario real.
DROP POLICY IF EXISTS "reservas_sube_visitante" ON storage.objects;
CREATE POLICY "reservas_sube_visitante" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'reservas'
    AND (storage.foldername(name))[1] = 'anon'
    -- Dos niveles exactos: anon/<algo>. Sin esto se podrían crear
    -- estructuras anidadas arbitrarias dentro de anon/.
    AND array_length(storage.foldername(name), 1) = 2
  );

-- NO se les da SELECT ni DELETE. Un visitante sube su foto y ya: no puede
-- mirar lo que subieron otros ni borrar nada. Leerlas es cosa del equipo,
-- que ya tiene su policy de SELECT (migración 022).

-- ── La fila en fotos_sesion ──────────────────────────────────
-- La cita sin cuenta la crea el servidor (service role), así que la fila de
-- la foto también entra por ahí y no necesita policy nueva. Lo que sí hacía
-- falta: que `anon` pueda insertar cuando la reserva viaja sin sesión.
GRANT INSERT ON public.fotos_sesion TO anon;

DROP POLICY IF EXISTS "visitante_adjunta_fotos" ON public.fotos_sesion;
CREATE POLICY "visitante_adjunta_fotos" ON public.fotos_sesion
  FOR INSERT TO anon
  WITH CHECK (
    -- Solo fotos que el cliente adjunta al reservar, y solo apuntando a la
    -- carpeta anónima. No puede inventar filas sobre archivos del equipo.
    tipo IN ('antes', 'referencia')
    AND ruta IS NOT NULL
    AND ruta LIKE 'anon/%'
  );

-- Verificación post-aplicación (correr a mano):
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='storage' AND policyname LIKE 'reservas%' ORDER BY cmd;
--   -> INSERT: reservas_sube_dueno + reservas_sube_visitante
