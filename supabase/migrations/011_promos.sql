-- ============================================================
-- 011 — PROMOS: los anuncios de la landing salen de localStorage
-- ============================================================
-- Contexto (PRP-001 Fase 3): `lib/promos.ts` guardaba la distribución de
-- anuncios en `localStorage`. Eso significa que cada navegador veía algo
-- distinto: Rodolfo movía un anuncio en su teléfono y en el computador del
-- local (y para los clientes) seguía como antes. No era una preferencia de
-- usuario, era la configuración del sitio guardada en el lugar equivocado.
--
-- Además, los 4 anuncios estaban fijos en el código: el admin podía
-- cambiarles la imagen, pero no crear uno nuevo ni borrar uno viejo sin
-- pedir un despliegue. Con tabla propia, sí.

CREATE TABLE IF NOT EXISTS public.promos (
  id         TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  img        TEXT NOT NULL,
  -- `alt` no es opcional: un banner sin texto alternativo es invisible para
  -- quien usa lector de pantalla, y estos anuncios llevan información real
  -- (servicios que vienen), no decoración.
  alt        TEXT NOT NULL,
  vertical   BOOLEAN NOT NULL DEFAULT TRUE,
  slot       TEXT NOT NULL DEFAULT 'oculto'
             CHECK (slot IN ('tras-servicios','tras-resenas','tras-tamanos','pre-footer','oculto')),
  -- Orden dentro de su slot. Con dos anuncios en la misma posición, decide
  -- cuál va primero; sin esto el orden lo elegiría la base de datos.
  orden      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: exactamente los 4 anuncios y las posiciones que hoy están en el
-- código (PROMOS_DEFAULT de lib/promos.ts). La landing no debe cambiar de
-- aspecto al migrar — si cambia, es que la migración perdió algo.
INSERT INTO public.promos (id, nombre, img, alt, vertical, slot, orden) VALUES
  ('retiro-entrega', 'Retiro y entrega (próximamente)', '/promos/retiro-entrega.png',
   'Próximamente: servicio de retiro y entrega — vamos por tu peludito, lo consentimos y te lo devolvemos. Seguro, puntual, confiable, fácil y rápido por WhatsApp.',
   TRUE, 'oculto', 0),
  ('internacional', 'Brasil y Alemania (próximamente)', '/promos/internacional.png',
   'Próximamente Perrustingo internacional: Brasil (em breve) y Alemania (bald verfügbar) — nuevos destinos, el mismo amor.',
   FALSE, 'tras-resenas', 0),
  ('domicilio', 'Perrustingo a domicilio (próximamente)', '/promos/domicilio.png',
   'Próximamente: Perrustingo a domicilio — el spa canino hasta tu casa.',
   TRUE, 'tras-servicios', 0),
  ('recomendaciones', 'Recomendaciones de cuidado', '/promos/recomendaciones.png',
   'Próximamente: recomendaciones — consejos, productos y rutinas de cuidado canino.',
   TRUE, 'tras-servicios', 1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;

-- Lectura pública: los anuncios son de la landing, que ve cualquiera sin
-- sesión. Se leen todos (incluidos los 'oculto') porque el filtrado por
-- slot ocurre al renderizar; no hay nada sensible en esta tabla.
CREATE POLICY "promos_lectura_publica" ON public.promos
  FOR SELECT USING (TRUE);

CREATE POLICY "admin_maneja_promos" ON public.promos
  FOR ALL USING (public.get_rol() = 'admin')
  WITH CHECK (public.get_rol() = 'admin');

-- GRANT explícito — ley del proyecto: sin esto la policy muere con 42501 y
-- el GRANT ON ALL TABLES de schema.sql no alcanza a las tablas nuevas.
GRANT SELECT ON public.promos TO anon;
-- INSERT/DELETE incluidos: crear y borrar anuncios es parte de la función
-- (antes exigía un despliegue). La policy de arriba lo limita al admin.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promos TO authenticated;

-- Verificación post-aplicación (correr a mano):
-- SELECT id, slot, orden FROM public.promos ORDER BY slot, orden;  -- 4 filas
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='promos';
