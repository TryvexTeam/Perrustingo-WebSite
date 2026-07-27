-- ============================================================
-- 018 — Cerrar la enumeración de teléfonos
-- ============================================================
-- Contexto (PRP-004 F3): `visitas_de_telefono()` quedó ejecutable por
-- `anon` al crearla (migración 013). Medido en la auditoría del 26-jul:
-- 5 consultas anónimas respondidas en 914 ms, sin ningún límite.
--
-- Con eso se puede probar una lista de números y averiguar **quién es
-- cliente de Perrustingo y cuántas veces vino**. No expone el nombre ni la
-- dirección, pero confirma la relación — y con un diccionario de números
-- chilenos se barre en minutos.
--
-- La función sigue existiendo porque el negocio la necesita (una oferta
-- puede ser "desde tu segunda visita"), pero deja de estar al alcance de
-- cualquiera: ahora solo la llama el servidor, a través de un endpoint que
-- pasa por el rate limit de la migración 016.

REVOKE EXECUTE ON FUNCTION public.visitas_de_telefono(TEXT) FROM anon;

-- `authenticated` la conserva: quien tiene sesión ya puede ver sus propias
-- sesiones por RLS, así que no gana información nueva sobre otros... salvo
-- el conteo de un número ajeno. Se acota igual: solo su propio teléfono.
CREATE OR REPLACE FUNCTION public.visitas_de_telefono(telefono TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_tel TEXT;
  v_mio TEXT;
BEGIN
  v_tel := regexp_replace(COALESCE(telefono, ''), '\D', '', 'g');
  IF length(v_tel) > 9 AND left(v_tel, 2) = '56' THEN
    v_tel := substr(v_tel, 3);
  END IF;
  IF v_tel = '' THEN
    RETURN 0;
  END IF;

  /* Con sesión iniciada, solo se puede preguntar por el teléfono propio.
     Sin sesión (uid NULL) la llamada viene del servidor, que ya aplicó su
     propio límite antes de llegar acá — y `anon` ya no puede ejecutarla,
     así que ese camino solo existe desde el backend. */
  IF auth.uid() IS NOT NULL THEN
    SELECT telefono_norm INTO v_mio FROM public.perfiles WHERE id = auth.uid();
    IF v_mio IS DISTINCT FROM v_tel
       AND COALESCE(public.get_rol(), '') NOT IN ('admin', 'trabajador') THEN
      RAISE EXCEPTION 'Solo se puede consultar el teléfono propio'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN (
    SELECT count(*)::int
      FROM public.sesiones
     WHERE telefono_norm = v_tel
       AND telefono_norm <> ''
       -- Una cita cancelada no cuenta como visita: nadie fue.
       AND estado <> 'cancelada'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

ALTER FUNCTION public.visitas_de_telefono(TEXT) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.visitas_de_telefono(TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.visitas_de_telefono(TEXT) TO authenticated, service_role;

-- Verificación post-aplicación:
-- Como anon (clave pública): POST /rest/v1/rpc/visitas_de_telefono → 401/403.
