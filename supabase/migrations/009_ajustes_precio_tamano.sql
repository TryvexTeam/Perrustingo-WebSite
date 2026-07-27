-- ============================================================
-- 009 — AJUSTES_PRECIO_TAMANO: el costo de cada agregado, por tamaño
-- ============================================================
-- Contexto (PRP-001 Fase 2): hoy un agregado vale lo mismo para todos.
-- `ajustes_precio` (migración 007) guarda UN pct por (categoria, clave) y
-- se aplica igual a un toy que a un gigante. Pero desmotar a un gigante no
-- cuesta el mismo esfuerzo que a un toy, y Rodolfo necesita poder cobrarlo
-- distinto sin pedir código.
--
-- Decisión de modelo: NO se duplica la tabla ni se migran los valores.
-- Esta tabla guarda solo EXCEPCIONES — (categoria, clave, tamano) → pct.
-- Si no hay fila para un tamaño, rige el valor general de `ajustes_precio`.
-- Ventajas frente a "una fila por tamaño para todo":
--   1) Arranca vacía: el comportamiento de hoy no cambia hasta que alguien
--      decida cambiarlo (despliegue sin sorpresas de precio).
--   2) El valor general sigue siendo uno solo — subirlo para todos es un
--      cambio, no cinco.
--   3) Se ve de un vistazo qué está personalizado y qué hereda.
--
-- Nota de numeración: F1 tomó el 008, así que promos pasa a 010 y
-- disponibilidad a 011.

CREATE TABLE IF NOT EXISTS public.ajustes_precio_tamano (
  categoria  TEXT NOT NULL,
  clave      TEXT NOT NULL,
  tamano     TEXT NOT NULL CHECK (tamano IN ('toy','pequeno','mediano','grande','gigante')),
  pct        NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (categoria, clave, tamano),
  -- Un override sin ajuste padre sería un precio fantasma: no lo aplicaría
  -- nadie y nadie sabría por qué. ON DELETE CASCADE para que borrar un
  -- ajuste se lleve sus excepciones.
  FOREIGN KEY (categoria, clave)
    REFERENCES public.ajustes_precio (categoria, clave) ON DELETE CASCADE
);

ALTER TABLE public.ajustes_precio_tamano ENABLE ROW LEVEL SECURITY;

-- Lectura pública: el formulario cotiza para visitantes anónimos y necesita
-- el pct efectivo del tamaño del perro. Mismo criterio que `tarifas`.
CREATE POLICY "ajustes_tamano_publicos" ON public.ajustes_precio_tamano
  FOR SELECT USING (TRUE);

CREATE POLICY "admin_edita_ajustes_tamano" ON public.ajustes_precio_tamano
  FOR ALL USING (public.get_rol() = 'admin')
  WITH CHECK (public.get_rol() = 'admin');

-- GRANT explícito — ley del proyecto: política sin grant = 42501 mudo, y
-- el GRANT ON ALL TABLES de schema.sql es un snapshot que no alcanza a las
-- tablas creadas después.
GRANT SELECT ON public.ajustes_precio_tamano TO anon;
-- INSERT y DELETE sí van acá (a diferencia de `ajustes_precio`): un
-- override se crea y se borra por diseño — borrarlo ES la forma de decir
-- "este tamaño vuelve a usar el valor general". La policy de arriba deja
-- que solo un admin lo haga.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ajustes_precio_tamano TO authenticated;

-- Verificación post-aplicación (correr a mano):
-- SELECT count(*) FROM public.ajustes_precio_tamano;  -- 0: arranca vacía
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='ajustes_precio_tamano';
