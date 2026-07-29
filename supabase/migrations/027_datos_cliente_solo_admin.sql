-- ============================================================
-- 027 — LOS DATOS DE CONTACTO SON SOLO DEL ADMIN
-- ============================================================
-- Pedido de Rodolfo (reunión 27-jul): los peluqueros trabajan con la ficha
-- del perrito y marcan avances, pero NO deben tener el teléfono ni el correo
-- de sus clientes. El motivo es concreto: evitar que se los contacten por
-- fuera del salón.
--
-- Hoy `equipo_ve_todas_sesiones` da a 'trabajador' la fila COMPLETA, y el
-- panel muestra un botón de WhatsApp con el número. Ni siquiera hay que
-- saber de computación: es un enlace en pantalla.
--
-- Por qué en la base y no en la pantalla: `PanelCita` consulta Supabase
-- DIRECTO DESDE EL NAVEGADOR con la sesión del usuario. Esconder el dato en
-- el HTML no lo protege — sigue viajando. La única frontera real es esta.
--
-- Y son DOS puertas al mismo dato, no una:
--   1. sesiones.contacto_telefono / contacto_email / notas_cliente
--   2. perfiles.telefono  (de todo cliente registrado)
-- Cerrar solo la primera deja la segunda abierta.

-- ── 1. La tabla `sesiones` deja de ser legible por el trabajador ──
-- RLS es por FILA, no por columna: no existe "ve la fila pero sin el
-- teléfono". Así que el trabajador pierde el SELECT sobre la tabla y pasa a
-- leer por la vista de más abajo. Conserva el UPDATE, que es lo que necesita
-- para mover estados y dejar notas.
-- Los DROP van antes de cada CREATE porque Postgres no tiene
-- `CREATE POLICY IF NOT EXISTS`: sin esto, un segundo intento aborta a mitad
-- de camino y deja la migración aplicada por partes. Ya pasó una vez.
DROP POLICY IF EXISTS "equipo_ve_todas_sesiones" ON public.sesiones;

DROP POLICY IF EXISTS "admin_maneja_sesiones" ON public.sesiones;
CREATE POLICY "admin_maneja_sesiones" ON public.sesiones
  FOR ALL USING (public.get_rol() = 'admin')
  WITH CHECK (public.get_rol() = 'admin');

DROP POLICY IF EXISTS "trabajador_actualiza_sesiones" ON public.sesiones;
CREATE POLICY "trabajador_actualiza_sesiones" ON public.sesiones
  FOR UPDATE USING (public.get_rol() = 'trabajador')
  WITH CHECK (public.get_rol() = 'trabajador');

-- ── 2. Vista del equipo ──────────────────────────────────────
-- Misma forma para los dos roles: el admin recibe los datos de contacto y
-- el trabajador los recibe en NULL. Se hizo así a propósito — la UI ya
-- escribe `sesion.contacto_telefono && (...)`, o sea que el dato ausente se
-- esconde solo, sin condicionales de rol repartidos por las pantallas. Un
-- `if (esAdmin)` olvidado en un componente vuelve a filtrar el dato; un NULL
-- no se olvida.
--
-- security_invoker = false a propósito: la vista corre como su dueño y por
-- eso puede leer `sesiones` pese a que el trabajador ya no tenga SELECT. El
-- control de acceso lo hace el WHERE de abajo, que es lo que reemplaza a la
-- política que se quitó.
DROP VIEW IF EXISTS public.sesiones_equipo;

CREATE VIEW public.sesiones_equipo
WITH (security_invoker = false) AS
SELECT
  s.id,
  s.estado,
  s.fecha_cita,
  s.fecha_fin,
  s.servicio,
  s.precio_base,
  s.precio_final,
  s.perro_id,
  s.cliente_id,
  s.oferta_id,
  s.detalle_form,
  s.notas_equipo,
  s.created_at,
  -- El nombre SÍ lo ve el peluquero: necesita saber a quién le entrega el
  -- perrito. Lo que no puede es contactarlo por fuera.
  s.contacto_nombre,
  CASE WHEN public.get_rol() = 'admin' THEN s.contacto_email END     AS contacto_email,
  CASE WHEN public.get_rol() = 'admin' THEN s.contacto_telefono END  AS contacto_telefono,
  -- La comuna queda visible para todo el equipo: con ella no se contacta a
  -- nadie, y las analíticas la agrupan para ver de dónde llegan los clientes.
  -- Taparla rompería un gráfico sin proteger nada.
  s.contacto_comuna,
  -- `notas_cliente` parece inofensiva, pero el endpoint de reservas escribe
  -- ahí "nombre · teléfono · correo" cuando faltan columnas (ver el fallback
  -- de app/api/reservas/route.ts). Es el mismo dato por otra puerta.
  CASE WHEN public.get_rol() = 'admin' THEN s.notas_cliente END      AS notas_cliente
FROM public.sesiones s
WHERE public.get_rol() IN ('admin', 'trabajador');

ALTER VIEW public.sesiones_equipo SET (security_barrier = true);

GRANT SELECT ON public.sesiones_equipo TO authenticated;

-- ── 3. La otra puerta: perfiles.telefono ─────────────────────
-- `admin_ve_todos_perfiles` incluía a 'trabajador', así que el teléfono de
-- cualquier cliente registrado quedaba a un SELECT de distancia. El propio
-- panel lo usaba: dashboard/page.tsx hace join a perfiles(nombre, telefono).
-- El trabajador conserva su propio perfil por la política `perfil_propio`.
DROP POLICY IF EXISTS "admin_ve_todos_perfiles" ON public.perfiles;
CREATE POLICY "admin_ve_todos_perfiles" ON public.perfiles
  FOR SELECT USING (public.get_rol() = 'admin');

-- Verificación post-aplicación (correr a mano):
--
-- 1) La vista existe y trae las columnas esperadas:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'sesiones_equipo' ORDER BY 1;
--
-- 2) Como ADMIN: los datos de contacto llegan.
--    SELECT contacto_nombre, contacto_telefono FROM public.sesiones_equipo LIMIT 3;
--
-- 3) La prueba que importa — con una cuenta de rol 'trabajador':
--    SELECT contacto_telefono, contacto_email, notas_cliente
--      FROM public.sesiones_equipo LIMIT 3;      -- las tres en NULL
--    SELECT * FROM public.sesiones LIMIT 1;      -- 0 filas
--    SELECT telefono FROM public.perfiles WHERE id <> auth.uid();  -- 0 filas
