-- ============================================================================
-- 038 — Cada trabajador ve SU agenda, no la del colega
-- ============================================================================
-- QUE ESTABA ROTO: `/agenda` y `/dashboard/citas` consultaban `sesiones_equipo`
-- sin ningun filtro por persona. Bastaba tener rol `admin` o `trabajador` para
-- ver TODAS las citas del local, con nombre del cliente incluido. La decision
-- del 4-ago es la contraria: cada trabajador ve su propio calendario completo
-- —incluidos sus dias libres— y NO el del colega. Solo el admin ve todo.
--
-- Los dias libres ya quedaron bien segregados en la 034 (policy
-- `bloqueos_lectura_equipo`). Lo que faltaba eran las citas.
--
-- POR QUE EN LA BASE Y NO SOLO EN EL CODIGO: un filtro en la consulta de
-- Next.js lo salta cualquiera que llame a PostgREST con su propio token —y un
-- trabajador tiene token. El recorte tiene que estar donde el dato nace. La
-- vista `sesiones_equipo` corre con `security_invoker = false`, o sea como su
-- dueno, y su WHERE es lo que hace de politica de acceso (asi se documento en
-- la 027). Ahi va el filtro.
--
-- CITAS SIN ASIGNAR: se ven siempre, para todos. Hoy ninguna cita tiene
-- peluquero —`peluquero_id` nacio en la 035— asi que esconderlas dejaria a
-- todo el equipo con la agenda vacia y la conclusion falsa de que no hay
-- trabajo. Y una cita sin dueno es trabajo de todos hasta que el admin la
-- reparta. Es el mismo criterio que ya aplica la 034 a los bloqueos del local.
--
-- GRANT ANTES QUE POLICY, como siempre en este proyecto: la vista se recrea, y
-- una vista recreada NACE SIN PRIVILEGIOS. Sin el `grant select` de mas abajo
-- el panel completo muere con 42501 y el sintoma (admin botado a /perfil) no
-- se parece en nada a la causa. Ya paso cuatro veces.

-- ── La vista, con dueno y con recorte por persona ───────────────────────────
-- Se recrea completa porque una vista no hereda columnas nuevas de su tabla.
-- Es la definicion de la 030 mas `peluquero_id` y mas el WHERE de segregacion.
-- Las reglas de privacidad de contacto quedan EXACTAMENTE igual: email,
-- telefono y notas_cliente se siguen viendo solo con rol admin.

drop view if exists public.sesiones_equipo;

create view public.sesiones_equipo
with (security_invoker = false) as
select
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
  s.aviso_listo_en,
  -- Nuevo en la 038. Sin exponerlo no hay forma de filtrar por persona desde
  -- el panel ni de mostrar quien atiende cada cita.
  s.peluquero_id,
  -- El nombre SI lo ve el peluquero: necesita saber a quien le entrega el
  -- perrito. Lo que no puede es contactarlo por fuera.
  s.contacto_nombre,
  case when public.get_rol() = 'admin' then s.contacto_email end     as contacto_email,
  case when public.get_rol() = 'admin' then s.contacto_telefono end  as contacto_telefono,
  -- La comuna queda visible para todo el equipo: con ella no se contacta a
  -- nadie y las analiticas la agrupan.
  s.contacto_comuna,
  -- `notas_cliente` lleva "nombre - telefono - correo" cuando el endpoint de
  -- reservas cae al fallback. Es el mismo dato por otra puerta.
  case when public.get_rol() = 'admin' then s.notas_cliente end      as notas_cliente
from public.sesiones s
where
  -- Sigue siendo la puerta del equipo: un cliente no entra aca. Su propia cita
  -- la lee por `sesiones` con la policy de siempre, que esta migracion no
  -- toca, asi que /perfil no se entera de nada.
  public.get_rol() in ('admin', 'trabajador')
  and (
    -- El admin ve todo el local. Su vista "solo lo mio" es una preferencia de
    -- pantalla (?ver=mias), no un limite de acceso.
    public.get_rol() = 'admin'
    -- Sin asignar = de todos. Ver la nota de arriba.
    or s.peluquero_id is null
    -- Lo suyo, completo.
    or s.peluquero_id = auth.uid()
  );

alter view public.sesiones_equipo set (security_barrier = true);

-- EL GRANT. Sin esta linea nada de lo de arriba se puede leer.
grant select on public.sesiones_equipo to authenticated;

-- ── Verificacion ────────────────────────────────────────────────────────────
-- Que la vista exista NO prueba que se pueda leer, y que tenga el WHERE no
-- prueba que recorte. Lo que vale es correr esto con sesiones reales.
--
-- 1) La columna viaja:
-- select column_name from information_schema.columns
--  where table_name = 'sesiones_equipo' and column_name = 'peluquero_id';
--   -> una fila
--
-- 2) El privilegio quedo (esto es lo que se olvida):
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name = 'sesiones_equipo';
--   -> authenticated / SELECT
--
-- 3) Con la sesion de un TRABAJADOR:
-- select count(*) from public.sesiones_equipo where peluquero_id is not null
--   and peluquero_id <> auth.uid();
--   -> 0   (si da mas, el recorte no esta funcionando)
--
-- 4) Con la sesion del ADMIN, el mismo select debe poder dar > 0 en cuanto
--    haya citas asignadas a otro.
--
-- 5) Que no se rompio la privacidad de la 027, con sesion de trabajador:
-- select contacto_email, contacto_telefono, notas_cliente
--   from public.sesiones_equipo limit 3;   -> las tres columnas en NULL
