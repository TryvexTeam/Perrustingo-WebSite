-- Tramos de precio por peso — pedido del cliente (audio del 27-jul).
--
-- POR QUÉ: los cinco tamaños fijos cobraban de menos en los bordes. Probando la
-- página él mismo, un perrito de 8 kg caía en "Pequeño (6–10 kg)" y salía
-- $20.000 cuando debería estar entre $25.000 y $30.000. El problema de fondo no
-- era el número sino que los cortes vivían en el código: ajustar un precio
-- exigía un despliegue. Con esta tabla se ajustan desde el panel.
--
-- EL MODELO: cada tramo declara SOLO desde qué peso rige. El "hasta" se deriva
-- del tramo siguiente. Así un hueco de cobertura no se puede ni escribir — no
-- hay un segundo número que dejar mal puesto. La tabla vieja ya tenía ese
-- defecto (toy [0,5] y pequeno [6,10] dejan el medio kilo intermedio sin dueño).
--
-- GRANT ANTES QUE POLICY: Postgres evalúa los privilegios de tabla ANTES que
-- RLS. Una policy perfecta sobre una tabla sin GRANT devuelve 42501 y el síntoma
-- no se parece en nada a la causa. Ya pasó tres veces en este proyecto.

create table if not exists public.tramos_precio (
  id         uuid primary key default gen_random_uuid(),
  nombre     text    not null check (length(trim(nombre)) > 0),
  -- Inclusive. El primer tramo debe ser 0 para que ningún perrito quede fuera;
  -- lo exige `validar()` en lib/tramos.ts antes de guardar.
  desde_kg   numeric(5,1) not null check (desde_kg >= 0),
  precio     integer not null check (precio > 0),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now(),
  -- Dos tramos que arranquen en el mismo peso darían dos precios al mismo
  -- perrito, y el desempate sería arbitrario. Se prohíbe en la base, no solo en
  -- la UI: la validación del formulario protege al que usa el panel, la
  -- restricción protege los datos.
  unique (desde_kg)
);

create index if not exists tramos_precio_orden_idx on public.tramos_precio (desde_kg);

comment on table public.tramos_precio is
  'Tramos de precio por peso. Cada fila declara solo el borde INFERIOR; el superior se deriva del tramo siguiente, de modo que no puedan existir huecos de cobertura.';

-- Semilla con los cortes que pidió el cliente.
-- OJO: los PRECIOS son provisionales — derivados de la tabla vigente para que
-- ningún peso quede sin valor. El cliente trae los definitivos a la reunión y
-- los cambia desde el panel sin tocar código.
insert into public.tramos_precio (nombre, desde_kg, precio)
values
  ('Mini / Toy',      0,  18000),
  ('Toy grande',      3,  20000),
  ('Pequeño',         5,  22000),
  ('Pequeño grande',  8,  25000),
  ('Mediano',        10,  28000),
  ('Mediano grande', 15,  32000),
  ('Grande',         20,  40000),
  ('Extra grande',   40,  60000),
  ('Gigante',        60,  80000)
on conflict (desde_kg) do nothing;

-- ── Privilegios: primero GRANT, después RLS ─────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;

-- El formulario público necesita LEER para cotizar; escribir es solo del panel.
grant select on public.tramos_precio to anon, authenticated, service_role;
grant insert, update, delete on public.tramos_precio to authenticated, service_role;

alter table public.tramos_precio enable row level security;

drop policy if exists tramos_precio_lectura_publica on public.tramos_precio;
drop policy if exists tramos_precio_escritura_admin on public.tramos_precio;

-- Cualquiera cotiza (mismo criterio que la tabla `tarifas`, que ya es de
-- lectura libre: los precios se muestran en la página pública de todos modos).
create policy tramos_precio_lectura_publica on public.tramos_precio
  for select using (true);

-- Escribir exige rol admin. Se usa `public.get_rol()`, el mismo helper que la
-- tabla `tarifas` (migración 006), en vez de un subquery a `perfiles`: leer
-- `perfiles` desde una policy puede caer en recursión de RLS, y el helper ya
-- resuelve eso de una sola forma para todo el proyecto. Un segundo criterio de
-- admin conviviendo con el primero es un agujero esperando a que los dos se
-- separen.
create policy tramos_precio_escritura_admin on public.tramos_precio
  for all using (public.get_rol() = 'admin');
