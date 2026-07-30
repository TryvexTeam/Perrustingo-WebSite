# Pendientes para la próxima reunión con Rodolfo

Lo que quedó fuera del alcance actual, con el motivo. Sirve para llegar a la
reunión con las opciones y los costos sobre la mesa, no para improvisar.

Actualizado: 2026-07-30 · Origen: reunión con el cliente del 27-jul.

---

## 1. SMS para clientes que no usan WhatsApp

**Estado:** no implementado. Requiere decisión comercial.

Resend —lo que el sitio usa hoy— **solo manda correo**. Para SMS hay que
sumar un proveedor aparte (Twilio o similar).

| | Correo | SMS |
|---|---|---|
| Costo | $0, ya está funcionando | Se paga por mensaje |
| Puesta en marcha | Ya hecha | Cuenta nueva, verificación de remitente |
| Llega a clientes mayores | Sí, si tienen correo | Sí, siempre |

**Propuesta para Rodolfo:** partir con correo, que ya funciona y no cuesta.
Si aparecen clientes sin correo *y* sin WhatsApp, se cotiza SMS con números
reales sobre volumen medido, no estimado.

**Si Rodolfo lo quiere igual:** hay que cotizar Twilio formalmente. Es costo
recurrente que alguien tiene que absorber — definir si va en el plan o se
factura aparte.

---

## 2. Calendario de mes completo en el formulario

**Estado:** descartado en esta ronda, por acuerdo.

Rodolfo lo planteó como "un calendario a la vista". Al conversarlo quedó que
lo que necesita es que **al elegir el día** aparezca si hay cupo o no — y eso
sí se implementó.

Un calendario de mes con el estado de cada día pintado es una pantalla nueva
completa y consultas distintas a la base. **Es viable, pero es trabajo
aparte.** Queda disponible si más adelante lo pide.

---

## 3. Contacto peluquero → cliente

**Estado:** ✅ **Hecho y funcionando en producción (30-jul).**

El peluquero aprieta "Avisar que está listo 🐾" y el sistema manda el correo
desde el servidor. Verificado de punta a punta: el correo salió y Resend lo
reporta como `Delivered`.

Desde la migración 030 el aviso **no se puede mandar dos veces**: queda
registrado el instante en que salió, y tanto el panel como el servidor lo
rechazan si ya se avisó. Antes se podía repetir cerrando y reabriendo el
panel — pasó en la verificación, dos correos al mismo cliente en tres
minutos.

WhatsApp funciona con un enlace que **lleva el número dentro**. No existe
forma de que el peluquero abra un chat de WhatsApp sin que el número quede
visible: es cómo funciona WhatsApp, no una decisión del sistema.

Por eso el aviso de "su perrito está listo" sale **por correo desde el
servidor**. El peluquero aprieta un botón y el sistema manda el mensaje; el
dato del cliente nunca pasa por su pantalla.

**Lo que Rodolfo debe saber:** si en algún momento quiere que el aviso salga
por WhatsApp, hay dos caminos y ninguno es gratis:
- WhatsApp Business API (costo por conversación, verificación de empresa)
- Que el aviso lo mande él desde su cuenta de admin

---

## 4. Tope máximo de antelación ("hasta 2 semanas")

**Estado:** no implementado. Falta decisión.

Rodolfo pidió un texto informativo que diga que se reserva con hasta dos
semanas de anticipación. **Ese límite hoy no existe en el sistema**: se puede
reservar para dentro de meses.

Poner el cartel sin la regla sería anunciar algo que el sistema no cumple.
Dos opciones:
- **Agregar el tope de verdad** (trabajo bajo, va en la misma pantalla donde
  ya se configura la anticipación mínima)
- **Dejarlo solo informativo** y aceptar que alguien reserve más lejos

**Recomendación:** agregar el tope. Es barato y evita que el texto mienta.

> Nota: la anticipación **mínima** que Rodolfo pidió configurar **ya existe y
> funciona** — Panel → Disponibilidad. Probablemente no sabe que la tiene.
> Vale la pena mostrársela en la reunión.

---

## 5. Chat interno peluquero ↔ cliente

**Estado:** descartado por costo/beneficio.

Resolvería el contacto sin exponer datos, pero es un módulo completo
(conversaciones, notificaciones, moderación) para un problema que el aviso
por correo ya cubre.

---

## 7. ¿Patricio y Romina atienden al mismo tiempo?

**Estado:** pendiente de respuesta de Rodolfo. Bloquea una decisión concreta.

**La pregunta, tal cual hay que hacérsela:** ¿Patricio y Romina cortan pelo
**a la misma hora**, o se turnan por días o por jornada?

**Por qué importa.** La agenda publica hoy **1 cupo por hora** — un perrito a
la vez. Ese número sale de `capacidad_paralela()`, que cuenta a las personas
marcadas como "atiende citas" en Panel → Usuarios. Hoy no hay ninguna marcada,
así que usa el respaldo, que vale 1.

Si los dos atienden en paralelo, el salón está publicando **la mitad** de sus
cupos reales y perdiendo reservas todos los días sin que nadie lo note.

**Qué hacer con cada respuesta:**

| Rodolfo dice | Acción |
|---|---|
| Atienden juntos, todo el horario | Marcar a ambos en Panel → Usuarios. La capacidad sube sola, sin tocar código |
| Se turnan | No cambiar nada. El 1 actual es correcto |
| Depende del día | El sistema **no lo soporta**: los horarios (`disponibilidad_tramos`) son globales, sin columna de peluquero. Dejar en 1 y evaluar "horarios por persona" como desarrollo aparte |

**Mientras no haya respuesta se deja en 1**, a propósito. El riesgo no es
simétrico: publicar de menos cuesta alguna reserva; publicar de más significa
aceptar dos citas a la misma hora con una sola persona en el salón, y que un
cliente llegue con su perrito a que no lo atiendan.

---

## 6. Protección de datos: alcance de lo que se hará

Cuando se implemente la restricción para peluqueros, conviene que Rodolfo
sepa que son **dos puertas al mismo dato**, no una:

1. El panel de citas — muestra teléfono y correo con botón de WhatsApp
2. La tabla de perfiles — guarda el teléfono de todo cliente registrado

Cerrar solo la primera deja la segunda abierta. El plan es cerrar ambas a
nivel de base de datos, no solo de pantalla: una restricción que vive únicamente
en la interfaz se rodea desde el navegador.

## 8. Aviso "está listo": ¿copia al salón para avisar también por WhatsApp?

**Estado:** pendiente de respuesta de Rodolfo. La página ya se corrigió.

**Contexto.** Como Rodolfo pidió que los peluqueros no vieran el contacto del
cliente, el aviso de "su perrito está listo" sale **por correo desde el
servidor**: el peluquero aprieta el botón sin ver a quién le llega. La página
de inicio prometía ese aviso "por WhatsApp" — texto que quedó viejo y ya se
corrigió (30-jul): ahora dice correo, que es lo que de verdad pasa.

**La pregunta para Rodolfo:** cuando el aviso le llega al correo del cliente,
¿quiere que **también llegue una copia al correo del salón**? Con esa copia,
él (o quien administre) sabría en el momento que el perrito está listo y
podría escribirle al cliente por WhatsApp desde su propio teléfono — el aviso
por WhatsApp seguiría existiendo, pero lo daría el admin, que sí puede ver el
contacto. La alternativa es dejarlo solo por correo al cliente.

| Si Rodolfo dice | Qué implica |
|---|---|
| Solo correo al cliente (como hoy) | Nada que hacer |
| Copia al salón para avisar él por WhatsApp | Cambio chico: el mismo aviso se manda también a la casilla del salón, con el enlace de WhatsApp del cliente listo para tocar. El peluquero sigue sin ver nada |

**Dato para la conversación:** la casilla del salón ya recibe un correo por
cada reserva nueva, así que esto sería un correo más del mismo estilo. Y si
más adelante quiere que el WhatsApp salga solo, sin pasar por él, eso es la
WhatsApp Business API del punto 3 — con su costo por conversación.

---

## 9. Cancelación de citas por el cliente

**Estado:** ✅ **Resuelto con solicitud por WhatsApp (30-jul, idea del señor
Adley).** Queda una pregunta opcional para Rodolfo.

En "Mi cuenta", junto a la próxima cita, el cliente tiene el botón
"¿Necesitas cancelar o cambiar la hora? Avísanos por WhatsApp" — abre el
chat del salón con el mensaje ya escrito (quién es, qué perrito, qué día y
hora). **El cliente solicita; el equipo decide y cancela en el panel.** Así
nadie se auto-cancela cinco minutos antes y la agenda nunca queda a merced
de un clic. El cupo se libera cuando el equipo cancela.

**Pregunta opcional para Rodolfo:** ¿más adelante querrá cancelación
automática (el cliente cancela solo, sin pasar por él)? Solo tendría
sentido con una regla de anticipación — "cancelable hasta X horas antes" —
que él defina. Con el volumen actual, la solicitud por WhatsApp
probablemente alcanza y sobra.

---

# Mejoras detectadas el 30-jul (por priorizar)

Observadas usando el sitio como cliente y como admin. No son fallas — el
sistema funciona — pero son fricciones reales que vale la pena priorizar.

## I. Reservar de nuevo con un perrito ya guardado

**Estado:** ✅ **Hecho y en producción (30-jul, PR #37 y #39).**

El formulario de reserva muestra los perros guardados de la cuenta
(deduplicados) y tocar uno precarga la ficha completa; el servidor
REUTILIZA la ficha en vez de duplicarla. Además, desde "Mi cuenta" el
cliente edita la ficha de cada perro, elimina los que ya no están, agrega
nuevos, corrige sus propios datos de contacto (el teléfono que el salón usa
para confirmar), y ve su próxima cita destacada arriba de todo.

## II. El admin no puede eliminar una cuenta

**Estado:** ✅ **Hecho y en producción (30-jul, PR #37).**

En Panel → Usuarios, cada cuenta ajena no-admin tiene "Eliminar esta
cuenta…" con confirmación en dos pasos. Borra la cuenta de acceso, el
perfil y sus perros; **las citas que atendió quedan en el historial, sin
datos personales** (la base lo resuelve con SET NULL). Nadie puede
eliminarse a sí mismo, y a un admin hay que bajarle el rol primero — así el
borrado nunca esquiva la protección del último admin.

## III. No se pueden borrar citas del registro (ni las de prueba)

**Estado:** ✅ **Hecho y en producción (30-jul, PR #37).**

En Panel → Citas, el botón "Borrar citas…" (solo admin) activa selección
múltiple **solo sobre canceladas y completadas** — una pendiente o
confirmada es una promesa activa con un cliente y hay que cancelarla
primero, mirándola. Doble confirmación; el borrado arrastra las fotos de
Storage y el evento del calendario. La cita de prueba "Aaxads" ya se borró
con este flujo como verificación; el resto de las pruebas las puede limpiar
el equipo desde el panel cuando quiera.

---

# Deuda técnica interna

No son preguntas para Rodolfo — son trabajo del equipo. Quedan acá para que
no se pierdan y para poder mencionarlas si pregunta "¿qué sigue?". Origen:
revisión completa del código, 30-jul (8 acciones del panel, 4 rutas API,
RLS/vistas y flujo de reserva; los 3 hallazgos accionables se arreglaron y
desplegaron ese mismo día).

## A. Tests automatizados

**Estado:** ✅ **Primera suite hecha (30-jul).** `npm run test:e2e` — 9 tests
de humo con Playwright: la portada con sus textos clave, el formulario de
reserva abre (recorriendo la invitación a crear cuenta, como un visitante
real), la agenda carga, panel/perfil/respaldo rechazan sin sesión, y las
puertas del endpoint público rechazan cupones inventados, ofertas
inexistentes y bots — todo sin escribir nada en la base.

**Lo que falta y por qué** (documentado en `tests/e2e/README.md`): el flujo
completo con sesión — reservar de verdad y confirmar desde el panel — crea
datos y manda correos reales, porque el desarrollo apunta a la base de
producción. El paso siguiente es un entorno de pruebas con base propia;
recién ahí esos flujos se automatizan.

## B. Extraer el guardián de admin compartido (`lib/guards.ts`)

El bloque `getUser → leer rol → exigir admin` está copiado en ~8 archivos de
acciones, con variantes (`exigirAdmin` en unos, inline en otros; también
`mensajeDeError` ×3 y la interfaz `ResultadoAccion` ×8).

**El costo quedó demostrado el 30-jul:** cuando el panel recibió la
verificación de filas afectadas, tarifas se quedó atrás — con código
duplicado los arreglos no se propagan solos. Refactor mecánico (~30 min):
`exigirAdmin`/`exigirEquipo` + `ResultadoAccion` compartidos en `lib/`.

**A propósito NO se hizo antes de la reunión**: un refactor transversal justo
antes de una demo agrega riesgo sin beneficio visible.

## C. Anotados, sin urgencia

- **Carrera por el último cupo**: ✅ **cerrada (30-jul, migración 031)** —
  trigger en la base con advisory lock: dos reservas simultáneas por el
  mismo bloque se serializan y la segunda rechaza con "Ese horario acaba de
  llenarse" si ya no hay cupo. ⚠️ **La 031 hay que aplicarla en el SQL
  Editor de Supabase.**
- **Aviso de deprecación de Next.js**: ✅ **hecho (30-jul)** —
  `middleware.ts` renombrado a `proxy.ts` según la convención de Next 16;
  el aviso de cada arranque desapareció. Mismo comportamiento.
- **Listas de columnas de `sesiones_equipo` repetidas en ~5 páginas** y
  **`FormReserva.tsx` con ~1.700 líneas**: repetición consistente, tolerable
  hoy; se ordena junto con el refactor B o cuando se toque esa zona.
