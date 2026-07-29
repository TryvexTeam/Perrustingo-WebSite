-- ============================================================
-- 028 — El servidor puede leer `sesiones`
-- ============================================================
-- Cuarta vez que este proyecto tropieza con lo mismo. La 024 lo dejó escrito
-- para `fotos_sesion` y aun así volvió a pasar:
--
--   `service_role` se salta las POLICIES, pero NO los privilegios de tabla.
--   Postgres evalúa el GRANT antes que la policy: sin GRANT, la policy no
--   llega a ejecutarse nunca. El síntoma es 42501 "permission denied" con la
--   credencial correcta en la mano.
--
-- `sesiones` nació en schema.sql otorgando acceso a `anon` y `authenticated`
-- solamente. Mientras el equipo leía con su propia sesión eso alcanzaba.
--
-- Desde la migración 027 dejó de alcanzar: el rol 'trabajador' ya no puede
-- leer la tabla —a propósito, para que el peluquero no vea el contacto del
-- cliente— y dos caminos del servidor pasaron a necesitar la credencial de
-- servicio:
--
--   · cambiarEstadoCita     — valida la transición y arma el evento de
--                             Google Calendar, que sí lleva el contacto
--   · avisarPerroListoAction — busca el correo para mandar el aviso sin que
--                             el peluquero lo vea
--
-- Sin este GRANT los dos fallan con "Cita no encontrada", que fue el error
-- reportado al confirmar una cita con cuenta de peluquero.

GRANT SELECT ON public.sesiones TO service_role;

-- Solo SELECT, igual que en la 024. Escribir sigue pasando por la sesión de
-- quien opera: el equipo actualiza estados con su propio rol y la policy
-- `trabajador_actualiza_sesiones` los cubre. Darle UPDATE al servidor sería
-- ampliar el alcance sin necesidad.

-- Verificación post-aplicación (correr a mano):
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_name = 'sesiones' AND grantee = 'service_role';
--   -> una fila: SELECT
