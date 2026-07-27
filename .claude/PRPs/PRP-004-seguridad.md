# PRP-004: Seguridad y resistencia a ataques

> **Estado**: APROBADO EN CRITERIOS (2026-07-26) — listo para ejecutar
> **Fecha**: 2026-07-26
> **Proyecto**: Perrustingo (TryvexTeam/Perrustingo-WebSite)

---

## Objetivo

Que la plataforma resista un ataque automatizado, y que si igual la atacan
**el negocio siga operando y no se pierda nada**.

No es un endurecimiento genérico: se ataca lo que de verdad puede hacer
daño a esta peluquería, medido contra el sistema real.

---

## Auditoría (hecha el 2026-07-26, no supuesta)

### 🔴 Lo grave: 8 reservas falsas llenan un día completo

Se simuló un ataque contra el endpoint público:

```
14 intentos seguidos → 8 aceptadas · 6 rechazadas (429)
```

Ocho reservas bastan para ocupar casi toda una jornada: con capacidad de
1 cita por hora y 10 bloques diarios, **un atacante deja el local sin
agenda vendible**. Y el límite se reinicia cada 10 minutos: 48 reservas por
hora, suficiente para bloquear una semana en una tarde.

El daño no es técnico —nada se rompe— es **comercial**: el equipo llega el
lunes con la agenda llena de citas que nadie va a pagar, y los clientes
reales no encuentran hora.

### 🔴 El rate limit actual no funciona en producción

```js
const intentos = new Map<string, {...}>();   // memoria del proceso
```

En Vercel cada petición puede caer en una **instancia distinta**, y cada una
tiene su propio contador. El límite real no es "8 cada 10 minutos": es
**8 × instancias activas**, y se reinicia en cada despliegue o arranque en
frío. En local funcionó (un solo proceso) — en producción no.

### 🟠 Se pueden enumerar teléfonos

`visitas_de_telefono()` está expuesta a `anon` sin límite:

```
5 consultas anónimas respondidas en 914 ms
```

Permite probar números y averiguar **si una persona es clienta de
Perrustingo y cuántas veces vino**. No expone nombre ni dirección, pero sí
confirma la relación — y con un diccionario de números chilenos se puede
barrer masivamente.

### 🟢 Lo que ya está bien (verificado)

| Defensa | Estado |
|---|---|
| Honeypot anti-bot (`apellidoPaterno`) | ✅ funciona — devuelve 400 |
| RLS activo en todas las tablas de `public` | ✅ ninguna quedó fuera |
| `rls_auto_enable` | ✅ **event trigger que activa RLS solo en cada tabla nueva** — alguien dejó puesta una buena defensa |
| Escalada de rol | ✅ `42501` (probado en PRP-001 F1) |
| Guard del último admin | ✅ |
| Funciones `SECURITY DEFINER` con `search_path` fijo | ✅ todas |
| `emails_de_perfiles()` | ✅ solo `authenticated` + valida admin adentro |
| `vincular_historial()` | ✅ solo el perfil propio, solo filas sin dueño |
| Validación del servidor en reservas | ✅ no confía en el navegador |
| Capacidad y lead time validados en el servidor | ✅ (PRP-001 F5) |

**El sistema no está indefenso**: lo que falta es el control de volumen.

---

## Amenazas priorizadas

| # | Amenaza | Daño | Hoy |
|---|---|---|---|
| 1 | **Llenar la agenda** con reservas falsas | El local no puede vender | 🔴 8 bastan |
| 2 | **Enumerar teléfonos** | Privacidad de clientes | 🟠 sin límite |
| 3 | **Llenar el Storage** con fotos | Se acaba el plan gratuito | 🟠 sin límite por usuario |
| 4 | **Crear cuentas en masa** | Ruido en el dashboard | 🟡 límites de Supabase |
| 5 | **Perder datos** (borrado accidental o malicioso) | Irrecuperable | ⚠️ **sin verificar** |

---

## Qué se construye

### Fase 1 ✅ COMPLETA (2026-07-26): Rate limit que funcione en serverless
Contador en la base de datos (no en memoria), por **IP y por teléfono**.
Vale para reservas y para la consulta de visitas.
- Tabla `rate_limit(clave, ventana, contador)` + función que incrementa y
  decide en una sola operación atómica (dos peticiones simultáneas no
  pueden colarse por la rendija).
- Sin dependencias nuevas: Postgres ya está y el estado tiene que ser
  compartido igual.
- **Validación**: 20 peticiones seguidas → las primeras N pasan y el resto
  recibe 429, **y sigue rechazando después de reiniciar el servidor**
  (que es justo lo que el Map en memoria no hace).

### Fase 2 ✅ COMPLETA (2026-07-26): Techo de reservas por persona
El rate limit por IP no alcanza: un atacante rota IPs. Reglas de negocio:
- máximo N citas activas por teléfono (una familia normal pide 1–3);
- máximo N reservas nuevas por teléfono al día;
- máximo N reservas sin confirmar por día en todo el local (freno de
  emergencia configurable, que el admin ve y puede subir).
- **Validación**: el mismo teléfono no puede tomar 10 bloques; un cliente
  normal (2 perritos, 2 fechas) no se ve afectado. **Este es el criterio
  que importa: frenar al atacante sin estorbar al cliente real.**

### Fase 3 ✅ COMPLETA (2026-07-26): Cerrar la enumeración de teléfonos
`visitas_de_telefono()` deja de estar expuesta a `anon`: el conteo se hace
en el servidor, dentro del endpoint que ya tiene rate limit.
- **Validación**: la llamada anónima directa a la función devuelve 401/403;
  el formulario sigue reconociendo al cliente que vuelve.

### Fase 4: Límites en Storage 🟠
Tope de fotos por sesión y por usuario; y la policy de DELETE que falta
(hallazgo de PRP-002 F1: hoy **nadie puede borrar** un objeto del bucket,
así que la retención de 12 meses no funcionaría).
- **Validación**: subir más del tope se rechaza; la limpieza puede borrar.

### Fase 5: Que un ataque no borre nada 🔴
Lo que pidió el señor Ignacio: *"si la atacan, que no afecte"*.
- **Verificar si hay respaldos** y con qué frecuencia (Supabase gratuito
  **no incluye recuperación a un punto en el tiempo**; hay que confirmar
  qué existe realmente antes de suponer que estamos cubiertos).
- Respaldo propio si hace falta: export diario de las tablas del negocio.
- Que las citas **no se borren nunca**: cancelar ya cambia el estado en vez
  de borrar; revisar que nada más borre en cascada algo irrecuperable.
- **Validación**: restaurar un respaldo en un proyecto de prueba y
  comprobar que las citas están. **Un respaldo que nunca se restauró no es
  un respaldo, es una carpeta.**

### Fase 6: Enterarse cuando pasa
Aviso al admin cuando algo se sale de lo normal: muchas reservas sin
confirmar en pocas horas, o muchos 429 seguidos.
- **Validación**: simular el ataque de la auditoría y comprobar que el
  aviso llega.

---

## Decisiones tomadas por el señor Ignacio (2026-07-26)

1. **Máximo 4 citas activas por teléfono.** Cubre a una familia con varios
   perritos y dos fechas; frena a quien quiera tomar la agenda entera. El
   número queda configurable en el panel, no fijo en el código.

2. **El sistema NUNCA cierra la reserva por su cuenta: acepta y avisa.** Un
   falso positivo que bloquea cuesta clientes reales; uno que solo avisa no
   cuesta nada. El admin decide qué hacer con el aviso.
   → Consecuencia de diseño: los topes de la Fase 2 son **frenos duros por
   teléfono** (un abusador concreto), no interruptores globales. El único
   freno global posible es manual, desde el panel.

3. **Sin CAPTCHA por ahora.** Cuesta conversión justo donde acabamos de
   quitarla (PRP-003). Queda como carta si el abuso persiste pese al rate
   limit y los topes.

---

## Anti-patrones

- NO guardar contadores en memoria del proceso: en serverless no existe
  "el proceso".
- NO bloquear al cliente real por frenar al atacante: cada falso positivo
  es una reserva perdida, y el negocio acaba de abrir la puerta.
- NO confiar en la IP como identidad: se rota con facilidad. Va acompañada
  del teléfono.
- NO suponer que hay respaldos porque el proveedor "seguro tiene". Se
  verifica restaurando.
- NO exponer funciones `SECURITY DEFINER` a `anon` sin preguntarse qué se
  puede enumerar con ellas.

---

## Lo que estas fases NO resuelven (medido, 2026-07-26)

Tras F1–F3 se repitió el ataque de la auditoría con **un teléfono distinto
en cada intento**:

```
10 intentos, 10 teléfonos falsos → 10 citas creadas
```

El tope por teléfono no lo frena, porque nunca repite número. El rate limit
por IP tampoco: se subió a 30 a propósito para no bloquear a clientes
legítimos detrás de CGNAT.

**Conclusión honesta: lo construido sube el costo del ataque, no lo
elimina.** Frena al abusador casual y al bot tonto; un atacante decidido a
llenar la agenda con teléfonos inventados todavía puede.

Y como el señor Ignacio decidió —con razón— que el sistema **nunca cierra
la reserva por su cuenta**, el último recurso no puede ser automático. Lo
que queda:

1. **F6 (aviso) deja de ser un extra y pasa a ser la defensa principal**
   contra este caso: el admin se entera en horas, no el lunes, y cancela en
   bloque desde el panel.
2. **Cancelar en bloque desde el panel** (no existe hoy): si entran 40
   citas falsas, el equipo necesita descartarlas de una vez, no una por una.
3. **Verificar el teléfono** (código por WhatsApp/SMS) es la única defensa
   que ata de verdad una reserva a una persona real. Cuesta fricción y un
   servicio de mensajería — es una decisión de negocio, no técnica, y por
   eso no se toma sin el señor Ignacio.
