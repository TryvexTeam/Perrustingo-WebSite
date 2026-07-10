-- ============================================================
-- Perrustingo — Migración 003: storage de promos + realtime
-- Ejecutar DESPUÉS de 002 en Supabase → SQL Editor.
-- ============================================================

-- Bucket público para las imágenes de anuncios subidas desde el dashboard
INSERT INTO storage.buckets (id, name, public)
VALUES ('promos', 'promos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Cualquiera puede VER las imágenes (bucket público)
CREATE POLICY "promos_lectura_publica" ON storage.objects
  FOR SELECT USING (bucket_id = 'promos');

-- Solo el equipo sube/reemplaza/borra
CREATE POLICY "promos_sube_equipo" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'promos' AND public.get_rol() IN ('admin', 'trabajador')
  );

CREATE POLICY "promos_edita_equipo" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'promos' AND public.get_rol() IN ('admin', 'trabajador')
  );

CREATE POLICY "promos_borra_equipo" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'promos' AND public.get_rol() IN ('admin', 'trabajador')
  );

-- Realtime: la sección "Datos reales en vivo" del dashboard escucha
-- cambios de `sesiones`.
ALTER PUBLICATION supabase_realtime ADD TABLE public.sesiones;
