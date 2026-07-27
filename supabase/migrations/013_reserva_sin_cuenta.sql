-- ============================================================
-- 013 — RESERVA SIN CUENTA: comuna y teléfono normalizado
-- ============================================================
-- Contexto (PRP-003 F1): reservar exigía cuenta. Cada visitante que no
-- quería registrarse era una reserva perdida. Ahora se puede reservar sin
-- cuenta, pero entonces el formulario tiene que pedir los datos que antes
-- venían del perfil — si no, el equipo no puede confirmar la cita y el
-- dashboard queda ciego.
--
-- La base ya permitía reservas anónimas (`cliente_id` acepta NULL y la
-- policy `solicitud_publica_pendiente` de la migración 002 lo autoriza).
-- Lo que faltaba eran dos datos.

-- ── Comuna ───────────────────────────────────────────────────
-- De dónde viene el cliente. Con cuenta ya se guarda en `perfiles`
-- (migración 004), pero sin cuenta no había dónde ponerla, y es uno de los
-- cortes que el negocio quiere ver en las analíticas.
ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS contacto_comuna TEXT;

-- ── Teléfono normalizado ─────────────────────────────────────
-- Solo dígitos, sin prefijo país: "+56 9 1234 5678" y "912345678" son la
-- misma persona. Es la llave con la que se reconoce a un cliente que vuelve
-- sin haberse registrado, y la que permite heredarle su historial cuando
-- después crea la cuenta (decisión del señor Ignacio, 26-jul).
--
-- Columna GENERADA: se calcula sola desde `contacto_telefono` y no se puede
-- escribir a mano. Así nunca queda desincronizada del teléfono real, que es
-- justo el modo en que un historial se parte en dos.
ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS telefono_norm TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN contacto_telefono IS NULL THEN NULL
      -- quita todo lo que no sea dígito
      WHEN length(regexp_replace(contacto_telefono, '\D', '', 'g')) > 9
       AND left(regexp_replace(contacto_telefono, '\D', '', 'g'), 2) = '56'
        THEN substr(regexp_replace(contacto_telefono, '\D', '', 'g'), 3)
      ELSE regexp_replace(contacto_telefono, '\D', '', 'g')
    END
  ) STORED;

-- Índice: la búsqueda "¿cuántas citas lleva este teléfono?" corre en cada
-- cotización del formulario público.
CREATE INDEX IF NOT EXISTS idx_sesiones_telefono_norm
  ON public.sesiones(telefono_norm)
  WHERE telefono_norm IS NOT NULL;

-- Mismo dato en el perfil, para poder cruzar cuenta ↔ reservas anónimas.
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS telefono_norm TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN telefono IS NULL THEN NULL
      WHEN length(regexp_replace(telefono, '\D', '', 'g')) > 9
       AND left(regexp_replace(telefono, '\D', '', 'g'), 2) = '56'
        THEN substr(regexp_replace(telefono, '\D', '', 'g'), 3)
      ELSE regexp_replace(telefono, '\D', '', 'g')
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_perfiles_telefono_norm
  ON public.perfiles(telefono_norm)
  WHERE telefono_norm IS NOT NULL;

-- ── Cuántas citas lleva un teléfono ──────────────────────────
-- SECURITY DEFINER porque un visitante anónimo no puede (ni debe) leer
-- `sesiones`. Devuelve SOLO un número: ni nombres, ni fechas, ni servicios.
-- Con eso el formulario puede decir "es tu primera visita" sin filtrar el
-- historial de nadie.
CREATE OR REPLACE FUNCTION public.visitas_de_telefono(telefono TEXT)
RETURNS INTEGER AS $$
  SELECT count(*)::int
  FROM public.sesiones
  WHERE telefono_norm = CASE
      WHEN length(regexp_replace(telefono, '\D', '', 'g')) > 9
       AND left(regexp_replace(telefono, '\D', '', 'g'), 2) = '56'
        THEN substr(regexp_replace(telefono, '\D', '', 'g'), 3)
      ELSE regexp_replace(telefono, '\D', '', 'g')
    END
    AND telefono_norm <> ''
    -- Una cita cancelada no cuenta como visita: nadie fue.
    AND estado <> 'cancelada';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER FUNCTION public.visitas_de_telefono(TEXT) SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION public.visitas_de_telefono(TEXT) TO anon, authenticated;

-- ── GRANT de la columna nueva ────────────────────────────────
-- `sesiones` ya tenía GRANT INSERT para anon, y cubre las columnas nuevas
-- porque el GRANT es a nivel de tabla. Explícito igual, por la ley del
-- proyecto (política sin grant = 42501 mudo).
GRANT INSERT ON public.sesiones TO anon;

-- Verificación post-aplicación (correr a mano):
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='sesiones' AND column_name IN ('contacto_comuna','telefono_norm');  -- 2
-- SELECT public.visitas_de_telefono('+56 9 1234 5678');  -- 0 en base limpia
