-- Horario propio de cada peluquero — 5-ago.
--
-- QUÉ FALTABA: los tramos de `disponibilidad_tramos` son del LOCAL. Dicen "los
-- martes se atiende de 9 a 19" y valen igual para todos. Con eso, si alguien
-- trabaja solo de tarde, o entra más tarde los lunes, o para a almorzar, la
-- única forma de reflejarlo era cargarle un bloqueo a mano cada semana. Rodolfo
-- pidió poder dejarlo escrito una vez: qué días trabaja cada persona, entre qué
-- horas, y con su colación.
--
-- POR QUÉ TRAMOS Y NO "jornada + colación": una colación se expresa partiendo
-- la jornada en dos tramos (9–13 y 14–18). Guardar un campo aparte para el
-- descanso obligaría a definir qué pasa si cae fuera de la jornada, si hay dos,
-- o si alguien trabaja de corrido. Con tramos no hay caso raro que inventar: lo
-- que no está cubierto, no se trabaja. El panel igual lo ofrece en palabras
-- ("almuerzo"), pero lo que se guarda son las horas que SÍ atiende.
--
-- NEUTRO DE FÁBRICA, y esto es lo importante: quien no tenga ninguna fila acá
-- sigue contando como que trabaja todo el horario del local, que es lo que pasa
-- hoy. La tabla nace vacía, así que el día que se aplique esta migración NADA
-- cambia para el cliente. La capacidad se empieza a recortar recién cuando
-- alguien configura su horario. En este proyecto un valor por defecto que nadie
-- comunicó ya mandó reservas reales a un número equivocado; acá el silencio
-- significa "como estaba", nunca "cerrado".
--
-- GRANT ANTES QUE POLICY, como siempre: Postgres evalúa los privilegios de
-- tabla ANTES que RLS, y una policy perfecta sobre una tabla sin GRANT devuelve
-- 42501 con un síntoma que no se parece a la causa. Van cinco veces.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. LA TABLA
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.horarios_peluquero (
  id uuid primary key default gen_random_uuid(),

  peluquero_id uuid not null references public.perfiles(id) on delete cascade,

  -- 0 = domingo … 6 = sábado. Mismo criterio que `disponibilidad_tramos` y que
  -- `Date.getDay()` en el navegador: cambiarlo acá obligaría a traducir en
  -- todos los bordes y ahí es donde se cuelan los errores de un día.
  dia_semana smallint not null check (dia_semana between 0 and 6),

  hora_inicio time not null,
  hora_fin    time not null,

  -- Se puede apagar un tramo sin borrarlo: "este mes no hace los sábados".
  activo boolean not null default true,

  creado_en timestamptz not null default now(),

  -- Un tramo al revés no es un horario raro, es un error de tipeo. Y uno vacío
  -- (9 a 9) tampoco existe: no se atiende ningún minuto.
  constraint horario_tramo_con_sentido check (hora_inicio < hora_fin)
);

-- ON DELETE CASCADE, a diferencia de `sesiones.peluquero_id`: el horario de
-- alguien que ya no está no es historial que valga la pena conservar, mientras
-- que sus citas sí lo son (ahí quedó plata y trabajo hecho).

create index if not exists horarios_peluquero_idx
  on public.horarios_peluquero (peluquero_id, dia_semana) where activo;

comment on table public.horarios_peluquero is
  'Que dias y horas trabaja cada peluquero. Una persona SIN filas trabaja todo el horario del local: la ausencia significa "como estaba", nunca "no trabaja".';

comment on column public.horarios_peluquero.dia_semana is
  '0 = domingo ... 6 = sabado, igual que Date.getDay() y que disponibilidad_tramos.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. PRIVILEGIOS Y RLS
-- ════════════════════════════════════════════════════════════════════════════
grant usage on schema public to anon, authenticated, service_role;

-- Nada de lectura para `anon`. La tabla dice quién trabaja cuándo, y eso es
-- información del equipo: el formulario público solo necesita saber CUÁNTOS
-- atienden a cada hora, y para eso está la función agregada de más abajo.
grant select on public.horarios_peluquero to authenticated, service_role;
grant insert, update, delete on public.horarios_peluquero to authenticated, service_role;

alter table public.horarios_peluquero enable row level security;

drop policy if exists horarios_lectura_equipo on public.horarios_peluquero;
drop policy if exists horarios_escritura_admin on public.horarios_peluquero;

-- El equipo lee todos los horarios: saber a qué hora entra el colega es
-- coordinación del día, no un dato sensible —a diferencia de las citas, que
-- llevan cliente y plata y por eso la 038 sí las segrega.
create policy horarios_lectura_equipo on public.horarios_peluquero
  for select to authenticated
  using (public.get_rol() in ('admin', 'trabajador'));

-- Escribe solo el admin. El horario define cuánta capacidad ve el cliente:
-- si cada persona pudiera editar el suyo, cualquiera podría cerrarse la agenda
-- —o abrirse horas que nadie acordó— sin que el dueño se entere.
create policy horarios_escritura_admin on public.horarios_peluquero
  for all to authenticated
  using (public.get_rol() = 'admin')
  with check (public.get_rol() = 'admin');

-- ════════════════════════════════════════════════════════════════════════════
-- 3. LO QUE VE EL FORMULARIO PÚBLICO
-- ════════════════════════════════════════════════════════════════════════════
-- Devuelve, por día de la semana y tramo, CUÁNTA gente atiende — nunca quién.
-- Es el mismo criterio que `bloqueos_agregados` (035): el cliente necesita el
-- número para saber si queda cupo, y no tiene por qué saber el nombre de nadie
-- ni a qué hora entra cada uno.
--
-- También devuelve cuántos peluqueros NO configuraron horario, porque esos
-- siguen contando como disponibles todo el día y sin ese número la capacidad
-- daría de menos apenas se configure al primero.
create or replace function public.horarios_agregados()
returns table (
  dia_semana smallint,
  hora_inicio time,
  hora_fin time,
  peluqueros integer
) as $horarios$
  select h.dia_semana,
         h.hora_inicio,
         h.hora_fin,
         count(distinct h.peluquero_id)::int
  from public.horarios_peluquero h
  join public.perfiles p on p.id = h.peluquero_id and p.es_peluquero
  where h.activo
  group by h.dia_semana, h.hora_inicio, h.hora_fin;
$horarios$ language sql security definer stable;

alter function public.horarios_agregados() set search_path = public, pg_temp;
grant execute on function public.horarios_agregados() to anon, authenticated;

-- Cuántos peluqueros hay en total y cuántos tienen horario propio. Con estos
-- dos números el formulario sabe cuántos son "de horario del local" sin poder
-- listar a nadie.
create or replace function public.peluqueros_resumen()
returns table (
  total integer,
  con_horario integer
) as $resumen$
  select count(*)::int,
         count(*) filter (
           where exists (
             select 1 from public.horarios_peluquero h
             where h.peluquero_id = p.id and h.activo
           )
         )::int
  from public.perfiles p
  where p.es_peluquero;
$resumen$ language sql security definer stable;

alter function public.peluqueros_resumen() set search_path = public, pg_temp;
grant execute on function public.peluqueros_resumen() to anon, authenticated;

-- ── Verificación ────────────────────────────────────────────────────────────
-- Que la tabla exista NO prueba que se pueda escribir ni que el público pueda
-- consultar el agregado. Lo que vale es esto:
--
--   -- (a) privilegios reales
--   select grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_name = 'horarios_peluquero'
--      and grantee in ('anon','authenticated','service_role')
--    order by 1, 2;
--   -- Se espera: authenticated y service_role con SELECT/INSERT/UPDATE/DELETE.
--   -- anon NO debe aparecer: el horario de cada persona no es público.
--
--   -- (b) el agregado responde y no filtra a nadie
--   select * from public.horarios_agregados();
--   select * from public.peluqueros_resumen();
--   -- Con la tabla vacía: cero filas y `con_horario = 0`. Eso es lo correcto
--   -- recién aplicada: significa "todos siguen con el horario del local".
--
--   -- (c) el CHECK atrapa el tramo al reves (debe FALLAR)
--   insert into public.horarios_peluquero (peluquero_id, dia_semana, hora_inicio, hora_fin)
--   select id, 1, '18:00', '09:00' from public.perfiles where es_peluquero limit 1;
--   -- Se espera: error de `horario_tramo_con_sentido`. Si entra, el CHECK no quedo.
