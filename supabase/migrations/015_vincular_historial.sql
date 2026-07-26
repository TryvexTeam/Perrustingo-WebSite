-- ============================================================
-- 015 — VINCULAR HISTORIAL al crear cuenta
-- ============================================================
-- Contexto (PRP-003 F4): desde F1 se puede reservar sin cuenta, y esas
-- citas quedan con `cliente_id` NULL. Si esa persona después se registra,
-- su historial arrancaría de cero: aparecería como cliente nuevo aunque
-- lleve tres visitas, y no accedería a la oferta de "tu segunda cita".
--
-- Decisión del señor Ignacio (26-jul): al registrarse SE LE RECONOCEN las
-- visitas previas. Es un premio a registrarse y hace la cuenta más
-- atractiva. La llave es el teléfono normalizado (migración 013).
--
-- Riesgo asumido y consciente: dos personas de una misma casa que compartan
-- teléfono quedarían con el historial unido. Ya pasa hoy si comparten
-- cuenta, así que no es una regresión.

-- Vincula a un perfil las reservas anónimas hechas con su mismo teléfono.
-- Devuelve cuántas adoptó, para poder decírselo a la persona.
--
-- SECURITY DEFINER: la policy de `sesiones` no deja a un cliente escribir
-- filas ajenas (y así debe seguir). El poder está acotado por dentro:
--   · solo toca filas con `cliente_id IS NULL` — jamás le quita una cita a
--     otro usuario;
--   · el teléfono no lo elige quien llama: se lee del perfil indicado, así
--     que nadie puede pedir "dame el historial de este número".
CREATE OR REPLACE FUNCTION public.vincular_historial(perfil UUID)
RETURNS INTEGER AS $$
DECLARE
  tel TEXT;
  adoptadas INTEGER;
BEGIN
  /* Solo sobre el perfil propio. Con el argumento libre, la función no
     permitía robar nada (asigna las citas AL perfil indicado, no a quien
     llama), pero una función SECURITY DEFINER debe ser lo más estrecha
     posible: si mañana alguien le agrega un RETURNING con datos, el
     agujero ya estaría abierto.

     `auth.uid() IS NOT NULL` deja pasar al trigger: durante el registro
     todavía no hay sesión, así que ahí el uid es NULL. Mismo patrón que
     `protege_rol` (migración 008). */
  IF auth.uid() IS NOT NULL AND auth.uid() <> perfil THEN
    RAISE EXCEPTION 'Solo se puede vincular el historial propio'
      USING ERRCODE = '42501';
  END IF;

  SELECT telefono_norm INTO tel FROM public.perfiles WHERE id = perfil;
  IF tel IS NULL OR tel = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.sesiones
     SET cliente_id = perfil
   WHERE cliente_id IS NULL
     AND telefono_norm = tel;

  GET DIAGNOSTICS adoptadas = ROW_COUNT;
  RETURN adoptadas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.vincular_historial(UUID) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.vincular_historial(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_historial(UUID) TO authenticated;

-- ── Que ocurra solo ──────────────────────────────────────────
-- Se dispara al crearse el perfil (registro) y al cambiar el teléfono. Así
-- no depende de que alguien se acuerde de llamarla desde el código: si
-- mañana aparece otra forma de registrarse, el historial se vincula igual.
CREATE OR REPLACE FUNCTION public.trg_vincular_historial()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.telefono_norm IS NOT NULL AND NEW.telefono_norm <> '' THEN
    PERFORM public.vincular_historial(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.trg_vincular_historial() SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_perfil_vincula_historial ON public.perfiles;
CREATE TRIGGER trg_perfil_vincula_historial
  AFTER INSERT OR UPDATE OF telefono ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_vincular_historial();

-- Verificación post-aplicación (correr a mano):
-- 1) Crear una sesión anónima con un teléfono.
-- 2) Registrar una cuenta con ese mismo teléfono.
-- 3) SELECT cliente_id FROM sesiones WHERE ...  → debe quedar con el uid.
