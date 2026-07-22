-- ============================================================
-- 008 — Separar teléfono en móvil (requerido, WhatsApp) y fijo
-- (opcional) — pedido explícito de Rodolfo en la reunión del 21-jul
-- ("separando los números de contacto fijo y móvil").
-- ============================================================
-- No se dropea la columna `telefono` vieja — se backfillea a
-- `telefono_movil` y queda en desuso, no se borra (evita romper
-- cualquier lectura que aún no se haya actualizado). Limpieza futura,
-- no parte de esta migración.

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS telefono_movil TEXT,
  ADD COLUMN IF NOT EXISTS telefono_fijo  TEXT;

UPDATE public.perfiles
   SET telefono_movil = telefono
 WHERE telefono_movil IS NULL AND telefono IS NOT NULL;

ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS contacto_telefono_movil TEXT,
  ADD COLUMN IF NOT EXISTS contacto_telefono_fijo  TEXT;

UPDATE public.sesiones
   SET contacto_telefono_movil = contacto_telefono
 WHERE contacto_telefono_movil IS NULL AND contacto_telefono IS NOT NULL;

-- El trigger de alta (migración 004) ahora escribe ambos campos desde
-- el metadata del signup — `telefono_fijo` queda NULL si el usuario no
-- lo completó (es opcional).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, apellido, comuna, telefono, telefono_movil, telefono_fijo)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nombre',
    NEW.raw_user_meta_data->>'apellido',
    NEW.raw_user_meta_data->>'comuna',
    NEW.raw_user_meta_data->>'telefono_movil',
    NEW.raw_user_meta_data->>'telefono_movil',
    NEW.raw_user_meta_data->>'telefono_fijo'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Verificación post-aplicación (comentada, correr a mano si hay dudas):
-- SELECT column_name FROM information_schema.columns WHERE table_name IN ('perfiles','sesiones') AND column_name LIKE 'telefono%' OR column_name LIKE 'contacto_telefono%';
