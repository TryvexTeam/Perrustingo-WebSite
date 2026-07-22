-- ============================================================
-- 006 — TARIFAS_EXTRAS: recargo por motas y precio de accesorio
-- ============================================================
-- Contexto: el panel admin de precios (components/admin/EditorTarifas.tsx)
-- vivía enteramente en localStorage del navegador — nunca se conectó a la
-- tabla `tarifas` que ya existe desde schema.sql. Los cambios de Rodolfo no
-- se veían en otro dispositivo/sesión. `tarifas` cubre el precio base por
-- tamaño; esta migración agrega los dos "Extras" del mismo editor (recargo
-- por motas %, precio del accesorio) que no tenían tabla propia.
--
-- Patrón singleton: una sola fila, PK booleana forzada a TRUE — evita tener
-- que conocer un UUID para hacer UPDATE, y el CHECK impide una segunda fila.
CREATE TABLE public.tarifas_extras (
  singleton         BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  recargo_motas_pct INTEGER NOT NULL DEFAULT 20 CHECK (recargo_motas_pct BETWEEN 0 AND 100),
  precio_accesorio  INTEGER NOT NULL DEFAULT 3000 CHECK (precio_accesorio >= 0),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.tarifas_extras (singleton) VALUES (TRUE);

ALTER TABLE public.tarifas_extras ENABLE ROW LEVEL SECURITY;

-- Mismo patrón que `tarifas`: lectura pública (el form la necesita para
-- cotizar en vivo a un visitante anónimo), edición solo admin.
CREATE POLICY "tarifas_extras_publicas" ON public.tarifas_extras
  FOR SELECT USING (TRUE);

CREATE POLICY "admin_edita_tarifas_extras" ON public.tarifas_extras
  FOR ALL USING (public.get_rol() = 'admin');

-- GRANT explícito — el `GRANT ... ON ALL TABLES` de schema.sql fue un
-- snapshot al momento de correrlo; una tabla creada después NO lo hereda.
-- Sin esto, la policy de arriba muere en silencio con 42501 (ya nos pasó
-- con `sesiones`/anon en F0 — no repetir el mismo error dos veces).
GRANT SELECT ON public.tarifas_extras TO anon;
GRANT SELECT, UPDATE ON public.tarifas_extras TO authenticated;

-- Verificación post-aplicación (comentada, correr a mano si hay dudas):
-- SELECT * FROM public.tarifas_extras;                 -- debe haber 1 fila
-- SELECT * FROM public.tarifas WHERE activo = TRUE;     -- debe haber 5 filas
