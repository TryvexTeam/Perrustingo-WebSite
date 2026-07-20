-- ============================================================
-- Perrustingo — Migración 005: auditoría de confirmación de
-- cita, notas del peluquero (historial por perro), cupones.
--
-- ⚠️ DRAFT — pendiente de sincronizar con la migración 004
-- (rama feat/reserva-v2 de Jarvis, aún no pusheada). Si 004 ya
-- crea una tabla `cupones` u otra columna en `sesiones` con
-- estos mismos nombres, ajustar antes de correr esto en la
-- Supabase real del cliente. NO ejecutar sin confirmar.
--
-- Ejecutar DESPUÉS de 002, 003 y 004 en Supabase → SQL Editor.
-- ============================================================

-- ============================================================
-- CONFIRMACIÓN DE CITA (auditoría: quién y cuándo)
-- ============================================================
ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS confirmada_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmada_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL;

-- El UPDATE en sí ya está permitido por la policy existente
-- "equipo_ve_todas_sesiones" (FOR ALL, admin/trabajador). Este
-- trigger solo AUDITA la transición pendiente/en_proceso → confirmada;
-- no necesita SECURITY DEFINER porque no hace nada que el llamador
-- no pueda hacer ya (solo completa columnas de la fila que edita).
CREATE OR REPLACE FUNCTION public.registra_confirmacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'confirmada' AND OLD.estado IS DISTINCT FROM 'confirmada' THEN
    NEW.confirmada_at  := NOW();
    NEW.confirmada_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registra_confirmacion ON public.sesiones;
CREATE TRIGGER trg_registra_confirmacion
  BEFORE UPDATE ON public.sesiones
  FOR EACH ROW EXECUTE FUNCTION public.registra_confirmacion();

-- ============================================================
-- NOTAS DEL PELUQUERO (historial por PERRO, no por cita —
-- así sobrevive entre sesiones y el equipo ve la ficha completa)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notas_perro (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  perro_id    UUID NOT NULL REFERENCES public.perros(id) ON DELETE CASCADE,
  sesion_id   UUID REFERENCES public.sesiones(id) ON DELETE SET NULL,
  autor_id    UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  detalle     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notas_perro ENABLE ROW LEVEL SECURITY;

-- Solo equipo: el brief de Rodolfo dice "el equipo ve el historial",
-- no menciona al dueño. Si más adelante quiere que el cliente vea
-- sus propias notas, agregar una policy de SELECT análoga a
-- "cliente_ve_sus_fotos".
CREATE POLICY "equipo_maneja_notas_perro" ON public.notas_perro
  FOR ALL USING (public.get_rol() IN ('admin','trabajador'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_perro TO authenticated;

CREATE INDEX IF NOT EXISTS idx_notas_perro_perro  ON public.notas_perro(perro_id);
CREATE INDEX IF NOT EXISTS idx_notas_perro_sesion ON public.notas_perro(sesion_id);

-- ============================================================
-- CUPONES (tabla real, no comparar strings sueltos en el form)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cupones (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  codigo         TEXT NOT NULL UNIQUE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('registro','flyer','manual')),
  descuento_pct  INTEGER NOT NULL CHECK (descuento_pct > 0 AND descuento_pct <= 100),
  usos_max       INTEGER,                      -- NULL = ilimitado
  usos_actuales  INTEGER NOT NULL DEFAULT 0,
  vigente_desde  TIMESTAMPTZ DEFAULT NOW(),
  vigente_hasta  TIMESTAMPTZ,                   -- NULL = sin vencimiento
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sesiones
  -- NUNCA aceptar este valor directo del body del cliente: se
  -- llena SOLO con el id que devuelve aplicar_cupon(código) del
  -- lado servidor. El precio manipulable desde el body ya es un
  -- hallazgo abierto de la auditoría de Ariel — no repetir el
  -- patrón acá con el cupón.
  ADD COLUMN IF NOT EXISTS cupon_id UUID REFERENCES public.cupones(id) ON DELETE SET NULL;

ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;

-- Lectura pública SOLO de cupones vigentes/activos/con cupo — para
-- que el form pueda mostrar "cupón válido" antes de reservar. Nunca
-- expone cupones vencidos, inactivos o agotados.
CREATE POLICY "cupon_publico_vigente" ON public.cupones
  FOR SELECT USING (
    activo = TRUE
    AND (vigente_hasta IS NULL OR vigente_hasta > NOW())
    AND (usos_max IS NULL OR usos_actuales < usos_max)
  );

CREATE POLICY "admin_maneja_cupones" ON public.cupones
  FOR ALL USING (public.get_rol() = 'admin');

GRANT SELECT ON public.cupones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cupones TO authenticated;  -- filtrado por la policy admin

CREATE INDEX IF NOT EXISTS idx_cupones_codigo ON public.cupones(codigo);

-- Aplicar cupón de forma ATÓMICA (valida vigencia + tope de uso +
-- incrementa en la misma sentencia) para que dos reservas
-- simultáneas con el mismo código no rompan "sin acumulación" ni
-- el tope de usos_max. SECURITY DEFINER porque anon/authenticated
-- no tienen (ni deben tener) UPDATE directo sobre cupones — esta
-- función es la única puerta, angosta y validada, para tocar
-- usos_actuales.
CREATE OR REPLACE FUNCTION public.aplicar_cupon(p_codigo TEXT)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  UPDATE public.cupones
  SET usos_actuales = usos_actuales + 1
  WHERE codigo = p_codigo
    AND activo = TRUE
    AND (vigente_hasta IS NULL OR vigente_hasta > NOW())
    AND (usos_max IS NULL OR usos_actuales < usos_max)
  RETURNING id INTO v_id;

  RETURN v_id;  -- NULL si el código no existe, no es válido o se agotó
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.aplicar_cupon(TEXT) TO anon, authenticated;

-- Tradeoff aceptado: si aplicar_cupon() incrementa el uso pero el
-- INSERT de la sesión falla después (ej. validación downstream),
-- ese uso queda gastado igual. Para un 10% de descuento no amerita
-- una función combinada cupon+sesión en una sola transacción; si
-- se vuelve un problema real, revisar entonces.

-- Seed: cupón de lanzamiento del flyer (10%, sin tope de usos)
INSERT INTO public.cupones (codigo, tipo, descuento_pct, usos_max)
VALUES ('LANZAMIENTO', 'flyer', 10, NULL)
ON CONFLICT (codigo) DO NOTHING;
