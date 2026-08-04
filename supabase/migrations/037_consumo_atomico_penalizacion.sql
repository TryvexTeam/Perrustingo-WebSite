-- Consumo atómico de la penalización arrastrada — 4-ago.
--
-- QUÉ ESTABA ROTO: la 035 creó `penalizaciones` con dos columnas para cerrar el
-- ciclo —`consumida_en` y `consumida_en_sesion_id`— y NINGÚN archivo del código
-- las escribía. `penalizacion_pendiente` solo respondía cuánto arrastraba el
-- cliente, la ruta de reservas lo devolvía como dato informativo y ahí moría: el
-- recargo no entraba al precio y la fila quedaba pendiente para siempre. Eso
-- contradice de frente la regla del dueño —"una sola vez, no acumulativo"—:
-- alguien que canceló tarde una vez arrastraba el recargo en todas sus reservas
-- futuras, o en ninguna, según a quién le tocara mirarlo.
--
-- POR QUÉ UNA FUNCIÓN Y NO UN UPDATE DESDE LA APLICACIÓN: dos reservas
-- simultáneas del mismo cliente —dos pestañas, un doble clic, un reintento del
-- navegador— leerían las dos la misma fila pendiente, las dos aplicarían el
-- recargo y las dos la marcarían consumida. Se cobraría dos veces algo que por
-- definición se cobra una. Leer-y-después-escribir desde la aplicación no puede
-- resolverlo: entre la lectura y la escritura hay una ventana, y esa ventana es
-- exactamente el bug. Acá el reclamo es UNA sentencia con `for update skip
-- locked`: la primera transacción se lleva la fila, la segunda no la ve
-- disponible y se va con 0.
--
-- GRANT ANTES QUE POLICY: Postgres evalúa los privilegios ANTES que RLS, y en
-- este proyecto ya costó cuatro bugs. Acá además se hace al revés de lo
-- habitual — se REVOCA de `public` — porque estas funciones son `security
-- definer` y saltan RLS por diseño: si `anon` pudiera invocarlas, cualquiera
-- con el correo y el teléfono de otra persona podría quemarle la penalización
-- sin reservar nada, o devolverse la suya. Solo `service_role`, que es quien
-- corre la ruta de reservas del servidor.

-- ── El índice que sostiene el reclamo ───────────────────────────────────────
-- La 035 ya creó `penalizaciones_pendientes_idx` sobre (email, telefono) where
-- consumida_en is null. El reclamo entra por ahí; no hace falta otro.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. RECLAMAR (atómico)
-- ════════════════════════════════════════════════════════════════════════════
-- Devuelve la penalización que se acaba de tomar, o pct 0 si no había ninguna.
-- Deja `consumida_en_sesion_id` en NULL a propósito: la cita todavía no existe
-- y esa columna tiene FK contra `sesiones`. La estampa la llama después.
create or replace function public.consumir_penalizacion(p_email text, p_telefono text)
returns jsonb as $consumir$
declare
  v_res jsonb;
begin
  with elegida as (
    select p.id
      from public.penalizaciones p
     where p.consumida_en is null
       and lower(trim(p.email)) = lower(trim(p_email))
       and regexp_replace(p.telefono, '[^0-9]', '', 'g')
           = regexp_replace(p_telefono, '[^0-9]', '', 'g')
     -- Si por lo que sea arrastra más de una, se toma la mayor: el cliente
     -- paga una vez y el negocio no pierde la peor. Las otras siguen
     -- pendientes y las tomará una reserva posterior.
     order by p.pct desc, p.creada_en asc
     for update skip locked
     limit 1
  ),
  tomada as (
    update public.penalizaciones p
       set consumida_en = now()
      from elegida e
     where p.id = e.id
       and p.consumida_en is null
    returning p.id, p.pct
  )
  select jsonb_build_object('id', t.id, 'pct', t.pct) into v_res from tomada t;

  return coalesce(v_res, jsonb_build_object('id', null, 'pct', 0));
end;
$consumir$ language plpgsql security definer volatile;

alter function public.consumir_penalizacion(text, text) set search_path = public, pg_temp;

revoke execute on function public.consumir_penalizacion(text, text) from public;
revoke execute on function public.consumir_penalizacion(text, text) from anon, authenticated;
grant execute on function public.consumir_penalizacion(text, text) to service_role;

comment on function public.consumir_penalizacion(text, text) is
  'Reclama de forma atomica la penalizacion pendiente de un cliente y la marca consumida. Devuelve id y pct, o pct 0 si no habia. Dos llamadas simultaneas NO pueden llevarse la misma fila';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ESTAMPAR LA CITA QUE LA CONSUMIÓ
-- ════════════════════════════════════════════════════════════════════════════
-- Se llama recién con la cita ya insertada, porque la columna tiene FK. Sin
-- esto la penalización quedaría consumida sin decir por cuál reserva, y el
-- equipo no podría explicarle a nadie de dónde salió el recargo.
create or replace function public.vincular_penalizacion(p_id uuid, p_sesion_id uuid)
returns boolean as $vincular$
declare
  v_filas integer;
begin
  update public.penalizaciones
     set consumida_en_sesion_id = p_sesion_id
   where id = p_id
     and consumida_en is not null
     and consumida_en_sesion_id is null;

  get diagnostics v_filas = row_count;
  return v_filas > 0;
end;
$vincular$ language plpgsql security definer;

alter function public.vincular_penalizacion(uuid, uuid) set search_path = public, pg_temp;

revoke execute on function public.vincular_penalizacion(uuid, uuid) from public;
revoke execute on function public.vincular_penalizacion(uuid, uuid) from anon, authenticated;
grant execute on function public.vincular_penalizacion(uuid, uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. DEVOLVERLA SI LA RESERVA NO LLEGÓ A CREARSE
-- ════════════════════════════════════════════════════════════════════════════
-- El reclamo ocurre ANTES del insert, porque el precio tiene que llevar el
-- recargo. Si después la cita no se crea, la penalización quedaría consumida
-- por una reserva que no existe: el cliente se ahorraría el recargo por un
-- error nuestro. Solo se devuelve si nadie alcanzó a estamparle una cita.
create or replace function public.liberar_penalizacion(p_id uuid)
returns boolean as $liberar$
declare
  v_filas integer;
begin
  update public.penalizaciones
     set consumida_en = null
   where id = p_id
     and consumida_en_sesion_id is null;

  get diagnostics v_filas = row_count;
  return v_filas > 0;
end;
$liberar$ language plpgsql security definer;

alter function public.liberar_penalizacion(uuid) set search_path = public, pg_temp;

revoke execute on function public.liberar_penalizacion(uuid) from public;
revoke execute on function public.liberar_penalizacion(uuid) from anon, authenticated;
grant execute on function public.liberar_penalizacion(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. PRIVILEGIOS DE TABLA
-- ════════════════════════════════════════════════════════════════════════════
-- `security definer` corre como el dueño, así que en teoría no haría falta.
-- Se escribe igual: es la ley del proyecto y cuesta una línea. Si mañana
-- alguien saca el `security definer` de una de estas funciones, el privilegio
-- ya está y no aparece un 42501 que nadie sabe de dónde sale.
grant select, insert, update on public.penalizaciones to service_role;

-- ── Verificación ────────────────────────────────────────────────────────────
-- Que la función exista NO prueba que sea atómica ni que tenga permiso. Lo que
-- vale es esto, con una penalización de prueba pendiente:
--
--   -- (a) quién puede ejecutarla
--   select p.proname, r.rolname
--     from pg_proc p, pg_roles r
--    where p.proname in ('consumir_penalizacion','vincular_penalizacion','liberar_penalizacion')
--      and r.rolname in ('anon','authenticated','service_role')
--      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
--    order by 1, 2;
--   -- Se espera SOLO service_role en las tres. Si aparece anon, falta el revoke.
--
--   -- (b) que dos reclamos no se lleven la misma fila
--   select public.consumir_penalizacion('cliente@ejemplo.cl', '+56 9 1234 5678');
--   select public.consumir_penalizacion('cliente@ejemplo.cl', '+56 9 1234 5678');
--   -- El primero devuelve un id y su pct. El SEGUNDO debe devolver pct 0.
--   -- Si los dos devuelven pct, el recargo se cobraria dos veces.
--
-- NOTA PARA APLICARLA: el editor SQL de Supabase corre todo en una sola
-- transaccion y no admite varias funciones en un mismo script. Ir de a un
-- bloque numerado por vez, en orden.
