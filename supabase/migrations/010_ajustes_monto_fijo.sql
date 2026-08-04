-- ============================================================
-- 010 — AGREGADOS EN % O EN MONTO FIJO
-- ============================================================
-- Contexto (pedido del señor Ignacio, 26-jul, durante la Fase 2): hasta
-- ahora todo agregado era un porcentaje. El % escala con el tamaño, que es
-- lo correcto cuando el costo es proporcional al trabajo (desmotar), pero
-- miente cuando el costo es real y fijo: un producto especial cuesta lo
-- mismo para un toy que para un gigante, y como % sale 4 veces más caro en
-- el gigante.
--
-- Modelo: se agrega `tipo` + `monto`, y NO se toca `pct`. Las filas
-- existentes quedan en tipo='pct' por el DEFAULT, así que el precio de hoy
-- no cambia con esta migración — un despliegue de precios nunca debe mover
-- números por sí solo.
--
-- Por qué columnas separadas y no reusar `pct` como "valor": una columna
-- llamada pct que a veces guarda pesos es una trampa para el próximo que
-- lea la tabla. El CHECK obliga a que el valor del tipo declarado exista.

-- ── Ajuste general (tabla de la migración 007) ───────────────
ALTER TABLE public.ajustes_precio
  ADD COLUMN IF NOT EXISTS tipo  TEXT NOT NULL DEFAULT 'pct' CHECK (tipo IN ('pct','monto')),
  ADD COLUMN IF NOT EXISTS monto INTEGER;

ALTER TABLE public.ajustes_precio DROP CONSTRAINT IF EXISTS ajustes_precio_valor_coherente;
ALTER TABLE public.ajustes_precio
  ADD CONSTRAINT ajustes_precio_valor_coherente
  CHECK (tipo = 'pct' OR monto IS NOT NULL);

-- El GRANT de columna de 007 (que impide tocar categoria/clave) NO cubre
-- las columnas nuevas: sin esto, guardar el tipo desde el panel muere con
-- 42501 aunque la policy lo permita.
GRANT UPDATE (tipo, monto) ON public.ajustes_precio TO authenticated;

-- ── Excepción por tamaño (tabla de la migración 009) ─────────
ALTER TABLE public.ajustes_precio_tamano
  ADD COLUMN IF NOT EXISTS tipo  TEXT NOT NULL DEFAULT 'pct' CHECK (tipo IN ('pct','monto')),
  ADD COLUMN IF NOT EXISTS monto INTEGER;

ALTER TABLE public.ajustes_precio_tamano DROP CONSTRAINT IF EXISTS ajustes_tamano_valor_coherente;
ALTER TABLE public.ajustes_precio_tamano
  ADD CONSTRAINT ajustes_tamano_valor_coherente
  CHECK (tipo = 'pct' OR monto IS NOT NULL);

-- Nota de alcance (deliberada, no un olvido): `zona_sensible` sigue siendo
-- solo porcentaje. Sus dos filas son "cada zona suma X" y "el tope máximo
-- es Y": si una fuera monto y la otra %, el tope no tendría con qué
-- compararse. Mezclarlas daría un cálculo ambiguo, así que el panel no
-- ofrece el cambio ahí.

-- Verificación post-aplicación (correr a mano):
-- SELECT categoria, clave, tipo, pct, monto FROM public.ajustes_precio ORDER BY 1,2;
--   → las 9 filas en tipo='pct', monto NULL (nada cambió de precio)
