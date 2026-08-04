-- Base para cerrar los pendientes de operación — 4-ago.
--
-- Reúne en una migración lo que faltaba de esquema para: asignar citas a un
-- peluquero, cobrar por servicio, subir fotos libres y comprobante de pago,
-- registrar atrasos, penalizar cancelaciones tardías y condicionar cupones.
--
-- TODO ES ADITIVO Y NEUTRO DE FÁBRICA. Ninguna columna se borra y ningún valor
-- sembrado cobra de más: los recargos nacen en 0 y la política nace apagada.
-- La capacidad queda instalada y el dueño decide cuándo y cuánto. En este
-- proyecto un valor por defecto que nadie comunicó ya mandó reservas reales a
-- un número equivocado durante semanas; no se repite.
--
-- GRANT ANTES QUE POLICY, siempre: Postgres evalúa los privilegios de tabla
-- ANTES que RLS, y una policy perfecta sobre una tabla sin GRANT devuelve
-- 42501 con un síntoma que no se parece a la causa.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ASIGNAR CITAS A UN PELUQUERO
-- ════════════════════════════════════════════════════════════════════════════
-- Sin esto no existe "la agenda de cada uno": las citas no tienen dueño, así
-- que no hay nada que mostrarle a un trabajador ni que ocultarle del colega.
-- El admin es quien asigna (decidido el 4-ago).
alter table public.sesiones
  add column if not exists peluquero_id uuid references public.perfiles(id) on delete set null;

-- ON DELETE SET NULL y no CASCADE: si se va un peluquero, sus citas quedan sin
-- asignar y alguien las reparte. Borrarlas sería perder historial y plata.

create index if not exists sesiones_peluquero_idx
  on public.sesiones (peluquero_id, fecha_cita);

comment on column public.sesiones.peluquero_id is
  'Quien atiende esta cita. NULL = sin asignar. El admin asigna desde el panel.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. PRECIO POR SERVICIO
-- ════════════════════════════════════════════════════════════════════════════
-- Hoy el precio sale del peso y sus ajustes, y `data.servicio` no se lee nunca
-- al cotizar: un "Spa completo" y un "Solo uñas" del mismo perro cuestan igual.
-- Se agrega como ajuste sobre la base, con la misma forma que el resto.
create table if not exists public.servicios_precio (
  -- La clave es el slug del servicio en lib/servicios.ts.
  slug       text primary key check (length(trim(slug)) > 0),
  nombre     text not null check (length(trim(nombre)) > 0),
  -- Puede ser negativo: "solo uñas" cuesta menos que el baño completo.
  pct        numeric(5,2) not null default 0,
  monto      integer not null default 0,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

comment on table public.servicios_precio is
  'Ajuste de precio por servicio, sobre el precio del peso. pct y monto en 0 = el servicio no cambia el precio.';

-- Los servicios que hoy muestra la web, todos en 0. El dueño pone sus valores.
insert into public.servicios_precio (slug, nombre, pct, monto)
values
  ('bano-completo',       'Baño completo',        0, 0),
  ('bano-y-corte',        'Baño y corte de pelo', 0, 0),
  ('spa-completo',        'Spa completo',         0, 0),
  ('solo-unas',           'Solo uñas',            0, 0),
  ('retiro-y-entrega',    'Retiro y entrega',     0, 0)
on conflict (slug) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. FOTOS LIBRES Y COMPROBANTE DE PAGO
-- ════════════════════════════════════════════════════════════════════════════
-- El CHECK cerraba los tipos a antes/durante/despues/referencia, y el panel
-- además forzaba 'despues' en cada subida. Se amplía para que el equipo suba
-- lo que necesite y se agrega el comprobante.
alter table public.fotos_sesion drop constraint if exists fotos_sesion_tipo_check;

alter table public.fotos_sesion
  add constraint fotos_sesion_tipo_check
  check (tipo in ('antes','durante','despues','referencia','extra','comprobante'));

-- El comprobante lleva datos de pago, así que se marca aparte para poder
-- tratarlo con otro criterio de visibilidad que las fotos del perrito.
comment on column public.fotos_sesion.tipo is
  'antes/durante/despues/referencia/extra = fotos del perrito. comprobante = respaldo de pago, NO se muestra al cliente en la galería.';

-- ════════════════════════════════════════════════════════════════════════════
-- 4. POLÍTICA DE ATRASOS Y CANCELACIONES
-- ════════════════════════════════════════════════════════════════════════════
-- Reglas confirmadas el 4-ago: tolerancia de 30 min que ya cuesta $2.500
-- (tasa de referencia $5.000/hora prorrateada), cancelación gratis salvo
-- dentro de las 24 h previas —que deja +30 % en la SIGUIENTE cita— y pérdida
-- del cupón al cancelar.
--
-- NACE APAGADA (`activa = false`). El recargo solo es defendible si el cliente
-- lo aceptó al reservar, y hoy el formulario todavía no lo dice. Encenderla
-- antes de comunicarlo significa que el cliente se entera con la cuenta en la
-- puerta.
create table if not exists public.politica_citas (
  singleton boolean primary key default true check (singleton),

  activa boolean not null default false,

  -- Atrasos
  tolerancia_min      integer not null default 30 check (tolerancia_min >= 0),
  recargo_atraso_hora integer not null default 5000 check (recargo_atraso_hora >= 0),

  -- Cancelaciones
  cancelacion_horas   integer not null default 24 check (cancelacion_horas >= 0),
  cancelacion_pct     numeric(5,2) not null default 30 check (cancelacion_pct >= 0),
  pierde_cupon        boolean not null default true,

  -- Lo que se le muestra al cliente ANTES de reservar. Si está vacío, la
  -- pantalla no promete nada y la política no debería encenderse.
  texto_cliente text not null default
    'Le esperamos hasta 30 minutos. Pasado ese tiempo se aplica un recargo proporcional ($5.000 por hora) y la entrega se corre. Puede cancelar gratis desde su correo hasta 24 horas antes; después, su próxima cita tendrá un recargo del 30% y se pierde el cupón usado.',

  actualizado_en timestamptz not null default now()
);

insert into public.politica_citas (singleton) values (true)
on conflict (singleton) do nothing;

comment on table public.politica_citas is
  'Reglas de atraso y cancelación. `activa = false` de fábrica: no se cobra nada hasta que el dueño la encienda Y el formulario lo comunique.';

-- ── Registro de llegada ──────────────────────────────────────────────────────
-- El recargo por atraso no se puede calcular solo: necesita que alguien marque
-- a qué hora llegó el cliente. Sin esta columna la regla no tiene de dónde
-- sacar los minutos.
alter table public.sesiones
  add column if not exists llegada_en timestamptz,
  add column if not exists recargo_atraso integer not null default 0 check (recargo_atraso >= 0),
  -- El sistema PROPONE y el equipo confirma (decidido el 4-ago): nunca cobra
  -- solo. NULL = todavía nadie decidió; false = se perdonó.
  add column if not exists recargo_aceptado boolean;

comment on column public.sesiones.llegada_en is
  'Hora real de llegada, marcada por el equipo. Sin esto no se puede calcular el atraso.';
comment on column public.sesiones.recargo_aceptado is
  'NULL = sin decidir. true = se cobra. false = se perdonó. El sistema propone, el equipo confirma.';

-- ── Cancelar desde el correo ─────────────────────────────────────────────────
-- Un token por cita para que el cliente cancele con un enlace, sin cuenta y
-- sin exponer el id de la sesión.
alter table public.sesiones
  add column if not exists token_cancelacion uuid not null default gen_random_uuid(),
  add column if not exists cancelada_en timestamptz;

create unique index if not exists sesiones_token_cancelacion_idx
  on public.sesiones (token_cancelacion);

-- ── Penalización arrastrada a la próxima cita ────────────────────────────────
-- Se guarda por correo + teléfono porque el cliente puede no tener cuenta
-- (decidido el 4-ago). Se consume UNA vez y no se acumula.
create table if not exists public.penalizaciones (
  id uuid primary key default gen_random_uuid(),
  -- Normalizados en minúsculas/sin espacios al escribir, para que el match no
  -- falle por un mayúscula de diferencia.
  email    text not null check (length(trim(email)) > 0),
  telefono text not null check (length(trim(telefono)) > 0),
  pct      numeric(5,2) not null check (pct > 0),
  motivo   text not null default 'cancelacion_tardia',
  origen_sesion_id uuid references public.sesiones(id) on delete set null,
  creada_en   timestamptz not null default now(),
  -- NULL = todavía pendiente de aplicar.
  consumida_en timestamptz,
  consumida_en_sesion_id uuid references public.sesiones(id) on delete set null
);

create index if not exists penalizaciones_pendientes_idx
  on public.penalizaciones (email, telefono) where consumida_en is null;

comment on table public.penalizaciones is
  'Recargo arrastrado a la proxima cita por cancelar tarde. Se identifica por email+telefono porque el cliente puede no tener cuenta. Se consume una vez, no se acumula.';

-- ════════════════════════════════════════════════════════════════════════════
-- 5. CUPONES CON CONDICIONES
-- ════════════════════════════════════════════════════════════════════════════
-- La tabla `cupones` solo tenía codigo/descripcion/descuento_pct/activo: sin
-- vigencia, sin tope de usos y sin ninguna condición. Se agregan las que se
-- pidieron —anticipación y número de visita— más las que evitan que un código
-- filtrado se use sin fin.
alter table public.cupones
  add column if not exists vigente_desde date,
  add column if not exists vigente_hasta date,
  -- NULL = sin tope.
  add column if not exists max_usos integer check (max_usos is null or max_usos > 0),
  add column if not exists usos integer not null default 0 check (usos >= 0),
  -- Condiciones pedidas el 4-ago.
  add column if not exists dias_anticipacion_min integer check (dias_anticipacion_min is null or dias_anticipacion_min >= 0),
  add column if not exists desde_visita integer check (desde_visita is null or desde_visita >= 1),
  add column if not exists hasta_visita integer check (hasta_visita is null or hasta_visita >= 1),
  add column if not exists solo_con_cuenta boolean not null default false,
  -- NULL = sirve para cualquier servicio.
  add column if not exists servicio_slug text;

comment on column public.cupones.dias_anticipacion_min is
  'Minimo de dias entre la reserva y la cita para que el cupon aplique. NULL = sin exigencia.';
comment on column public.cupones.desde_visita is
  'Numero de visita del cliente desde el que aplica. 2 = a partir de la segunda cita. NULL = cualquiera.';

-- ════════════════════════════════════════════════════════════════════════════
-- 6. PRIVILEGIOS Y RLS
-- ════════════════════════════════════════════════════════════════════════════
grant usage on schema public to anon, authenticated, service_role;

-- ── servicios_precio: publico lee (el formulario cotiza), admin escribe ──────
grant select on public.servicios_precio to anon, authenticated, service_role;
grant insert, update, delete on public.servicios_precio to authenticated, service_role;

alter table public.servicios_precio enable row level security;

drop policy if exists servicios_precio_lectura on public.servicios_precio;
drop policy if exists servicios_precio_escritura on public.servicios_precio;

create policy servicios_precio_lectura on public.servicios_precio
  for select using (true);

create policy servicios_precio_escritura on public.servicios_precio
  for all to authenticated
  using (public.get_rol() = 'admin')
  with check (public.get_rol() = 'admin');

-- ── politica_citas: publico lee (hay que mostrarsela ANTES de reservar) ──────
grant select on public.politica_citas to anon, authenticated, service_role;
grant insert, update on public.politica_citas to authenticated, service_role;

alter table public.politica_citas enable row level security;

drop policy if exists politica_citas_lectura on public.politica_citas;
drop policy if exists politica_citas_escritura on public.politica_citas;

-- Se lee en publico a proposito: una regla que cobra y que el cliente no puede
-- leer antes de reservar no es defendible.
create policy politica_citas_lectura on public.politica_citas
  for select using (true);

create policy politica_citas_escritura on public.politica_citas
  for all to authenticated
  using (public.get_rol() = 'admin')
  with check (public.get_rol() = 'admin');

-- ── penalizaciones: NADA de lectura publica ─────────────────────────────────
-- Lleva correo y telefono de clientes: exponerla filtraria la base de contactos
-- entera. El formulario no la consulta directamente; usa la funcion de abajo,
-- que responde si/no sin devolver datos de nadie.
grant select, insert, update on public.penalizaciones to authenticated, service_role;

alter table public.penalizaciones enable row level security;

drop policy if exists penalizaciones_equipo on public.penalizaciones;

create policy penalizaciones_equipo on public.penalizaciones
  for all to authenticated
  using (public.get_rol() in ('admin','trabajador'))
  with check (public.get_rol() in ('admin','trabajador'));

-- ════════════════════════════════════════════════════════════════════════════
-- 7. FUNCIONES
-- ════════════════════════════════════════════════════════════════════════════

-- Cuanto recargo arrastra un cliente, sin exponer la tabla. Devuelve 0 si no
-- tiene ninguno pendiente. SECURITY DEFINER para que el formulario publico
-- pueda preguntarlo sin poder leer contactos.
create or replace function public.penalizacion_pendiente(p_email text, p_telefono text)
returns numeric as $penalizacion$
  select coalesce(max(p.pct), 0)
  from public.penalizaciones p
  where p.consumida_en is null
    and lower(trim(p.email)) = lower(trim(p_email))
    and regexp_replace(p.telefono, '[^0-9]', '', 'g')
        = regexp_replace(p_telefono, '[^0-9]', '', 'g');
$penalizacion$ language sql security definer stable;

-- El match del telefono ignora espacios, guiones y el prefijo escrito de
-- distinta forma: comparar "+56 9 1234 5678" con "912345678" como texto plano
-- fallaria siempre, y el recargo no se aplicaria nunca sin que nadie note por que.

alter function public.penalizacion_pendiente(text, text) set search_path = public, pg_temp;
grant execute on function public.penalizacion_pendiente(text, text) to anon, authenticated;

-- Cancela una cita con su token, sin sesion. Devuelve el resultado en JSON
-- para que la ruta pueda contarle al cliente que paso: si quedo penalizado y
-- si perdio el cupon. Nunca falla en silencio.
create or replace function public.cancelar_con_token(p_token uuid)
returns jsonb as $cancelar$
declare
  s record;
  pol record;
  horas_faltantes numeric;
  penaliza boolean := false;
  pierde boolean := false;
begin
  select * into s from public.sesiones where token_cancelacion = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrada');
  end if;
  if s.estado = 'cancelada' then
    return jsonb_build_object('ok', false, 'motivo', 'ya_cancelada');
  end if;
  if s.fecha_cita is not null and s.fecha_cita < now() then
    return jsonb_build_object('ok', false, 'motivo', 'ya_paso');
  end if;

  select * into pol from public.politica_citas where singleton;

  -- La penalizacion solo corre con la politica encendida. Apagada, cancelar
  -- siempre es gratis.
  if pol.activa and s.fecha_cita is not null then
    horas_faltantes := extract(epoch from (s.fecha_cita - now())) / 3600.0;
    penaliza := horas_faltantes < pol.cancelacion_horas;
    pierde := pol.pierde_cupon and s.cupon_codigo is not null;
  end if;

  update public.sesiones
     set estado = 'cancelada',
         cancelada_en = now()
   where id = s.id;

  if penaliza and coalesce(trim(s.contacto_email), '') <> ''
     and coalesce(trim(s.contacto_telefono), '') <> '' then
    insert into public.penalizaciones (email, telefono, pct, origen_sesion_id)
    values (lower(trim(s.contacto_email)), trim(s.contacto_telefono),
            pol.cancelacion_pct, s.id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'penalizada', penaliza,
    'pct', case when penaliza then pol.cancelacion_pct else 0 end,
    'pierde_cupon', pierde,
    'cupon', case when pierde then s.cupon_codigo else null end
  );
end;
$cancelar$ language plpgsql security definer;

alter function public.cancelar_con_token(uuid) set search_path = public, pg_temp;
grant execute on function public.cancelar_con_token(uuid) to anon, authenticated;

-- ── Los bloqueos que afectan al cliente, agregados ──────────────────────────
-- `bloqueos_en_rango` (034) devuelve una fila por bloqueo, sin decir cuantos
-- peluqueros quedan fuera. El formulario necesita ese numero para descontar
-- cupos, pero NO debe saber quien es quien: la agenda de cada trabajador es
-- suya. Por eso se devuelve el CONTEO y nunca el peluquero_id.
create or replace function public.bloqueos_agregados(desde date, hasta date)
returns table (
  fecha date,
  hora_inicio time,
  hora_fin time,
  cierra_local boolean,
  peluqueros_bloqueados integer,
  mensaje text
) as $agregados$
  select b.fecha,
         b.hora_inicio,
         b.hora_fin,
         bool_or(b.peluquero_id is null),
         count(distinct b.peluquero_id)::int,
         coalesce(nullif(trim(min(b.mensaje)), ''), min(c.mensaje_dia_lleno))
  from public.bloqueos b, public.disponibilidad_config c
  where c.singleton
    and b.fecha between desde and hasta
  group by b.fecha, b.hora_inicio, b.hora_fin;
$agregados$ language sql security definer stable;

alter function public.bloqueos_agregados(date, date) set search_path = public, pg_temp;
grant execute on function public.bloqueos_agregados(date, date) to anon, authenticated;
