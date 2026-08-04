-- Bloqueos con horas y con dueño — pedido del 4-ago.
--
-- QUÉ FALTABA: `disponibilidad_excepciones` (026) bloquea un DÍA COMPLETO del
-- LOCAL ENTERO, y su clave primaria es la fecha, así que solo cabe un bloqueo
-- por día. Lo que se pidió es otra cosa:
--   · bloquear ciertas HORAS de un día, no el día entero;
--   · que el bloqueo sea de UN TRABAJADOR, no de todo el local;
--   · y que un trabajador bloqueado le reste cupo al cliente en esas horas.
-- Ninguna de las tres cabe con la fecha como clave. Por eso esto es una tabla
-- nueva y no columnas agregadas.
--
-- LO QUE NO CAMBIA: la regla de Rodolfo sigue en pie — un día libre NUNCA se
-- anuncia como "cerrado", al cliente le aparece que los cupos están tomados.
-- Por eso `mensaje` (público) y `nota_interna` (privada) siguen separados.

-- ── Tabla ───────────────────────────────────────────────────────────────────
create table if not exists public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,

  /* Horas del bloqueo. NULL en ambas = el día entero. Se guardan las dos o
     ninguna: media pareja describiría un rango sin final, y el motor de cupos
     tendría que inventar cuál es. */
  hora_inicio time,
  hora_fin    time,
  constraint bloqueos_horas_completas
    check ((hora_inicio is null) = (hora_fin is null)),
  constraint bloqueos_horas_ordenadas
    check (hora_inicio is null or hora_fin > hora_inicio),

  /* De quién es el bloqueo. NULL = del local entero (cierra para todos), que
     es como se comportaban las excepciones de la 026. ON DELETE CASCADE: si
     se borra el perfil, sus bloqueos se van con él en vez de quedar
     apuntando a nadie. */
  peluquero_id uuid references public.perfiles(id) on delete cascade,

  mensaje      text check (mensaje is null or length(trim(mensaje)) between 1 and 200),
  nota_interna text check (nota_interna is null or length(nota_interna) <= 200),

  /* Quién lo creó. Solo el admin bloquea (decisión del 4-ago), pero queda
     registro: "¿quién me cerró el martes?" es una pregunta que se hace. */
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en  timestamptz not null default now()
);

/* Sin índice, resolver los cupos de un mes recorre la tabla entera por cada
   consulta del formulario. */
create index if not exists bloqueos_fecha_idx on public.bloqueos (fecha);
create index if not exists bloqueos_peluquero_idx on public.bloqueos (peluquero_id, fecha);

/* Un mismo bloqueo cargado dos veces restaría cupo dos veces, y el día
   quedaría sin horas sin que nadie entienda por qué. El índice único trata
   los NULL como iguales (`nulls not distinct`), que es justo lo que hace
   falta: dos bloqueos "todo el día, todo el local" en la misma fecha son el
   mismo bloqueo. Requiere Postgres 15+, que es lo que corre Supabase. */
create unique index if not exists bloqueos_sin_duplicados
  on public.bloqueos (fecha, hora_inicio, hora_fin, peluquero_id) nulls not distinct;

comment on table public.bloqueos is
  'Bloqueos de agenda. Sin horas = día completo; sin peluquero_id = todo el local. Restan capacidad al motor de cupos.';

-- ── Traer lo que ya estaba ──────────────────────────────────────────────────
-- Las excepciones de la 026 son exactamente el caso "día completo, todo el
-- local". Se copian para que ningún día que Rodolfo ya cerró se reabra solo
-- al desplegar esto. La tabla vieja NO se borra: si algo saliera mal, los
-- datos originales siguen ahí.
insert into public.bloqueos (fecha, mensaje, nota_interna)
select e.fecha, e.mensaje, e.nota_interna
from public.disponibilidad_excepciones e
on conflict do nothing;

-- ── Privilegios: primero GRANT, después RLS ─────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant select on public.bloqueos to anon, authenticated, service_role;
grant insert, update, delete on public.bloqueos to authenticated, service_role;

alter table public.bloqueos enable row level security;

drop policy if exists bloqueos_lectura_equipo on public.bloqueos;
drop policy if exists bloqueos_escritura_admin on public.bloqueos;

/* NO hay lectura pública directa: la tabla lleva `nota_interna`, que es el
   motivo real ("hora médica") y desarma justamente lo que la regla del día
   libre busca esconder. El formulario público no lee esta tabla — usa las
   funciones de abajo, que devuelven solo lo justo.

   El equipo sí la lee: cada trabajador necesita ver su propio calendario
   completo, incluidos sus días libres (decisión del 4-ago). Ve los suyos y
   los del local; los del colega no. */
create policy bloqueos_lectura_equipo on public.bloqueos
  for select to authenticated
  using (
    public.get_rol() = 'admin'
    or peluquero_id is null
    or peluquero_id = auth.uid()
  );

-- Escribir es solo del admin, también decidido el 4-ago.
create policy bloqueos_escritura_admin on public.bloqueos
  for all to authenticated
  using (public.get_rol() = 'admin')
  with check (public.get_rol() = 'admin');

-- ── Lectura pública, acotada ────────────────────────────────────────────────
/* Cuántos atienden en un instante dado, ya descontados los bloqueados.
   Reemplaza el uso de `capacidad_paralela()` para el cálculo de cupos: esa
   devuelve un número fijo para todo horario y no sabe de bloqueos, así que
   con ella un peluquero de vacaciones seguía ofreciendo su cupo.

   Un bloqueo del local (peluquero_id null) cierra el instante completo:
   devuelve 0 y no hay cupo que ofrecer. */
create or replace function public.capacidad_en(instante timestamptz)
returns integer as $$
  select case
    when exists (
      select 1 from public.bloqueos b
      where b.peluquero_id is null
        and b.fecha = (instante at time zone 'America/Santiago')::date
        and (
          b.hora_inicio is null
          or (instante at time zone 'America/Santiago')::time >= b.hora_inicio
             and (instante at time zone 'America/Santiago')::time < b.hora_fin
        )
    ) then 0
    else greatest(
      public.capacidad_paralela() - (
        select count(distinct b.peluquero_id)::int
        from public.bloqueos b
        where b.peluquero_id is not null
          and b.fecha = (instante at time zone 'America/Santiago')::date
          and (
            b.hora_inicio is null
            or (instante at time zone 'America/Santiago')::time >= b.hora_inicio
               and (instante at time zone 'America/Santiago')::time < b.hora_fin
          )
      ),
      0
    )
  end;
$$ language sql security definer stable;

alter function public.capacidad_en(timestamptz) set search_path = public, pg_temp;
grant execute on function public.capacidad_en(timestamptz) to anon, authenticated;

/* Los bloqueos que le tocan al público en un rango, sin el motivo real.
   Devuelve las horas para que el formulario pueda tachar solo esas, en vez de
   cerrar el día entero como hacía `excepciones_en_rango`. */
create or replace function public.bloqueos_en_rango(desde date, hasta date)
returns table (fecha date, hora_inicio time, hora_fin time, es_del_local boolean, mensaje text) as $$
  select b.fecha,
         b.hora_inicio,
         b.hora_fin,
         b.peluquero_id is null,
         coalesce(nullif(trim(b.mensaje), ''), c.mensaje_dia_lleno)
  from public.bloqueos b, public.disponibilidad_config c
  where c.singleton
    and b.fecha >= desde
    and b.fecha <= hasta;
$$ language sql security definer stable;

alter function public.bloqueos_en_rango(date, date) set search_path = public, pg_temp;
grant execute on function public.bloqueos_en_rango(date, date) to anon, authenticated;

/* `excepciones_en_rango` (026) se mantiene porque el formulario ya la llama.
   Devuelve los días que quedan CERRADOS ENTEROS: bloqueo de todo el local sin
   horas. Los parciales ya no vacían el día — se resuelven por capacidad, hora
   por hora.

   LEE DE LAS DOS TABLAS, y eso no es duplicación por descuido. Esta migración
   se aplica sobre una producción cuyo panel todavía escribe los días libres en
   `disponibilidad_excepciones`. Si esta función leyera solo de `bloqueos`,
   entre aplicar el SQL y desplegar el panel nuevo quedaría una ventana en la
   que Rodolfo cierra un día y el cliente sigue viendo cupos: la peor forma de
   fallar, porque nadie se entera hasta que llegan dos perros a la vez. Con la
   unión, el día cerrado se respeta lo escriba quien lo escriba.

   El `union` (sin `all`) descarta el duplicado natural: la fecha copiada arriba
   está en las dos tablas. */
create or replace function public.excepciones_en_rango(desde date, hasta date)
returns table (fecha date, mensaje text) as $$
  select b.fecha,
         coalesce(nullif(trim(b.mensaje), ''), c.mensaje_dia_lleno)
  from public.bloqueos b, public.disponibilidad_config c
  where c.singleton
    and b.peluquero_id is null
    and b.hora_inicio is null
    and b.fecha between desde and hasta
  union
  select e.fecha,
         coalesce(nullif(trim(e.mensaje), ''), c.mensaje_dia_lleno)
  from public.disponibilidad_excepciones e, public.disponibilidad_config c
  where c.singleton
    and e.fecha between desde and hasta;
$$ language sql security definer stable;

alter function public.excepciones_en_rango(date, date) set search_path = public, pg_temp;
grant execute on function public.excepciones_en_rango(date, date) to anon, authenticated;

-- Verificación post-aplicación (correr a mano):
-- 1) los días ya cerrados se trajeron:
--    select count(*) from public.disponibilidad_excepciones;  -- N
--    select count(*) from public.bloqueos where peluquero_id is null and hora_inicio is null;  -- >= N
-- 2) la capacidad baja con un bloqueo de persona:
--    select public.capacidad_en(now());  -- capacidad normal
--    insert into public.bloqueos (fecha, peluquero_id)
--      select current_date, id from public.perfiles where es_peluquero limit 1;
--    select public.capacidad_en(now());  -- uno menos
--    delete from public.bloqueos where fecha = current_date and nota_interna is null;
-- 3) un bloqueo del local deja el instante en 0:
--    insert into public.bloqueos (fecha) values (current_date);
--    select public.capacidad_en(now());  -- 0
--    delete from public.bloqueos where fecha = current_date;
