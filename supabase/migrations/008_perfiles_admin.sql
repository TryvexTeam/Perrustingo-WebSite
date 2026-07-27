-- ============================================================
-- 008 — PERFILES: edición por admin + flag de peluquero
-- ============================================================
-- Contexto (PRP-001 Fase 1): asignar roles hoy es solo por SQL. El panel
-- necesita listar perfiles y cambiar su rol, pero el esquema tenía un
-- hueco que hacía eso imposible en silencio:
--
--   pg_policies sobre `perfiles` (verificado en prod 26-jul):
--     admin_ve_todos_perfiles : SELECT
--     perfil_lee_propio       : SELECT
--     perfil_edita_propio     : UPDATE   ← solo la fila propia
--
-- Es decir: NINGUNA policy permitía a un admin hacer UPDATE de OTRO
-- perfil. Con RLS activo eso no es un error, es un UPDATE que afecta 0
-- filas y devuelve éxito — el peor modo de fallo posible: el panel diría
-- "guardado" y el rol seguiría igual. Esta migración cierra ese hueco.
--
-- Nota de numeración: el PRP reservaba 008 para `promos` (Fase 3), pero
-- la Fase 1 se ejecuta antes y necesita su propia migración. Promos y
-- disponibilidad corren a 009/010.

-- ── Flag de peluquero ────────────────────────────────────────
-- Quién atiende físicamente. NO es lo mismo que el rol: un admin puede
-- ser dueño y no atender, y un trabajador puede ser recepción. La Fase 5
-- (capacidad paralela) cuenta ESTA columna, no el rol — de ahí que el
-- flag nazca acá y no allá.
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS es_peluquero BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Policy que faltaba: el admin edita cualquier perfil ──────
-- WITH CHECK además de USING: sin WITH CHECK, la policy autoriza a leer
-- la fila para modificarla pero no valida la fila resultante.
DROP POLICY IF EXISTS "admin_edita_perfiles" ON public.perfiles;
CREATE POLICY "admin_edita_perfiles" ON public.perfiles
  FOR UPDATE
  USING (public.get_rol() = 'admin')
  WITH CHECK (public.get_rol() = 'admin');

-- GRANT explícito (ley del proyecto: política sin grant = 42501 mudo).
-- `perfiles` existía cuando corrió el GRANT ON ALL TABLES de schema.sql,
-- así que esto es redundante hoy — pero explícito en el DDL, no supuesto.
GRANT SELECT, UPDATE ON public.perfiles TO authenticated;

-- ── Guard: no dejar el sistema sin admins ────────────────────
-- Un admin que se auto-degrada (o degrada al último admin que queda)
-- cierra el panel para todos y solo se recupera por SQL Editor. Ya nos
-- pasó el equivalente: F0 encontró la base con admins = 0 y el panel
-- inaccesible. Esto lo vuelve imposible desde la aplicación.
-- Vive en la DB, no en el server action, porque el action es solo una de
-- las puertas (PostgREST directo es otra).
CREATE OR REPLACE FUNCTION public.protege_ultimo_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.rol = 'admin' AND NEW.rol IS DISTINCT FROM 'admin' THEN
    IF (SELECT count(*) FROM public.perfiles WHERE rol = 'admin') <= 1 THEN
      RAISE EXCEPTION 'No se puede quitar el último admin del sistema'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- search_path fijo — mismo endurecimiento que `protege_rol`/`get_rol`
-- (SECURITY DEFINER sin search_path = schema-hijacking clásico).
ALTER FUNCTION public.protege_ultimo_admin() SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protege_ultimo_admin ON public.perfiles;
CREATE TRIGGER trg_protege_ultimo_admin
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.protege_ultimo_admin();

-- ── Correos del equipo (solo admin) ──────────────────────────
-- `perfiles` no guarda el email: vive en `auth.users`, que la clave anon
-- no puede leer (y así debe seguir). Para que el panel identifique a la
-- persona sin exponer la tabla de auth, una función SECURITY DEFINER que
-- devuelve SOLO id+email y que valida el rol adentro: si el llamador no
-- es admin, levanta, no devuelve vacío. Un rechazo mudo sería
-- indistinguible de "no hay usuarios".
CREATE OR REPLACE FUNCTION public.emails_de_perfiles()
RETURNS TABLE (id UUID, email TEXT) AS $$
BEGIN
  IF COALESCE(public.get_rol(), '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un admin puede ver los correos'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT u.id, u.email::TEXT FROM auth.users u;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.emails_de_perfiles() SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION public.emails_de_perfiles() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.emails_de_perfiles() TO authenticated;

-- Verificación post-aplicación (correr a mano):
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='perfiles';
--   → debe aparecer admin_edita_perfiles : UPDATE
-- SELECT count(*) FROM information_schema.columns
--   WHERE table_name='perfiles' AND column_name='es_peluquero';  → 1
-- SELECT tgname FROM pg_trigger WHERE tgrelid='public.perfiles'::regclass
--   AND NOT tgisinternal;  → trg_protege_rol + trg_protege_ultimo_admin
