# PRP-001: Panel admin completo + reservas avanzadas

> **Estado**: APROBADO (2026-07-26 por el señor Ignacio) — ejecutar con `/bucle-agentico`
> **Fecha**: 2026-07-26
> **Proyecto**: Perrustingo (TryvexTeam/Perrustingo-WebSite, rama `develop`)
> **Stack**: Next.js 16.2.10 (App Router, React 19) · Supabase (proyecto `perrustingodatos` = `ywizsopnlqjyxfndlncw`) · Vercel · Tailwind 4 · Zod 4

---

## Objetivo

Dotar a Perrustingo de un panel de administración completo (analíticas, tarifas por tamaño, usuarios/roles, imágenes/anuncios, calendario Google) y de un motor de reservas avanzado (lead time mínimo configurable, disponibilidad configurable por el admin, y N citas en paralelo por peluquero asignado), quedando el sistema listo para operar en el dominio propio `perrustingo.com`.

## Por Qué

| Problema | Solución |
|----------|----------|
| El dashboard solo lista citas de hoy; no hay visión de negocio (ingresos, servicios, tendencia) | Dashboard de analíticas con métricas agregadas de `sesiones` |
| El editor de tarifas cubre precio base + 2 extras, pero los agregados no se editan por tamaño de perro | Gestor general con modal por tamaño que edita costo de agregados, reflejado en templates y form de reserva |
| Asignar roles hoy es solo por SQL (el trigger `protege_rol` bloquea la escalada, pero también deja al admin sin UI) | Control de usuarios: CRUD + asignación de rol desde el panel, respetando el trigger anti-escalada |
| Imágenes y anuncios viven en `localStorage` (cada navegador ve algo distinto) | Persistencia real en Supabase (tabla + buckets `promos`/`reservas`), gestionable desde el panel |
| Las citas no se respaldan fuera de la plataforma | Espejo en Google Calendar (ya construido en `feature/m3-google-calendar`, PR #11) |
| La reserva no controla anticipación mínima, ni disponibilidad real, ni cuántas citas caben a la misma hora | Motor avanzado: lead time configurable, disponibilidad por el admin, capacidad paralela = # de peluqueros con acceso |
| El sitio corre en dominio de Vercel, no en marca propia | Compra externa de `perrustingo.com` (por presupuesto) y conexión de DNS a Vercel |

**Valor de negocio**: el equipo (Rodolfo/Adley) opera el negocio completo sin tocar SQL ni código; el motor de reservas evita sobreventa de horarios y reduce cancelaciones por citas imposibles; la marca gana dominio propio.

## Qué

### Criterios de Éxito
- [x] **F0** ✅ (2026-07-26): Runbook DB (002–007) + trigger `trg_protege_rol` aplicados y verificados en `perrustingodatos`. Verificación real: `admins=2 | colsSes5=5 | vista=1 | extras=1 | ajustes=9 | trigger=1 | tarifas_activas=5 | buckets=2`.
- [x] **#4 Usuarios** ✅ (2026-07-26): un admin lista, edita datos y cambia el rol de cualquier perfil desde `/dashboard/usuarios`; un no-admin recibe `42501` al escalar su propio rol y **0 filas** al intentar el de otro (regresión del 15-jul no reproduce). Pendiente fuera de alcance: **crear** cuentas desde el panel requiere `service_role` (la API de admin de auth no acepta la clave anon) — hoy la cuenta nace del registro público y el admin le asigna rol.
- [x] **#2 Tarifas** ✅ (2026-07-26): un modal por tamaño edita el costo de los agregados y `/reserva` cotiza con ese valor al instante. **Ampliado por el señor Ignacio durante la fase**: cada agregado se cobra como **% o como monto fijo en pesos**, tanto en el valor general como en la excepción por tamaño. Verificado en vivo: gigante con "motas/rastas" en $30.000 fijo → $102.000 (80.000 × 0,9 + 30.000) mientras un toy hereda el 25% general → $20.700.
- [x] **#5 Imágenes/anuncios** ✅ (2026-07-26): subir/editar/reordenar/ocultar persiste en la tabla `promos` + bucket `promos`, y **además** crear y eliminar anuncios (antes exigía un despliegue). Verificado: cambio hecho en el panel → aparece en el HTML servido a un visitante anónimo por `curl`, sin sesión ni `localStorage`; imagen subida al bucket se renderiza en la landing.
- [x] **#1 Dashboard** ✅ (2026-07-26): `/dashboard/analiticas` con ingresos, agendado, ticket promedio, tasa de cancelación, citas por estado, serie diaria y ranking de servicios, filtrable por rango (en la URL). Verificado contra SQL directo sobre el mismo rango: `total=7 | ingresos=73000 | proyectado=60000 | ticket=24333 | canceladas=1 | completadas=3` — idéntico en el panel. Más 19 casos de la agregación pura, incluidos los bordes.
- [x] **#7 Reservas avanzadas** ✅ (2026-07-26): lead time, tramos por día y capacidad paralela, configurables en `/dashboard/disponibilidad`. Verificado por **POST directo al endpoint** (saltándose la UI): hoy mismo → 409 lead time · 08:00 y 19:00 → 409 fuera de horario · domingo → 409 · con capacidad 1: 1ª acepta (201), 2ª rechaza (409) · con 2 peluqueros marcados: capacidad sube sola a 2, entran 2 y **se rechaza la 3ª** · 3 perritos con 2 cupos → 409 "queda 2 cupo y usted pidió 3". Más 25 casos del motor puro. Verificado también en la interfaz: calendario con los días anteriores al lead time deshabilitados y 10 bloques de 09:00 a 18:00 (correcto para 9–19 con bloques de 60 min).
- [x] **#6 Google Calendar** ✅ (2026-07-26): integrado el trabajo del PR #11 (sin merge ciego — ver aprendizaje 39). Confirmar espeja el evento, cancelar lo borra, y **sin envs es no-op silencioso**: verificado confirmando una cita real en el panel sin credenciales → quedó `confirmada`, cero errores en el log. La hora guardada es la correcta en Chile (pedí 10:00 → `10:00` local / `14:00 UTC`, 1,5 h). Puesta en marcha documentada en `docs/GOOGLE-CALENDAR.md`. **Falta que el señor Ignacio cargue las 3 variables** (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN`).
- [ ] **#3 Dominio**: `perrustingo.com` resuelve al deploy de Vercel con HTTPS (status 200).
- [ ] `npm run build` y `npm run typecheck` pasan sin errores.

### Comportamiento Esperado (Happy Path)
1. El admin entra a `/dashboard` y ve el resumen del día + tarjetas de acceso a las secciones nuevas (Analíticas, Usuarios, Tarifas, Anuncios, Disponibilidad).
2. En **Analíticas** elige un rango y ve ingresos, nº de citas por estado y ranking de servicios.
3. En **Usuarios** promueve a un empleado a `trabajador` y le marca acceso como peluquero.
4. En **Tarifas** abre el modal de un tamaño y sube el costo de un agregado; al abrir `/reserva` el nuevo costo ya se cotiza.
5. En **Anuncios** sube una imagen, la asigna a un slot de la landing y la publica; aparece en `/`.
6. En **Disponibilidad** fija lead time = 2 días y define los tramos horarios atendidos.
7. Un cliente entra a `/reserva`: no puede pedir para mañana (lead time), solo ve tramos disponibles, y si ya hay tantas citas como peluqueros en un horario, ese horario no se ofrece.
8. Al confirmar una cita desde el panel, se espeja en Google Calendar.

---

## Contexto

### Referencias del codebase (patrones a seguir — NO reinventar)

**Server actions con guard de rol** (patrón canónico, replicar en toda escritura del panel):
- `app/dashboard/tarifas/actions.ts` — `guardarTarifasAction` / `guardarAjustesPrecioAction`: `auth.getUser()` → leer `perfiles.rol` → exigir `admin` → validar rangos → `update` → `revalidatePath`.
- `app/dashboard/citas/actions.ts` — `cambiarEstadoCita`: máquina de transiciones + guard equipo (`admin`/`trabajador`).

**Lectura reactiva de config dinámica** (patrón para consumir tarifas en cliente):
- `lib/tarifas.ts` — `obtenerTarifas()` + hook `useTarifas()` con evento `perrustingo:tarifas-actualizadas`. `lib/ajustesPrecio.ts` — análogo para `ajustes_precio`.

**Editores del panel** (misma estética Tailwind, cream/teal/ink):
- `components/admin/EditorTarifas.tsx`, `EditorAjustesPrecio.tsx`, `EditorPromos.tsx`, `ListaCitas.tsx`, `EnVivo.tsx`.

**Guard de página del panel**: `app/dashboard/page.tsx` — `getUser()` → `perfiles.rol` → `redirect("/login")` / `redirect("/perfil")` si no es equipo. Toda página nueva del panel repite este guard.

**Agenda / grid semanal**: `lib/agenda.ts` (`HORA_APERTURA=9`, `HORA_CIERRE=19`, `DIAS_SEMANA` lun–sáb, `filaACitaSemana`, `colorPorServicio`) + `components/agenda/CalendarioSemanal.tsx`.

**Dominio de citas y validación**: `lib/citas.ts` (`EstadoCita`, `solicitudCitaSchema` con honeypot, `SesionEquipo`). `lib/reserva.ts` (`TAMANO_PRECIOS`, `TamanoKey`, `formatCLP`). Form público: `components/reserva/FormReserva.tsx` + endpoint `app/api/reservas/route.ts`.

**Cliente Supabase**: `lib/supabase/{client,server,middleware}.ts`. `middleware.ts` en la raíz.

**Google Calendar (ya construido, en rama `feature/m3-google-calendar` / PR #11)**:
- `lib/google/calendar.ts` — REST directo, `googleCalendarConfigurado()`, `upsertEventoCita`, `idEventoDeCita` (evento determinístico desde el uuid). No-op silencioso si faltan envs.
- `app/api/google/{connect,callback}/route.ts` — flujo OAuth para obtener el refresh token una vez.
- Toca también `app/dashboard/citas/actions.ts`, `CalendarioSemanal.tsx`, `lib/agenda.ts` (introduce `TZ_NEGOCIO`).

### Modelo de datos existente (fuente: `supabase/schema.sql` + migraciones)
- `perfiles(id, rol['cliente'|'trabajador'|'admin'], nombre, apellido, comuna, telefono, ...)` — trigger `trg_protege_rol` (BEFORE UPDATE) bloquea cambio de `rol` a no-admin (`42501`); `get_rol()` helper.
- `perros`, `sesiones(estado, fecha_cita, fecha_inicio, fecha_fin, servicio, precio_base, precio_final, desglose_precio jsonb, contacto_*, cupon_codigo, ...)`, `conducta`, `fotos_sesion`.
- `tarifas(tamano, servicio, precio, activo)` — 5 tamaños. `tarifas_extras` (singleton: recargo_motas_pct, precio_accesorio). `ajustes_precio(categoria, clave, etiqueta, pct, activo)` — GRANT de columna impide tocar `categoria`/`clave`.
- `cupones`, vista `agenda_ocupada` (solo confirmada/en_proceso).
- Storage buckets: `promos`, `reservas` (públicos; INSERT/UPDATE/DELETE solo equipo/dueño).

### Ley de GRANT (crítica — ya nos costó 2 bugs, ver Gotchas)
En Postgres los privilegios de tabla se evalúan **antes** que RLS. Toda tabla/columna nueva necesita su `GRANT` explícito o la policy muere en silencio con `42501`. El `GRANT ... ON ALL TABLES` de `schema.sql` es un snapshot: las tablas creadas después NO lo heredan.

### Arquitectura Propuesta (respeta la estructura actual: `app/dashboard/*`, `components/admin/*`, `lib/*`)
```
app/dashboard/
├── analiticas/       page.tsx (+ server queries)          # #1
├── usuarios/         page.tsx + actions.ts                 # #4
├── tarifas/          page.tsx + actions.ts (existe; +modal por tamaño)  # #2
├── anuncios/         page.tsx + actions.ts (existe; +persistencia)      # #5
└── disponibilidad/   page.tsx + actions.ts                 # #7 (config)
components/admin/
├── DashboardAnaliticas.tsx, GraficoIngresos.tsx           # #1
├── GestorUsuarios.tsx, ModalRol.tsx                        # #4
├── ModalTarifaPorTamano.tsx                                # #2
├── EditorPromos.tsx (migrar a DB), SubidorImagen.tsx       # #5
└── EditorDisponibilidad.tsx                                # #7
lib/
├── analiticas.ts                                           # #1
├── usuarios.ts                                             # #4
├── disponibilidad.ts (lead time, tramos, capacidad)        # #7
├── promos.ts (migrar de localStorage a Supabase)           # #5
└── google/calendar.ts (desde PR #11)                       # #6
supabase/migrations/
├── 008_promos_tabla.sql        # #5
├── 009_disponibilidad.sql      # #7 (config + flag peluquero en perfiles)
└── (verificación runbook 002-007)  # F0
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo se definen FASES. Las subtareas se generan al entrar a cada fase con `/bucle-agentico` (mapear contexto real → generar subtareas → ejecutar → verificar). Orden por dependencia.

### Fase 0: Base de datos verificada (habilitador de #2, #4, #7)
**Objetivo**: Confirmar/aplicar el runbook DB (migraciones 002→007) y el trigger `trg_protege_rol` en `perrustingodatos`, dejando el esquema alineado con `schema.sql` + migraciones del repo.
**Validación**: Ejecutar (Playwright sobre el SQL Editor de Supabase, o MCP con permisos) las queries de verificación del `RUNBOOK-2026-07-20.sql` (sección F): admin ≥ 1, columnas de `sesiones` presentes, vista `agenda_ocupada` existe, `tarifas_extras` (1 fila), `ajustes_precio` (9 filas), trigger `trg_protege_rol` presente. Sin fila admin válida → detener y reportar.

### Fase 1 ✅ COMPLETA (2026-07-26): Control de usuarios — CRUD + roles (req #4, habilitador de #7)
**Objetivo**: Sección `/dashboard/usuarios` (solo admin) para listar perfiles, editar datos y asignar rol; escritura vía server action con guard admin. Incluye el flag de "acceso peluquero" que consumirá la Fase 5.
**Validación**: Admin cambia un rol desde la UI y persiste; un cliente autenticado que intenta `PATCH rol=admin` recibe `42501` (regresión del ataque del 15-jul no reproduce, verificado vía PostgREST). Screenshot de la tabla de usuarios.

### Fase 2 ✅ COMPLETA (2026-07-26): Gestor de tarifas general — modal por tamaño (req #2)
**Objetivo**: Ampliar `/dashboard/tarifas` con un modal por tamaño de perro que edita el costo de los agregados (usando `tarifas`, `tarifas_extras`, `ajustes_precio`), reutilizando `guardarTarifasAction`/`guardarAjustesPrecioAction` y el patrón `useTarifas`.
**Validación**: Editar un agregado en el modal → `/` y `/reserva` cotizan el nuevo valor (verificación en vivo vía el evento de actualización). Screenshot antes/después de la cotización.

### Fase 3 ✅ COMPLETA (2026-07-26): Control real de imágenes y anuncios (req #5)
**Objetivo**: Migrar `lib/promos.ts` de `localStorage` a Supabase (tabla nueva `promos` + bucket `promos` ya existente), con subida/edición/asignación de slot/orden/visibilidad desde el panel. GRANT explícito para la tabla nueva.
**Validación**: Subir un anuncio en un dispositivo y verlo en `/` desde otra sesión/navegador (no `localStorage`). Screenshot de la landing con el anuncio en su slot.

### Fase 4 ✅ COMPLETA (2026-07-26): Dashboard de analíticas (req #1)
**Objetivo**: Sección `/dashboard/analiticas` con métricas agregadas de `sesiones` (nº de citas por estado, ingresos por rango, ranking de servicios) filtrables por fecha. Consultas del lado servidor.
**Validación**: Los totales del dashboard cuadran con una consulta SQL directa sobre `sesiones` para el mismo rango. Screenshot con datos reales.

### Fase 5 ✅ COMPLETA (2026-07-26): Reservas avanzadas — lead time, disponibilidad, capacidad paralela (req #7, depende de #4)
**Objetivo**: (a) migración `009_disponibilidad` (config de lead time + tramos + flag peluquero en `perfiles`); (b) `/dashboard/disponibilidad` para que el admin configure lead time mínimo y tramos; (c) motor en `lib/disponibilidad.ts` que el form (`FormReserva`/`app/api/reservas`) consume: oculta fechas antes del lead time, ofrece solo tramos configurados, y limita a N citas simultáneas donde N = peluqueros con acceso (rechaza la N+1). Validación de capacidad reforzada en servidor (no solo UI).
**Validación**: Con lead time = 2 días, el form no permite mañana; con N peluqueros y N citas confirmadas a una hora, ese slot no se ofrece y un POST directo a la N+1 es rechazado. Tests de los tres límites + screenshot del form.

### Fase 6 ✅ COMPLETA (2026-07-26): Google Calendar (req #6)
**Objetivo**: Integrar en `develop` el trabajo de `feature/m3-google-calendar` (PR #11): espejo de citas al confirmar, resolviendo conflictos con los cambios de las fases previas en `citas/actions.ts`, `CalendarioSemanal.tsx` y `lib/agenda.ts` (nota: la rama introduce `TZ_NEGOCIO`). Documentar las envs `GOOGLE_OAUTH_*` / `GOOGLE_CALENDAR_*`.
**Validación**: Con envs configuradas, confirmar una cita crea/actualiza su evento (verificar en Calendar o vía la API); sin envs, no-op silencioso y la plataforma funciona igual. Build pasa tras el merge.

### Fase 7: Dominio perrustingo.com (req #3)
**Objetivo**: Preparar el proyecto Vercel para el dominio propio. La **compra es externa y está sujeta a presupuesto** (acción del señor Ignacio, no de la plataforma); una vez comprado, agregar el dominio en Vercel y configurar los registros DNS (A/CNAME) en el registrador.
**Validación**: `perrustingo.com` responde 200 con HTTPS y sirve el deploy de producción. (Bloqueada hasta la compra — no ejecutar antes.)

### Fase 8: Validación Final
**Objetivo**: Sistema funcionando end-to-end en `develop`, listo para PR.
**Validación**:
- [ ] `npm run build` + `npm run typecheck` sin errores
- [ ] Playwright screenshots de cada sección nueva del panel + del form de reserva
- [ ] Todos los criterios de éxito cumplidos
- [ ] PR desde `develop` (nunca push directo a `main`) con semáforo de estado

---

## Aprendizajes (Auto-Blindaje)

> Esta sección CRECE con cada error encontrado durante la implementación. El mismo error NUNCA ocurre dos veces.

### F0 (2026-07-26)

1. **El runbook NO cubría 006/007.** `RUNBOOK-2026-07-20.sql` aplica solo A(002)+B(003)+C(004)+fix rol, pero los criterios de verificación exigen `tarifas_extras` y `ajustes_precio`. En la DB real ambas tablas **no existían**. Se aplicaron a mano desde `supabase/migrations/006_*.sql` y `007_*.sql`. → **Regla: el runbook es un snapshot con fecha; verificar contra `supabase/migrations/`, no contra el runbook.**
2. **`admins = 0`, no 1.** El bloque E del runbook traía un uid **placeholder** (`0951870d-0000-…`) que nunca se reemplazó, así que ese UPDATE jamás promovió a nadie: los 3 perfiles estaban en `cliente` y el panel era inaccesible para todos. Promovidos por decisión del señor Ignacio: `perrustingodatos@gmail.com` (6b87d57e…) y Rodolfo Salinas (9a439529…). → **Regla: un UPDATE con placeholder es un no-op silencioso; verificar el efecto (`count(*) where rol='admin'`), no que el script "corrió".**
3. **No existe migración 005.** Salto de numeración, confirmado por `git log --diff-filter=D`: nunca existió. No buscarla.
4. **Monaco no se llena con `type`/`fill`.** El SQL Editor de Supabase conserva texto residual y la escritura se mezcla, produciendo `42601 syntax error`. Método fiable: `window.monaco.editor.getEditors()[0].setValue(...)` + clic en `[data-testid="sql-run-button"]`. Además, la grilla de resultados corta columnas: concatenar todo en **una sola columna de texto** para leer el veredicto completo.
5. **"Confirm email" ya estaba apagado** (verificado en `auth/providers`, `aria-checked=false`), no requirió acción.

### F1 (2026-07-26)

6. **Faltaba la policy de UPDATE del admin sobre otros perfiles.** `perfiles` solo tenía `perfil_edita_propio:UPDATE` (la fila propia). Con RLS, un admin actualizando a otro **no recibe error**: el UPDATE filtra las filas, afecta 0 y devuelve éxito. El panel habría dicho "guardado" con el rol intacto. Creada `admin_edita_perfiles` (USING + WITH CHECK) en la migración 008. → **Regla: con RLS, "sin error" no es "hizo algo". Todo UPDATE del panel lleva `.select()` y se verifica que devuelva ≥1 fila** (implementado en los 3 actions).
7. **El email no está en `perfiles`**, vive en `auth.users` y la clave anon no lo lee. Solución: función `emails_de_perfiles()` SECURITY DEFINER que valida `get_rol()='admin'` adentro y **levanta 42501** si no lo es (no devuelve vacío: un rechazo mudo es indistinguible de "no hay usuarios"). `search_path` fijo, `REVOKE ... FROM anon, PUBLIC`.
8. **Riesgo de quedarse sin admins** — F0 encontró la base exactamente así. Añadido trigger `protege_ultimo_admin` en la DB (no solo en el action: PostgREST es otra puerta) + guard en `cambiarRolAction` para que un admin no se autodegrade. Verificado: el intento levanta `42501: No se puede quitar el último admin del sistema` y aborta el lote entero.
9. **Numeración de migraciones corrida**: F1 tomó el `008` que el PRP reservaba a promos. Promos → **009**, disponibilidad → **010**.
10. **`es_peluquero` no es el rol.** El flag nace en F1 pero lo consume F5: un admin puede ser dueño sin atender, y un trabajador puede ser recepción. La capacidad paralela cuenta **la columna**, nunca el rol.
11. **Crear cuentas desde el panel no se puede con la clave anon** (requiere `service_role`, que no debe vivir en el cliente). Quedó fuera de F1 y documentado en el criterio #4.

### F2 (2026-07-26)

12. **`"use client"` en un módulo de dominio rompe los server actions, y ni `tsc` ni `build` lo detectan.** `admiteMontoFijo()` se puso en `lib/ajustesPrecio.ts` (que es `"use client"`) y el action la llamó: typecheck ✅, build ✅, y en runtime `Error: Attempted to call admiteMontoFijo() from the server but admiteMontoFijo is on the client` — el guardado devolvía 500. → **Regla: los helpers de dominio (validación, cálculo, constantes) viven en un módulo sin directiva; `lib/reserva.ts` es el isomorfo del proyecto. Y esto solo lo caza ejecutar la acción de verdad, nunca el build.**
13. **Los agregados por tamaño se guardan como EXCEPCIONES, no como copia.** `ajustes_precio_tamano` arranca vacía y lo que no tiene fila hereda el general. Así el despliegue no mueve ni un precio, subir el general sigue siendo un solo cambio, y se distingue "personalizado" de "heredado" (un override que coincide con el general NO es lo mismo: si el general sube, el heredado sube y el override no).
14. **% y monto fijo no son intercambiables y el sistema no debe adivinar.** Al cambiar la forma de cobro el campo arranca en 0: convertir 25% a pesos sería inventar un precio. En la DB solo sobrevive el valor del tipo declarado (el otro queda 0/null) para no dejar números huérfanos que el próximo lector crea vigentes.
15. **Las zonas sensibles siguen solo en %** (decisión, no olvido): sus filas son "cada zona suma X" y "el tope es Y"; si una fuera monto y la otra %, el tope no tendría contra qué compararse. Validado también en el servidor, no solo escondiendo el selector.
16. **El endpoint `/api/reservas` guarda el `precioEstimado` que manda el cliente**, no lo recalcula. Es preexistente y tolerable porque la cita nace `pendiente` y el precio final lo fija el negocio al confirmar — pero es un dato de origen no confiable. Si alguna vez el estimado pasa a ser vinculante, hay que recalcularlo en el servidor.

### F3 (2026-07-26)

17. **`revalidateTag(tag)` con un solo argumento ya no compila en Next 16**: la firma es `revalidateTag(tag, profile)` y la de un parámetro está deprecada (`Expected 2 arguments, but got 1`). Se usa `"max"` (stale-while-revalidate). Confirmado en `node_modules/next/dist/docs/…/revalidateTag.md`, no adivinado — es justo lo que advierte `AGENTS.md`.
18. **Leer de la base NO tiene por qué volver dinámica la landing.** Usar el cliente de Supabase de servidor lee cookies y arrastra `/` a render bajo demanda. Con `fetch` a PostgREST + `next: { tags, revalidate }` la home **sigue estática** (`○` en el build) y el panel la refresca al guardar con `revalidateTag` + `revalidatePath`. Verificado en la salida del build.
19. **El fallback no debe resucitar datos borrados.** `PROMOS_DEFAULT` se usa solo cuando la lectura **falla**; una tabla vacía es una decisión del admin (landing sin banners), no un error que haya que "arreglar" reponiendo los de fábrica.
20. **Se eliminó el fallback a dataURL en `localStorage` al subir imágenes.** Antes, sin Supabase configurado, la imagen se guardaba comprimida en el navegador y "parecía" funcionar: era exactamente el problema que esta fase vino a resolver, disfrazado de éxito. Ahora falla con un mensaje claro.
21. **`/dashboard/anuncios` no tenía guard de rol.** Con los anuncios en `localStorage` el daño era local; al pasar a base de datos, una escritura cambia la landing pública. Ahora exige `admin` (y la RLS lo refuerza).
22. **El `alt` es obligatorio en la tabla, no opcional.** Estos banners comunican servicios reales; sin texto alternativo son invisibles para lectores de pantalla. La validación lo exige en cliente y servidor.

---

## Gotchas

- [ ] **GRANT antes que RLS**: toda tabla/columna nueva (promos, disponibilidad) necesita `GRANT` explícito para `anon`/`authenticated`, o la policy muere con `42501` en silencio. El `GRANT ON ALL TABLES` de `schema.sql` NO cubre tablas creadas después.
- [ ] **Trigger anti-escalada**: el guard `protege_rol` deja pasar cuando `auth.uid()` es NULL (SQL Editor / service_role). Cambiar roles desde el panel funciona porque el server action corre con la sesión del admin (no service_role); confirmar que el UPDATE del admin realmente pasa el trigger, y que un no-admin sigue bloqueado.
- [ ] **RLS de `ajustes_precio`**: `categoria`/`clave` no son editables (GRANT de columna + REVOKE INSERT/DELETE). El modal por tamaño solo puede tocar `pct`/`etiqueta`/`activo`.
- [ ] **Modo demo**: `app/dashboard/page.tsx` cae a maqueta si `NEXT_PUBLIC_SUPABASE_URL` está vacío o contiene `TU_PROYECTO`. Las páginas nuevas deben manejar el mismo caso (env local está vacío en el repo).
- [ ] **Merge de PR #11**: la rama Google Calendar toca `citas/actions.ts`, `agenda.ts` y `CalendarioSemanal.tsx`, que también cambian en F1/F4/F5 → resolver conflictos con cuidado; introduce `TZ_NEGOCIO` (zona America/Santiago) del que dependen fases de agenda.
- [ ] **Capacidad paralela**: la vista `agenda_ocupada` solo cuenta confirmada/en_proceso; decidir si "pendiente" ocupa cupo. La regla de Rodolfo hoy es que pendiente NO bloquea la agenda pública — respetarla salvo indicación contraria.
- [ ] **Next.js 16 (breaking changes)**: ante dudas de API (params async, caching, server actions), leer `node_modules/next/dist/...` / usar context7, no asumir Next 14/15.
- [ ] **Zona horaria**: la agenda se ancla a America/Santiago; el lead time y la disponibilidad deben calcularse en esa zona, no en UTC ni en la del navegador.

## Anti-Patrones

- NO reintroducir `localStorage` como fuente de verdad (anuncios/tarifas ya migraron a DB).
- NO crear server actions sin el guard de rol (`getUser` → `perfiles.rol`).
- NO confiar la capacidad/lead time solo a la UI: validar también en el servidor (`app/api/reservas`).
- NO crear tablas sin su `GRANT`/RLS ni sin migración versionada en `supabase/migrations/`.
- NO hacer push directo a `main` — PR desde `develop`.
- NO comprar el dominio ni tocar DNS antes de la aprobación de presupuesto del señor Ignacio.
- NO ignorar errores de TypeScript ni hardcodear precios (usar las tablas).

---

*PRP APROBADO 2026-07-26. Ejecución por fases vía `/bucle-agentico`, empezando por F0.*

### F4 (2026-07-26)

23. **La base tenía 0 citas.** Las analíticas se construyeron a ciegas y se verificaron sembrando 7 citas marcadas (`contacto_nombre='PRUEBA-F4'`) en producción, comparando panel contra SQL directo, y borrándolas. → **Regla: si no hay datos, el estado vacío es parte del entregable** — un tablero de ceros se lee como "el negocio no vendió", no como "todavía no hay registros".
24. **"Ingresos" no es la suma de todas las citas.** Solo las `completada` cuentan como plata que entró; `confirmada`/`en_proceso` van en una tarjeta aparte ("Agendado, aún no cobrado") y las `cancelada` no suman a ingresos, ni al ranking de servicios, ni a la serie diaria. Sumarlas habría inflado el total con una cita de $99.000 que nunca ocurrió.
25. **Agrupar por día en UTC corre las citas de la tarde al día siguiente.** El agrupamiento usa `America/Santiago` explícito; verificado con una cita de las 16:00 que debe quedar en su propio día.
26. **El rango vive en la URL (`?desde=&hasta=`)**, con formulario GET: se comparte, se marca y sobrevive a recargar. Rango invertido se corrige en vez de devolver cero resultados, y el último día entra completo (`< día siguiente`, no `<= día`).
27. **El precio de una cita es `precio_final ?? precio_base ?? 0`**: el final es lo que se cobró, el base el estimado con que nació. Sin ninguno vale 0 — contarla como ingreso desconocido inflaría el total.
28. **Analíticas las ve el equipo completo** (`admin` y `trabajador`), no solo el admin: saber cómo va el mes no es una acción privilegiada. Verificado: un `cliente` es redirigido a `/perfil` y por PostgREST no ve ninguna cita ajena (RLS).

### F5 (2026-07-26)

29. **La reserva no tenía hora.** El formulario pedía solo el día y decía "confirmamos la hora por WhatsApp", así que "N citas a la misma hora" no existía como concepto. F5 tuvo que introducir la elección de bloque horario — sin eso, el criterio #7 era inverificable.
30. **BUG PREEXISTENTE encontrado y corregido: toda reserva anónima moría con 500.** `app/api/reservas` hacía `.insert(...).select("id").single()`; ese `RETURNING` necesita permiso de SELECT sobre la fila recién creada, y un visitante sin cuenta no tiene ninguna policy que se lo dé. El INSERT pasaba y la lectura moría con `42501`. Verificado aislando el caso en SQL: el mismo INSERT **sin** `RETURNING` como rol `anon` inserta bien. Fix: el id se genera con `crypto.randomUUID()` en el servidor, así no hace falta leer nada de vuelta. → **Regla: en una tabla con RLS de escritura pública, `.insert().select()` es una trampa — escribir no implica poder leer lo escrito.**
31. **Postgres devuelve los instantes en UTC y los bloques se arman con offset de Santiago.** El mismo momento escrito de dos formas nunca coincide como texto: la ocupación no habría tapado ningún horario y **todo se vería libre**. Todo lo que toca la ocupación pasa por `claveInstante()` (UTC canónico). Verificado con el caso cruzado (ocupación en UTC, consulta con offset).
32. **La capacidad nunca puede quedar en 0.** Si nadie está marcado como peluquero, o falla la lectura, la agenda se cerraría sola en silencio. `capacidad_paralela()` devuelve el mayor entre los peluqueros marcados y una capacidad de respaldo configurable (mínimo 1).
33. **`pendiente` ocupa cupo (configurable).** La regla de Rodolfo —"pendiente no bloquea la agenda pública"— se respeta en la vista `agenda_ocupada`, que no se tocó. Pero para los CUPOS es al revés: si una solicitud sin confirmar no ocupara, veinte personas pedirían la misma hora y habría que rechazar diecinueve a mano. Por defecto ocupa; el admin puede apagarlo.
34. **Un bloque solo se ofrece si cabe completo en el tramo.** Con cierre a las 19:00 y bloques de 60 min, el último es 18:00; con bloques de 90, el último es 16:30. Ofrecer 18:30 sería vender media hora que no existe.
35. **El motor de disponibilidad es uno solo** (`lib/disponibilidad.ts`, puro): lo usan el formulario para ofrecer y el endpoint para aceptar. Con dos implementaciones, la UI ofrecería cupos que el servidor rechaza.
36. **El rate limit del endpoint (8 por 10 min) es real y frena las pruebas automatizadas.** No es un bug: al verificar en tandas hay que reiniciar el server o espaciar los intentos.
37. **Dos defectos de la interfaz que solo aparecieron al mirarla.** (a) Con capacidad 1, *todos* los bloques mostraban la etiqueta "último" — cierto pero inútil: si el local atiende de a uno, cada horario libre tiene un cupo y el aviso es ruido en cada botón. Ahora sale solo si `capacidad > 1`. (b) El texto decía "confirmamos la hora exacta por WhatsApp", que desde esta fase **es falso**: la hora la elige el cliente y queda tomada. → **Regla: la verificación por HTTP prueba la lógica, no la honestidad de lo que lee el cliente. Hay que mirar la pantalla.**
38. **Herramental: nunca matar procesos por nombre de imagen.** Reinicié el dev server con `taskkill /F /IM node.exe` y tumbé los 535 servidores MCP del señor Ignacio, que también corren como Node. Se pierde la sesión de herramientas a mitad de la verificación. Matar siempre el PID (Next.js lo imprime cuando ya hay una instancia). Guardado en memoria como `feedback_nunca_taskkill_node_masivo`.

### F6 (2026-07-26)

39. **La rama del PR #11 estaba construida sobre un `develop` viejo; un merge habría revertido trabajo.** Su `FormReserva` es el de una sola cita (hoy es multi-perrito) y su `route.ts` no conoce el bloque horario de la Fase 5. Se integró **archivo por archivo**: lo nuevo (`lib/google/calendar.ts`, `/api/google/{connect,callback}`) tal cual; lo compartido (`lib/agenda.ts`, `citas/actions.ts`) adaptado a mano; lo obsoleto (cambios de `FormReserva`, el número de WhatsApp por env que ya vive en `lib/site.ts`) **descartado**. → **Regla: antes de mergear una rama vieja, comparar qué versión de cada archivo es la buena — `git merge` no sabe cuál de los dos lados es progreso.**
40. **BUG de mi Fase 5 que la rama vino a corregir: `-04:00` fijo.** Chile cambia de hora dos veces al año; con el offset fijo, toda cita entre septiembre y abril se guardaba una hora corrida. La rama traía `offsetNegocio(fecha)`, que devuelve `-04:00` o `-03:00` según la fecha. Ahora lo usan el motor de disponibilidad, el endpoint, el selector de horarios y las analíticas. Verificado: una cita de las 10:00 en enero se lee 10:00 en Chile, y con el offset fijo se leía **11:00**.
41. **Leer la hora con `getHours()` en el servidor corre la agenda 3–4 horas**, porque Vercel corre en UTC. `partesEnZona()` lee siempre en `America/Santiago`: verificado con una cita de las 22:00, que con la lectura ingenua se habría ido al día siguiente.
42. **El respaldo nunca bloquea al panel.** El espejo va dentro de un `try/catch` **después** del update: si Google falla, la cita ya está guardada y el error solo se registra. Un respaldo que impide confirmar es peor que no tener respaldo.
43. **El id del evento se deriva del uuid de la cita** (sin guiones, hex = subconjunto del base32hex que exige Google). Así no hay que guardar el id de Google en la base, confirmar dos veces actualiza el mismo evento en vez de duplicarlo, y reconfirmar una cita cancelada lo revive.
44. **Ajuste sobre el original**: la versión del PR solo espejaba si se pasaba `horario` nuevo. Desde la Fase 5 la cita **ya nace con hora**, así que confirmar sin cambiar el horario no habría espejado nada. Ahora usa la hora que ya tenía la cita como respaldo.
