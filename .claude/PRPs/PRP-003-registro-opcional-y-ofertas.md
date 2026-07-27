# PRP-003: Reservar sin cuenta + ofertas configurables

> **Estado**: APROBADO EN CRITERIOS (2026-07-26) — listo para ejecutar con `/bucle-agentico`
> **Fecha**: 2026-07-26
> **Proyecto**: Perrustingo (TryvexTeam/Perrustingo-WebSite, rama `develop`)

---

## Objetivo

Que **nadie quede fuera por no querer crear una cuenta**, sin perder el
incentivo para que se registren ni los datos que alimentan el dashboard.

- **Sin cuenta**: se reserva igual. El formulario pide nombre, teléfono,
  correo y comuna — esos datos son los que hoy llegan por la cuenta, y sin
  ellos las analíticas quedan ciegas.
- **Con cuenta**: no se le vuelve a preguntar nada de eso; se toma del
  perfil y el formulario queda más corto.
- **El incentivo** deja de estar escrito en el código: el admin configura
  las ofertas desde el panel (por ejemplo, "2ª cita con 15% de descuento
  para quien tenga cuenta").

---

## Situación actual (verificada en el código)

| Hecho | Dónde |
|---|---|
| **Para reservar hay que tener cuenta** — pantalla "Crea tu cuenta para reservar" | `app/reserva/page.tsx` |
| El incentivo "10% en la primera cita" está **escrito en el HTML** de esa pantalla | ídem |
| El descuento real sale de `ajustes_precio` (`primera_cita`), editable desde F2 | `lib/ajustesPrecio.ts` |
| "Primera cita" se decide contando las sesiones **del usuario logueado** | `FormReserva.tsx` (`count === 0`) |
| El contacto (nombre, correo, teléfono) **se toma del perfil**, el form no lo pide | `app/reserva/page.tsx` → `FormReserva` |
| `sesiones` ya tiene `contacto_nombre/email/telefono` y acepta `cliente_id` nulo | migración 002 |
| La policy de inserción pública **ya permite reservar sin sesión** | `solicitud_publica_pendiente` |
| **La comuna no se pide en ningún lado** hoy | — |

**Lo importante**: la base ya está preparada para reservas sin cuenta (la
policy existe y `cliente_id` admite nulo). Lo que bloquea es la **pantalla**
de `/reserva`, no el modelo de datos. Y el endpoint anónimo quedó operativo
recién con el arreglo de PRP-001 F5 (el `RETURNING` que fallaba).

---

## El problema de fondo: ¿cómo se reconoce a alguien sin cuenta?

Si la oferta es "tu segunda cita tiene descuento", hay que saber **cuántas
citas lleva esa persona**. Con cuenta es trivial (`cliente_id`). Sin cuenta,
el único identificador es lo que la persona escribe, y eso trae dos riesgos
opuestos:

1. **Que alguien reclame un descuento que no le toca** — reservar siempre
   como "primera cita" cambiando el correo.
2. **Que a alguien no se le reconozca su historial** — escribió el teléfono
   con espacios distintos y el sistema lo trata como cliente nuevo.

**Propuesta**: identificar por **teléfono normalizado** (solo dígitos, sin
`+56` ni espacios). Es el dato que el negocio ya usa para contactar por
WhatsApp, y el que la gente escribe bien porque necesita que la llamen.

Y —esto es lo que resuelve el riesgo 1— **el beneficio de tener cuenta no
se otorga a quien no la tiene**. Es decir: la oferta de "2ª cita con
descuento" es exactamente el incentivo para registrarse. Quien reserva sin
cuenta reserva igual, pero sin ese beneficio. Así el incentivo es real y no
hay nada que falsificar.

---

## Qué se construye

### 1. Reservar sin cuenta
`/reserva` deja de bloquear. La pantalla actual de registro se convierte en
una **invitación que se puede saltar**: "Crear cuenta y aprovechar el
beneficio" / "Reservar sin cuenta".

### 2. Formulario que se adapta
- **Con sesión**: como hoy (no pregunta contacto). Se agrega la comuna al
  perfil si falta.
- **Sin sesión**: un paso extra con nombre, teléfono, correo y comuna.
  Validado en cliente y servidor.

### 3. Ofertas configurables (`/dashboard/ofertas`)
Tabla `ofertas` administrable, con:
- **título y detalle** (lo que ve el cliente),
- **condición**: `solo_con_cuenta`, y `desde_la_cita_n` (1 = primera visita,
  2 = segunda…),
- **beneficio**: % o monto fijo (reutiliza el modelo de PRP-001 F2),
- **activa** sí/no y vigencia opcional.

La oferta se muestra en la pantalla de invitación y en el formulario, y se
aplica sola al cotizar. **Deja de estar escrita en el HTML.**

### 4. Que las analíticas no queden ciegas
Hoy el dashboard se apoya en `sesiones`, que ya guarda el contacto. Se
agrega **comuna** a la sesión y al perfil, y en `/dashboard/analiticas` una
vista de "de dónde vienen" y "con cuenta vs. sin cuenta" — que es
justamente lo que permite medir si el incentivo funciona.

---

## Estructura

```
Visitante entra a /reserva
  ├─ con sesión  → formulario corto (contacto del perfil)
  └─ sin sesión  → invitación con la oferta vigente
                     ├─ "Crear cuenta"  → registro → formulario corto
                     └─ "Reservar sin cuenta" → formulario + paso de contacto

Al cotizar
  └─ ofertaAplicable(perfil, historial) → descuento
       · con cuenta: cuenta las sesiones por cliente_id
       · sin cuenta: cuenta por teléfono normalizado (solo informativo;
                     las ofertas con `solo_con_cuenta` no aplican)

Al guardar
  └─ sesiones: cliente_id (o NULL) + contacto_* + comuna + oferta_aplicada
       └─ analíticas: ingresos por comuna y por tipo de cliente
```

**Archivos previstos**
```
supabase/migrations/013_ofertas.sql   (nuevo)  tabla ofertas + comuna + oferta_aplicada
lib/ofertas.ts                        (nuevo)  dominio puro: cuál aplica y cuánto descuenta
lib/telefono.ts                       (nuevo)  normalizar() — un solo criterio en todo el sitio
app/dashboard/ofertas/{page,actions}  (nuevo)  CRUD de ofertas (admin)
components/admin/EditorOfertas.tsx    (nuevo)
app/reserva/page.tsx                  (editar) deja de bloquear; muestra la oferta real
components/reserva/FormReserva.tsx    (editar) paso de contacto cuando no hay sesión
app/api/reservas/route.ts             (editar) aceptar contacto+comuna anónimos; validar oferta
lib/analiticas.ts                     (editar) cortes por comuna y por con/sin cuenta
```

---

## Fases

### Fase 1: Reservar sin cuenta
Quitar el bloqueo, convertir la pantalla en invitación saltable y agregar el
paso de contacto (nombre, teléfono, correo, comuna) cuando no hay sesión.
**Validación**: completar una reserva **sin iniciar sesión** y ver la cita
en el panel con su contacto; con sesión, el formulario no pide contacto.

### Fase 2: Ofertas configurables
Migración `ofertas`, panel `/dashboard/ofertas`, y la pantalla de invitación
mostrando la oferta vigente (en vez del texto fijo).
**Validación**: cambiar el texto y el % desde el panel y verlo reflejado en
`/reserva` sin desplegar; un cliente no puede editar ofertas (PostgREST).

### Fase 3: Aplicar la oferta al cotizar
`ofertaAplicable()` y su uso en el estimado, con el desglose mostrando el
nombre de la oferta. Reemplaza el `descuentoPrimeraCita` fijo.
**Validación**: casos —con cuenta y 0 citas; con cuenta y 1 cita; sin
cuenta; oferta desactivada; oferta vencida— cada uno con el descuento
esperado. Verificado también en el servidor: un POST que reclame una oferta
que no le toca es rechazado.

### Fase 4: Analíticas de conversión
Comuna en la sesión, y en el dashboard: reservas con cuenta vs. sin cuenta,
y ranking de comunas.
**Validación**: los totales cuadran con SQL directo sobre el mismo rango.

---

## Decisiones tomadas por el señor Ignacio (2026-07-26)

1. **Al registrarse se le reconocen las visitas previas.** Quien reservó sin
   cuenta y luego se registra con el mismo teléfono hereda su historial:
   "ya tienes 2 visitas con nosotros". Es un premio a registrarse y hace la
   cuenta más atractiva. La vinculación es por **teléfono normalizado**.
   → Implica un paso de reconciliación al crear la cuenta: buscar sesiones
   con ese teléfono y `cliente_id IS NULL`, y asignárselas.
   ⚠️ **Riesgo asumido**: dos personas de una misma casa que compartan
   teléfono quedarían con el historial unido. Se acepta (es lo que también
   pasa hoy si comparten cuenta).

2. **Varias ofertas activas a la vez; se aplica solo la mejor.** Permite
   campañas en paralelo (bienvenida, 2ª cita, temporada) sin que se
   acumulen y dejen un precio bajo el costo. **Los cupones tampoco se
   acumulan con las ofertas**: se aplica el mayor de los dos, que es como
   funciona hoy `descuentoGlobal`.

3. **Todos los datos son obligatorios para quien reserva sin cuenta**:
   nombre, teléfono, correo y comuna. El señor Ignacio prioriza tener el
   dato completo para el dashboard por sobre la fricción.
   → Nota para medir después: si se ve que muchos abandonan en ese paso,
   el candidato a soltar es el **correo** (el negocio contacta por
   WhatsApp), no el teléfono ni la comuna.

## Relación con el lead time (ya construido en PRP-001 F5)

El señor Ignacio recuerda que **el admin define desde el panel la
anticipación mínima para pedir hora**, justamente para que el equipo tenga
días de margen para confirmar por WhatsApp. Eso **ya está funcionando**:
`/dashboard/disponibilidad` → "Anticipación mínima". Dos consecuencias para
este PRP:

- Las ofertas **no deben prometer nada que el lead time impida** (por
  ejemplo, "reserva para hoy con descuento" cuando el mínimo son 2 días).
  El panel de ofertas debe advertirlo si el texto menciona plazos.
- Ese margen de días es también el que permite que una reserva **sin
  cuenta** se confirme por WhatsApp sin apuro, que es lo que hace viable
  quitar el registro obligatorio.

---

## Gotchas

- **La pantalla de bloqueo es la que hoy explica el beneficio.** Al
  quitarla hay que asegurarse de que la oferta siga siendo visible, o el
  incentivo desaparece y nadie se registra.
- **`esPrimeraCita` cuenta las sesiones del usuario logueado**
  (`FormReserva`, `count === 0`). Sin sesión esa consulta devuelve 0 por
  RLS, no porque sea su primera cita: **cualquiera sin cuenta parecería
  primerizo**. Es exactamente el bug que hay que evitar al mover la lógica.
- **El descuento se calcula en el navegador.** Hoy el precio es un estimado
  referencial y el negocio confirma en la puerta, así que no es grave; pero
  si la oferta pasa a ser vinculante, el servidor debe recalcularla
  (mismo pendiente anotado en PRP-001, aprendizaje 16).
- **Teléfonos**: hay que normalizar en un solo lugar (`+56 9 1234 5678`,
  `56912345678` y `912345678` son la misma persona). Dos criterios
  distintos = historiales partidos.
- **RLS de `sesiones` para anónimos**: la policy exige `contacto_nombre` y
  `contacto_telefono` no nulos. Si el correo queda opcional, no tocar esos
  dos.
- **El registro pide comuna** (`handle_new_user` la guarda desde
  `raw_user_meta_data`), pero **el formulario de registro no la muestra**:
  la columna existe y llega vacía. Revisar al agregarla al form.

## Anti-patrones

- NO dejar el incentivo escrito en el código: es justo lo que este PRP
  viene a mover al panel.
- NO otorgar beneficios de cuenta a quien no tiene cuenta: vacía el
  incentivo y es imposible de verificar.
- NO pedir sin necesidad: cada campo obligatorio extra cuesta reservas.
- NO confiar en el conteo de citas del cliente para decidir el descuento
  sin validarlo en el servidor, si algún día el precio pasa a ser firme.
