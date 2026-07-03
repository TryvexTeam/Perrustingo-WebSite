-- ============================================================
-- Perrustingo — Schema v1
-- Ejecutar en Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- EXTENSIÓN para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PERFILES DE USUARIO (extiende auth.users de Supabase)
-- ============================================================
CREATE TABLE public.perfiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  rol         TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente','trabajador','admin')),
  nombre      TEXT,
  telefono    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nombre');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PERROS
-- ============================================================
CREATE TABLE public.perros (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id      UUID REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  raza            TEXT,
  fecha_nacimiento DATE,
  peso_kg         NUMERIC(5,2),
  contextura      TEXT CHECK (contextura IN ('delgado','normal','robusto')),
  tipo_pelo       TEXT,
  alergias        TEXT,
  condiciones     TEXT[],  -- ['unas_encarnadas','secrecion_ocular']
  temperamento    TEXT CHECK (temperamento IN ('se_deja','no_se_deja','complicado','no_lo_se')),
  zonas_problemas TEXT[],  -- ['patitas','hocico','unas',...]
  notas           TEXT,
  foto_url        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SESIONES / CITAS
-- ============================================================
CREATE TABLE public.sesiones (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  perro_id          UUID REFERENCES public.perros(id) ON DELETE SET NULL,
  cliente_id        UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  trabajador_id     UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','confirmada','en_proceso','completada','cancelada')),
  fecha_cita        TIMESTAMPTZ,
  fecha_inicio      TIMESTAMPTZ,
  fecha_fin         TIMESTAMPTZ,
  servicio          TEXT,
  precio_base       INTEGER,  -- en CLP, sin decimales
  recargo_conducta  INTEGER DEFAULT 0,
  precio_final      INTEGER,
  notas_cliente     TEXT,
  notas_equipo      TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REGISTRO DE CONDUCTA (US-09)
-- ============================================================
CREATE TABLE public.conducta (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sesion_id   UUID REFERENCES public.sesiones(id) ON DELETE CASCADE,
  perro_id    UUID REFERENCES public.perros(id) ON DELETE SET NULL,
  registrado_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  nivel       TEXT NOT NULL CHECK (nivel IN ('bajo','medio','alto')),
  descripcion TEXT,
  recargo     INTEGER DEFAULT 0,  -- CLP extra cobrado
  notificado  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FOTOS DE SESIÓN (documentación antes/después)
-- ============================================================
CREATE TABLE public.fotos_sesion (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sesion_id  UUID REFERENCES public.sesiones(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('antes','durante','despues')),
  url        TEXT NOT NULL,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TARIFAS (administradas por Rodolfo desde el dashboard)
-- ============================================================
CREATE TABLE public.tarifas (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tamano      TEXT NOT NULL CHECK (tamano IN ('toy','pequeno','mediano','grande','gigante')),
  servicio    TEXT NOT NULL DEFAULT 'bano_completo',
  precio      INTEGER NOT NULL,
  activo      BOOLEAN DEFAULT TRUE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Precios iniciales (sync con lib/reserva.ts)
INSERT INTO public.tarifas (tamano, precio) VALUES
  ('toy',      18000),
  ('pequeno',  20000),
  ('mediano',  25000),
  ('grande',   40000),
  ('gigante',  80000);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.perfiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perros         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conducta       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_sesion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas        ENABLE ROW LEVEL SECURITY;

-- Helper: obtener rol del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_rol()
RETURNS TEXT AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ── PERFILES ──────────────────────────────────────────────
CREATE POLICY "perfil_propio" ON public.perfiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "admin_ve_todos_perfiles" ON public.perfiles
  FOR SELECT USING (get_rol() IN ('admin','trabajador'));

-- ── PERROS ────────────────────────────────────────────────
CREATE POLICY "cliente_ve_sus_perros" ON public.perros
  FOR ALL USING (cliente_id = auth.uid());

CREATE POLICY "equipo_ve_todos_perros" ON public.perros
  FOR SELECT USING (get_rol() IN ('admin','trabajador'));

CREATE POLICY "equipo_edita_perros" ON public.perros
  FOR UPDATE USING (get_rol() IN ('admin','trabajador'));

-- ── SESIONES ──────────────────────────────────────────────
CREATE POLICY "cliente_ve_sus_sesiones" ON public.sesiones
  FOR SELECT USING (cliente_id = auth.uid());

CREATE POLICY "equipo_ve_todas_sesiones" ON public.sesiones
  FOR ALL USING (get_rol() IN ('admin','trabajador'));

-- ── CONDUCTA ──────────────────────────────────────────────
CREATE POLICY "equipo_maneja_conducta" ON public.conducta
  FOR ALL USING (get_rol() IN ('admin','trabajador'));

-- ── FOTOS ─────────────────────────────────────────────────
CREATE POLICY "cliente_ve_sus_fotos" ON public.fotos_sesion
  FOR SELECT USING (
    sesion_id IN (SELECT id FROM public.sesiones WHERE cliente_id = auth.uid())
  );

CREATE POLICY "equipo_maneja_fotos" ON public.fotos_sesion
  FOR ALL USING (get_rol() IN ('admin','trabajador'));

-- ── TARIFAS ───────────────────────────────────────────────
CREATE POLICY "tarifas_publicas" ON public.tarifas
  FOR SELECT USING (activo = TRUE);

CREATE POLICY "admin_edita_tarifas" ON public.tarifas
  FOR ALL USING (get_rol() = 'admin');

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX idx_sesiones_cliente    ON public.sesiones(cliente_id);
CREATE INDEX idx_sesiones_fecha      ON public.sesiones(fecha_cita);
CREATE INDEX idx_sesiones_estado     ON public.sesiones(estado);
CREATE INDEX idx_perros_cliente      ON public.perros(cliente_id);
CREATE INDEX idx_conducta_sesion     ON public.conducta(sesion_id);
CREATE INDEX idx_fotos_sesion_id     ON public.fotos_sesion(sesion_id);
