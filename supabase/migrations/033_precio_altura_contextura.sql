-- Altura y contextura pasan a mover el precio (pedido del 4-ago).
--
-- POR QUÉ: el formulario ya le pregunta al cliente la altura y la contextura
-- del perrito, y hasta hoy ninguna de las dos tocaba el precio — se pedían
-- datos para nada. Dos perros de 10 kg no dan el mismo trabajo si uno es un
-- galgo alto y delgado y el otro un bulldog bajo y robusto.
--
-- NEUTRO DE FÁBRICA — esto es lo importante de esta migración. Todos los
-- valores se siembran en 0: la capacidad queda instalada y el precio NO se
-- mueve hasta que el dueño ponga sus números en el panel. Sembrar un
-- porcentaje "razonable" inventado por nosotros significaría cobrarle de más
-- a clientes reales desde el deploy sin que nadie lo haya decidido. En este
-- proyecto un valor por defecto silencioso ya mandó reservas reales a un
-- número equivocado durante semanas; no se repite.
--
-- GRANT ANTES QUE POLICY: Postgres evalúa los privilegios de tabla ANTES que
-- RLS. Una policy perfecta sobre una tabla sin GRANT devuelve 42501 y el
-- síntoma no se parece a la causa. Ya pasó tres veces acá.

-- ── Contextura ──────────────────────────────────────────────────────────────
-- Encaja en `ajustes_precio` (migración 007) sin tabla nueva: es exactamente
-- la misma forma que los recargos por pelo o temperamento — una clave cerrada
-- con un porcentaje. Las tres claves son las del formulario.
--
-- La 007 dejó `categoria` con un CHECK cerrado a cinco valores, así que hay
-- que ampliarlo ANTES de insertar o el insert muere por violación de check.
--
-- El constraint se busca por su DEFINICIÓN, no por su nombre: el de la 007 es
-- un check de columna con nombre autogenerado, y dar por sentado que se llama
-- `ajustes_precio_categoria_check` tiene un modo de fallo silencioso feo — si
-- el nombre real fuera otro, el DROP IF EXISTS no haría nada, el ADD crearía
-- un segundo check, y el viejo seguiría rechazando 'contextura'. La migración
-- "correría bien" y el insert de abajo moriría sin que el nombre lo explique.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.ajustes_precio'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%categoria%'
  loop
    execute format('alter table public.ajustes_precio drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.ajustes_precio
  add constraint ajustes_precio_categoria_check
  check (categoria in ('pelo','temperamento','zona_sensible','cachorro','primera_cita','contextura'));

insert into public.ajustes_precio (categoria, clave, etiqueta, pct, activo, tipo, monto)
values
  ('contextura', 'delgado', 'Contextura delgada', 0, true, 'pct', null),
  ('contextura', 'normal',  'Contextura normal',  0, true, 'pct', null),
  ('contextura', 'robusto', 'Contextura robusta', 0, true, 'pct', null)
on conflict (categoria, clave) do nothing;

-- ── Altura ──────────────────────────────────────────────────────────────────
-- Misma forma que `tramos_precio` (migración 032): cada fila declara SOLO el
-- borde inferior y el superior se deriva del tramo siguiente, de modo que un
-- hueco de cobertura no se pueda ni escribir. La diferencia es qué aporta la
-- fila: `tramos_precio` fija el precio base, esta ajusta ese precio.
create table if not exists public.tramos_altura (
  id         uuid primary key default gen_random_uuid(),
  nombre     text    not null check (length(trim(nombre)) > 0),
  -- Inclusive. El primer tramo debe ser 0 para que ninguna altura quede fuera.
  desde_cm   numeric(5,1) not null check (desde_cm >= 0),
  -- Puede ser negativo: un perro muy bajo podría descontar.
  pct        numeric(5,2) not null default 0,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now(),
  -- Dos tramos en el mismo borde darían dos ajustes al mismo perrito y el
  -- desempate sería arbitrario. Se prohíbe en la base, no solo en la UI.
  unique (desde_cm)
);

create index if not exists tramos_altura_orden_idx on public.tramos_altura (desde_cm);

comment on table public.tramos_altura is
  'Ajuste de precio por altura. Cada fila declara solo el borde INFERIOR; el superior se deriva del tramo siguiente, de modo que no puedan existir huecos. pct = 0 significa que la altura no mueve el precio.';

-- Un único tramo que cubre todas las alturas con ajuste 0: la altura queda
-- conectada al precio pero sin efecto. El dueño parte de acá y agrega los
-- cortes que quiera desde el panel.
insert into public.tramos_altura (nombre, desde_cm, pct)
values ('Todas las alturas', 0, 0)
on conflict (desde_cm) do nothing;

-- ── Privilegios: primero GRANT, después RLS ─────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

-- El formulario público necesita LEER para cotizar; escribir es solo del panel.
grant select on public.tramos_altura to anon, authenticated, service_role;
grant insert, update, delete on public.tramos_altura to authenticated, service_role;

alter table public.tramos_altura enable row level security;

drop policy if exists tramos_altura_lectura_publica on public.tramos_altura;
drop policy if exists tramos_altura_escritura_admin on public.tramos_altura;

create policy tramos_altura_lectura_publica on public.tramos_altura
  for select using (true);

-- Mismo helper `public.get_rol()` que usan `tarifas` y `tramos_precio`, en vez
-- de un subquery a `perfiles` que puede caer en recursión de RLS. Un segundo
-- criterio de admin conviviendo con el primero es un agujero esperando a que
-- los dos se separen.
create policy tramos_altura_escritura_admin on public.tramos_altura
  for all using (public.get_rol() = 'admin');
