-- ============================================================
-- 014 — OFERTAS configurables desde el panel
-- ============================================================
-- Contexto (PRP-003 F2): el incentivo para registrarse estaba escrito en el
-- HTML de app/reserva/page.tsx ("10% de descuento en la primera cita") y el
-- descuento real en `ajustes_precio` ('primera_cita'). Dos lugares para el
-- mismo dato: cambiar el texto sin cambiar el número —o al revés— prometía
-- algo distinto de lo que se cobraba, y ambos exigían un despliegue.
--
-- Ahora la oferta es UNA fila: el texto que ve el cliente y el descuento que
-- se aplica salen del mismo lugar, editable por el admin.

CREATE TABLE IF NOT EXISTS public.ofertas (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo          TEXT NOT NULL,
  detalle         TEXT NOT NULL,

  -- ── Condiciones ────────────────────────────────────────────
  -- El beneficio de tener cuenta solo se otorga a quien la tiene: es el
  -- incentivo para registrarse y lo que hace que no haya nada que
  -- falsificar (decisión del señor Ignacio, 26-jul).
  solo_con_cuenta BOOLEAN NOT NULL DEFAULT TRUE,
  -- Desde qué visita aplica. 1 = primera cita; 2 = "tu segunda cita tiene
  -- descuento". `hasta` NULL = sin tope (aplica de esa visita en adelante).
  desde_visita    INTEGER NOT NULL DEFAULT 1 CHECK (desde_visita >= 1),
  hasta_visita    INTEGER CHECK (hasta_visita IS NULL OR hasta_visita >= desde_visita),

  -- ── Beneficio ──────────────────────────────────────────────
  -- Mismo modelo que `ajustes_precio` (migración 010): porcentaje o monto
  -- fijo en pesos. Se guarda POSITIVO y se aplica como descuento; guardar
  -- "-10" invita a que alguien escriba "10" y termine subiendo el precio.
  tipo            TEXT NOT NULL DEFAULT 'pct' CHECK (tipo IN ('pct','monto')),
  pct             NUMERIC NOT NULL DEFAULT 0 CHECK (pct >= 0 AND pct <= 100),
  monto           INTEGER CHECK (monto IS NULL OR monto >= 0),
  CONSTRAINT ofertas_valor_coherente CHECK (tipo = 'pct' OR monto IS NOT NULL),

  -- ── Vigencia ───────────────────────────────────────────────
  activa          BOOLEAN NOT NULL DEFAULT TRUE,
  vigente_desde   DATE,
  vigente_hasta   DATE,
  CONSTRAINT ofertas_vigencia_coherente
    CHECK (vigente_desde IS NULL OR vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Semilla: exactamente la oferta que hoy está en el HTML y en
-- `ajustes_precio.primera_cita` (10%). Nada cambia de precio al aplicar
-- esta migración; solo pasa a ser editable.
INSERT INTO public.ofertas (titulo, detalle, solo_con_cuenta, desde_visita, hasta_visita, tipo, pct)
SELECT
  'Beneficio de bienvenida',
  '10% de descuento en la primera cita de tu perrito por registrarte.',
  TRUE, 1, 1, 'pct', 10
WHERE NOT EXISTS (SELECT 1 FROM public.ofertas);

ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;

-- Lectura pública: la oferta se muestra a visitantes sin sesión (es el
-- anzuelo para que se registren) y el formulario la usa para cotizar.
CREATE POLICY "ofertas_lectura_publica" ON public.ofertas
  FOR SELECT USING (TRUE);

CREATE POLICY "admin_maneja_ofertas" ON public.ofertas
  FOR ALL USING (public.get_rol() = 'admin')
  WITH CHECK (public.get_rol() = 'admin');

-- GRANT explícito — ley del proyecto: política sin grant = 42501 mudo, y el
-- GRANT ON ALL TABLES de schema.sql no alcanza a las tablas nuevas.
GRANT SELECT ON public.ofertas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ofertas TO authenticated;

-- Qué oferta se aplicó a cada cita. Congela el beneficio: si mañana el
-- admin cambia la oferta, una cita ya tomada no debe mutar.
ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS oferta_id UUID REFERENCES public.ofertas(id) ON DELETE SET NULL;

-- Verificación post-aplicación (correr a mano):
-- SELECT titulo, solo_con_cuenta, desde_visita, hasta_visita, tipo, pct, activa FROM public.ofertas;
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='ofertas';
