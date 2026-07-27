-- ============================================================
-- 019 — Que borrar una cuenta no se lleve el trabajo del negocio
-- ============================================================
-- Contexto (PRP-004 F5). Revisando qué se pierde en cascada apareció esto:
--
--   perros.cliente_id -> perfiles ON DELETE CASCADE
--
-- Es decir: si un cliente borra su cuenta —o alguien borra un perfil por
-- error— **se borran las fichas de sus perros**. Y como
-- `sesiones.perro_id` es SET NULL, las citas quedan huérfanas: sobrevive el
-- registro de que hubo una cita, pero se pierde de qué perrito era.
--
-- Para una peluquería esa ficha ES el trabajo acumulado: la raza, el peso,
-- las alergias, y sobre todo "no se deja tocar las patas" o "es bravo con
-- la máquina". Perderla no es perder un dato, es perder cómo atender bien a
-- ese animal la próxima vez — y ponerlo en riesgo.
--
-- El perro no deja de existir porque su dueño cierre la cuenta.

ALTER TABLE public.perros
  DROP CONSTRAINT IF EXISTS perros_cliente_id_fkey;

ALTER TABLE public.perros
  ADD CONSTRAINT perros_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.perfiles(id) ON DELETE SET NULL;

-- Nota sobre las otras cascadas, revisadas y CORRECTAS:
--   · sesiones.cliente_id -> perfiles ON DELETE SET NULL
--     Borrar una cuenta no borra sus citas: la cita ocurrió y el negocio
--     necesita su historial (y su facturación).
--   · fotos_sesion.sesion_id / conducta.sesion_id -> sesiones ON DELETE CASCADE
--     Aceptable: solo se disparan si se borra la sesión, y las citas no se
--     borran — se cancelan (cambian de estado).
--   · ajustes_precio_tamano -> ajustes_precio ON DELETE CASCADE
--     Correcto: una excepción de precio sin su ajuste padre sería un precio
--     fantasma que nadie aplica.

-- Verificación post-aplicación (correr a mano):
-- SELECT rc.delete_rule FROM information_schema.referential_constraints rc
--  WHERE rc.constraint_name = 'perros_cliente_id_fkey';   -- SET NULL
