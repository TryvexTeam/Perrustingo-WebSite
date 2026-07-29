# Pendientes para la próxima reunión con Rodolfo

Lo que quedó fuera del alcance actual, con el motivo. Sirve para llegar a la
reunión con las opciones y los costos sobre la mesa, no para improvisar.

Actualizado: 2026-07-29 · Origen: reunión con el cliente del 27-jul.

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

**Estado:** decidido por correo. Documentado acá por la limitación técnica.

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

## 6. Protección de datos: alcance de lo que se hará

Cuando se implemente la restricción para peluqueros, conviene que Rodolfo
sepa que son **dos puertas al mismo dato**, no una:

1. El panel de citas — muestra teléfono y correo con botón de WhatsApp
2. La tabla de perfiles — guarda el teléfono de todo cliente registrado

Cerrar solo la primera deja la segunda abierta. El plan es cerrar ambas a
nivel de base de datos, no solo de pantalla: una restricción que vive únicamente
en la interfaz se rodea desde el navegador.
