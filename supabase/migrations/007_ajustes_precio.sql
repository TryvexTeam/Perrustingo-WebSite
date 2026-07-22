-- ============================================================
-- 007 — AJUSTES_PRECIO: recargos/descuentos del formulario, hoy
-- fijos en código (lib/reserva.ts), invisibles para Rodolfo.
-- ============================================================
-- Contexto (pedido de señor Adley + revisión de Jarvis 22-jul): solo el
-- precio base por tamaño es editable (tabla `tarifas`, migración 006). El
-- resto — recargo por tipo de pelo, por temperamento, por zona sensible
-- marcada (+ su tope), descuento por cachorro, descuento de primera cita —
-- son constantes de TypeScript. Rodolfo no puede tocarlos sin pedir código.
--
-- Tabla única en vez de 5 sueltas (categoria + clave), con las 4 correcciones
-- que Jarvis marcó antes de que esto se creara:
--   1) La composición aditiva del precio (base * (1 + Σpct/100)) NO cambia
--      acá — esta tabla solo parametriza los valores, lib/reserva.ts sigue
--      sumando igual que hoy.
--   2) El tope de zonas sensibles (hoy MAX_PCT_ZONAS=12 hardcodeado) entra
--      como una fila más, no queda aparte.
--   3) `clave` es la clave de match con el código (tipoPelo, temperamento,
--      etc.) — NUNCA editable desde el panel, ni con bypass del server
--      action: el GRANT de columna más abajo lo impide a nivel de Postgres.
--      Solo `pct`, `etiqueta`, `activo` son editables.
--   4) `activo=false` excluye la fila del cálculo por completo (vía RLS),
--      no es lo mismo que pct=0 — no aparece en el desglose al cliente.
CREATE TABLE public.ajustes_precio (
  categoria  TEXT NOT NULL CHECK (categoria IN ('pelo','temperamento','zona_sensible','cachorro','primera_cita')),
  clave      TEXT NOT NULL,
  etiqueta   TEXT NOT NULL,
  pct        NUMERIC NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (categoria, clave)
);

-- Seed — valores idénticos a los que hoy están hardcodeados en
-- lib/reserva.ts (RECARGOS_PELO, RECARGOS_TEMPERAMENTO, PCT_POR_ZONA,
-- MAX_PCT_ZONAS, DESCUENTO_CACHORRO, DESCUENTO_PRIMERA_CITA). Migrar sin
-- cambiar ni un número — el ajuste lo hace Rodolfo desde el panel después.
INSERT INTO public.ajustes_precio (categoria, clave, etiqueta, pct) VALUES
  ('pelo', 'crespo_motas', 'Pelo con motas', 15),
  ('pelo', 'motas_rastas', 'Motas / rastas', 25),
  ('pelo', 'doble_capa', 'Doble capa', 10),
  ('temperamento', 'no_se_deja', 'No se deja atender', 15),
  ('temperamento', 'complicado', 'Complicado o bravo', 25),
  ('zona_sensible', 'por_zona', 'Zona sensible (cada una)', 3),
  ('zona_sensible', 'tope', 'Tope máximo por zonas sensibles', 12),
  ('cachorro', 'descuento', 'Cachorro en crecimiento', -15),
  ('primera_cita', 'descuento', 'Primera cita con cuenta', -10);

ALTER TABLE public.ajustes_precio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ajustes_precio_publicos" ON public.ajustes_precio
  FOR SELECT USING (activo = TRUE);

CREATE POLICY "admin_edita_ajustes_precio" ON public.ajustes_precio
  FOR ALL USING (public.get_rol() = 'admin');

-- GRANT explícito (patrón ya conocido: sin esto, 42501 en silencio).
GRANT SELECT ON public.ajustes_precio TO anon;
-- GRANT de columna: authenticated puede editar pct/etiqueta/activo, pero
-- NUNCA categoria/clave — así ni un bypass del server action puede tocar
-- la clave de match y hacer desaparecer un recargo en silencio.
GRANT SELECT ON public.ajustes_precio TO authenticated;
GRANT UPDATE (pct, etiqueta, activo, updated_at) ON public.ajustes_precio TO authenticated;
-- REVOKE explícito (catch de Jarvis 22-jul): el GRANT de columna por sí
-- solo no cierra el flanco — sin esto, INSERT+DELETE seguirían permitiendo
-- borrar una fila y recrearla con otra `clave`, logrando el mismo efecto
-- que editarla directamente. Las tablas nuevas no heredan el GRANT
-- ALL TABLES de schema.sql (es un snapshot al momento de correrlo), así
-- que esto es cinturón-y-tirantes, no un fix de un bug ya explotable —
-- pero mejor que quede explícito en el DDL, no implícito en un supuesto.
REVOKE INSERT, DELETE ON public.ajustes_precio FROM authenticated;

-- ============================================================
-- Desglose de precio congelado por reserva (punto 1 de Jarvis)
-- ============================================================
-- `sesiones.precio_final` ya existe pero solo guarda el total — si Rodolfo
-- sube un % después, no hay forma de saber qué ajustes se aplicaron en su
-- momento. Este jsonb congela el desglose línea por línea al momento de
-- la reserva, para que un cambio de tarifa futuro nunca mute una reserva
-- ya hecha.
ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS desglose_precio JSONB;

-- Verificación post-aplicación (comentada, correr a mano si hay dudas):
-- SELECT categoria, clave, pct, activo FROM public.ajustes_precio ORDER BY categoria, clave;  -- 9 filas
-- SELECT column_name FROM information_schema.columns WHERE table_name='sesiones' AND column_name='desglose_precio';
