-- ============================================================
-- FIX escalada de privilegios en perfiles.rol (AUDITORIA Ariel)
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ------------------------------------------------------------
-- Ataque confirmado 2026-07-15: un cliente autenticado podía
--   PATCH /rest/v1/perfiles {"rol":"admin"}  → 200 OK
-- porque la policy "perfil_propio" (FOR ALL, id = auth.uid())
-- permite UPDATE de la propia fila SIN restringir columnas, y el
-- GRANT UPDATE habilitó la vía. WITH CHECK con subquery a la misma
-- tabla NO funciona (probado: el PATCH pasó igual).
-- Ruta correcta: trigger BEFORE UPDATE.
-- ============================================================

-- PASO 0 — inspección: ver triggers actuales de perfiles
-- (para identificar el trigger a medio hacer del 15-jul y borrarlo)
SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.perfiles'::regclass AND NOT tgisinternal;

-- PASO 1 — limpiar restos del intento anterior (ajustar nombre si difiere
-- del que devuelva el PASO 0)
DROP TRIGGER IF EXISTS trg_protege_rol ON public.perfiles;
DROP TRIGGER IF EXISTS protege_rol ON public.perfiles;
DROP FUNCTION IF EXISTS public.protege_rol();

-- PASO 2 — función guard + trigger definitivos
-- Clave del guard: auth.uid() IS NOT NULL deja pasar al SQL editor y al
-- service_role (ahí auth.uid() es NULL) — así el equipo puede administrar
-- roles desde el dashboard, pero ningún usuario final no-admin puede
-- tocar la columna rol (ni la suya ni la de otro).
CREATE OR REPLACE FUNCTION public.protege_rol()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol
     AND auth.uid() IS NOT NULL
     AND COALESCE(public.get_rol(), '') <> 'admin'
  THEN
    RAISE EXCEPTION 'Solo un admin puede cambiar roles'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_protege_rol
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.protege_rol();

-- PASO 3 — restaurar el rol del admin real (quedó en 'trabajador' por el
-- test del 15-jul). Identificar primero, luego restaurar.
SELECT id, nombre, rol FROM public.perfiles ORDER BY created_at;
-- UPDATE public.perfiles SET rol = 'admin' WHERE id = '<uuid del admin>';

-- PASO 4 — verificación (correr como cliente autenticado vía PostgREST):
--   PATCH /rest/v1/perfiles?id=eq.<uuid propio>  {"rol":"admin"}
--   → debe devolver 42501 / error, y el rol NO debe cambiar.
-- Y como admin desde el dashboard: cambiar un rol debe seguir funcionando.
