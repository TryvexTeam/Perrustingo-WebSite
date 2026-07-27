-- ============================================================
-- 024 — El servidor puede leer fotos_sesion para firmar el enlace
-- ============================================================
-- La foto tiene que viajar dentro del mensaje de WhatsApp (pedido del señor
-- Ignacio, 27-jul). El enlace del mensaje lo abre el EQUIPO desde su
-- teléfono, sin sesión en el sitio, así que la firma la genera el servidor
-- con la clave de servicio.
--
-- Y ahí apareció otra vez la trampa de siempre en este proyecto: RLS no es
-- lo único que hay que mirar. `service_role` se salta las policies, pero NO
-- se salta los privilegios de tabla, y `fotos_sesion` se creó otorgando
-- SELECT solo a `anon` y `authenticated`. Resultado: 42501, "permission
-- denied", con la clave correcta en la mano.
--
-- Es la tercera vez que este proyecto tropieza con lo mismo (perfiles en
-- PRP-001, fotos_sesion/anon en la 023). Postgres evalúa el GRANT ANTES que
-- la policy: sin GRANT, la policy no llega a ejecutarse nunca.

GRANT SELECT ON public.fotos_sesion TO service_role;

-- Solo SELECT. El servidor únicamente necesita mirar la fila para saber qué
-- objeto firmar; escribir y borrar siguen siendo del cliente que reserva y
-- del admin, como quedó en las migraciones 022 y 023.

-- Verificación post-aplicación (correr a mano):
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_name = 'fotos_sesion' AND grantee = 'service_role';
--   -> una fila: SELECT
