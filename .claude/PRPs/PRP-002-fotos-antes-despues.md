# PRP-002: Fotos del antes y después — respaldo de evidencia

> **Estado**: APROBADO EN CRITERIOS (2026-07-26) — listo para ejecutar con `/bucle-agentico`
> **Fecha**: 2026-07-26
> **Proyecto**: Perrustingo (TryvexTeam/Perrustingo-WebSite, rama `develop`)
> **Depende de**: PR #17 (PRP-001 F0–F6) mergeado

---

## Objetivo

Que cada cita tenga su registro visual del antes y el después, **como
respaldo del equipo ante un reclamo**: si un cliente dice que su perrito
salió con algo, hay material asociado a esa cita, ese día y esa hora.

El cliente aporta la foto del "antes" al reservar (tomada con la cámara, no
de la galería); el equipo sube el "después" al terminar. Las fotos son
**internas**: las ve y descarga el equipo, no el cliente.

---

## Decisiones tomadas por el señor Ignacio (2026-07-26)

1. **La foto del "después" NO bloquea el cierre de la cita.** Se puede
   completar sin ella, pero la ficha avisa que falta, bien visible. En un
   día cargado, trabar el trabajo del local por una foto es peor.
2. **Retención: 12 meses como piso, y cuanto mejor la compresión, mayor el
   lapso.** → Se optimiza la compresión primero y el plazo se define con el
   número resultante (ver "Cuentas").
3. **Propósito: respaldo de evidencia del equipo.** No es una galería para
   el cliente. Esto cambia tres cosas:
   - El bucket pasa a **privado**; el equipo accede con URLs firmadas.
   - Cada foto registra **quién la subió y cuándo** — sin trazabilidad no
     es evidencia, es una imagen suelta.
   - **Borrar una foto queda restringido a admin**: si el equipo pudiera
     borrar libremente, desaparecería justo la prueba que se necesita.

---

## Corrección de la premisa (para que quede escrito)

La preocupación era correcta, pero el problema ya estaba resuelto:

| Preocupación | Realidad |
|---|---|
| "saturan la base de datos" | **No la tocan.** Van a Supabase **Storage** (bucket `reservas`), separado de Postgres. En la base queda solo la URL: ~200 bytes por foto. |
| "localStorage no sirve en producción" | **Correcto, y no se usa.** `lib/fotos.ts` sube a Storage; el último resto de dataURL se eliminó en PRP-001 F3. |
| "hará que la web vaya lag" | El riesgo no es el almacenamiento: es **servir imágenes de 4 MB**. Se arregla comprimiendo antes de subir. |

---

## Cuentas (lo que decide el plazo de retención)

Supabase gratuito da **1 GB de Storage**. Estimando 260 citas al mes
(10 diarias) con 2 fotos cada una = **520 fotos/mes**:

| Formato | Peso por foto | Capacidad | Duración |
|---|---|---|---|
| Sin comprimir (celular) | ~4 MB | ~260 fotos | **~2 semanas** |
| JPEG 1280 px, q0.8 | ~200 KB | ~5.200 | ~10 meses |
| **WebP 1600 px, q0.82** ← propuesta | **~150 KB** | **~7.000** | **~13 meses** |
| WebP 1280 px, q0.75 | ~90 KB | ~11.600 | ~22 meses |

**Propuesta: WebP a 1600 px.** WebP pesa ~30 % menos que JPEG con la misma
calidad visual, y 1600 px conserva el detalle que una evidencia necesita
(si el reclamo es "le cortaron mal una oreja", una imagen de 1280 px muy
comprimida no sirve de prueba). Con eso, **12 meses de retención caben
holgados en el plan gratuito** y sobra margen.

> Si el negocio crece a 20 citas diarias, con esta compresión el plan
> gratuito rinde ~6 meses; ampliar a 100 GB cuesta del orden de USD 2 al
> mes. El sistema avisa antes de llegar al límite (Fase 5).

---

## Qué ya existe (verificado en el código)

| Pieza | Estado |
|---|---|
| Bucket `reservas` + policies | ✅ migración 004 |
| `fotos_sesion(sesion_id, tipo, url, notas)` con RLS | ✅ `schema.sql` |
| Subida con falla suave (`lib/fotos.ts`) | ✅ una foto caída no bota la reserva |
| **Cámara sin galería** (`capture="environment"`) | ✅ ya implementado |
| Casilla "no tengo a mi perrito cerca" | ✅ ya existe |
| Compresor canvas (para anuncios) | ✅ `lib/promosUpload.ts` — se extrae y comparte |

**Los dos primeros puntos del pedido ya están construidos.**

---

## Qué falta

1. **Compresión en las fotos de citas** — hoy suben tal cual salen del
   celular (3–5 MB). Es el punto crítico.
2. **Aviso al cliente** de que se le tomarán fotos del antes y el después
   en el local, también cuando marque que no tiene al perrito cerca.
3. **Subir el "después"** desde la ficha de la cita en el panel.
4. **Ver y descargar** las fotos de una cita (solo equipo).
5. **Bucket privado + URLs firmadas**, y trazabilidad de quién subió qué.
6. **Retención automática** a los 12 meses + aviso de espacio.

### Lo que NO se hace (y por qué)
- **Cámara forzada en escritorio**: `capture` funciona en móvil; en un
  computador el navegador lo ignora. Forzarla exige `getUserMedia`
  (permisos, cámara ocupada, más código). Los clientes reservan por
  teléfono: no vale la pena hoy.
- **Galería para el cliente**: las fotos son respaldo interno.

---

## Estructura

```
Cliente reserva (móvil)
  └─ FotoPicker (capture=camera)
       └─ comprimir en el navegador   ← 4 MB → ~150 KB, ANTES de subir
            └─ Storage privado `reservas`  →  <sesion_id>/antes-<ts>.webp
                 └─ fila en `fotos_sesion` (tipo='antes', subida_por, created_at)

Equipo termina el servicio (panel)
  └─ "Subir foto del resultado" en la ficha de la cita
       └─ misma compresión → tipo='despues', subida_por = quien la sube

Ver / descargar (solo equipo)
  └─ URL firmada de corta duración → <Image> con dimensiones fijas
       └─ el binario nunca pasa por Postgres

Limpieza (mensual)
  └─ borra objeto + fila con más de 12 meses; avisa si el bucket se llena
```

**Archivos previstos**
```
lib/imagen.ts                          (nuevo)  comprimirImagen() compartida
lib/fotos.ts                           (editar) compresión + rutas por sesión
app/dashboard/citas/fotos-actions.ts   (nuevo)  subir/borrar con guard de rol
components/admin/FotosCita.tsx         (nuevo)  antes/después + subir + descargar
components/reserva/FormReserva.tsx     (editar) aviso de fotos en el local
supabase/migrations/013_fotos_evidencia.sql (nuevo) subida_por, bucket privado,
                                                   policies, retención
```

---

## Fases

### Fase 1 ✅ COMPLETA (2026-07-26): Compresión compartida (la que decide todo)
`lib/imagen.ts` con `comprimirImagen(file, {maxLado, calidad, formato})`,
usada por las fotos de citas y por los anuncios (hoy duplicado).
**Validación** ✅ verificada en un navegador real, con el módulo de
producción (no una copia del algoritmo):
- Foto de cámara 4032×3024, 1.778 KB → **190 KB WebP a 1600×1200** (9,4×),
  y el objeto **en Storage pesa esos mismos 190 KB**.
- Preset de banner: 1.778 KB → 100 KB a 900×675 (17,7×).
- **Orientación EXIF**: archivo guardado 400×200 con `Orientation=6`; el
  navegador lo muestra 200×400 y **el compresor entrega 200×400** — no sale
  de costado.
- No agranda: con `maxLado` 5000 una imagen de 4032 px se queda en 4032.

### Fase 2: Aviso al cliente
Texto claro de que el equipo tomará fotos del antes y el después, visible
también al marcar "no tengo al perrito cerca".
**Validación**: screenshot del paso de fotos en ambos casos.

### Fase 3: Foto del "después" desde el panel
Subida desde la ficha de la cita, con guard de equipo, compresión y
registro de quién la sube. Aviso visible de "falta el después" (sin
bloquear el cierre, por decisión 1).
**Validación**: subir como trabajador y ver la foto en la ficha; un cliente
que intente subir a una cita ajena es rechazado (verificado por PostgREST,
no solo por la UI).

### Fase 4: Bucket privado + galería del equipo
Pasar `reservas` a privado, servir con URLs firmadas, galería antes/después
con descarga. Borrado restringido a admin.
**Validación**: la URL pública directa deja de funcionar (403); la firmada
sirve la imagen; un cliente no accede a fotos de ninguna cita; un
trabajador no puede borrar.
⚠️ **Ojo**: hay fotos ya subidas con URL pública. La fase incluye migrarlas
y no dejar ninguna referencia rota.

### Fase 5: Retención y aviso de espacio
Limpieza mensual de lo que supere 12 meses (objeto + fila) y aviso en el
panel cuando el bucket pase cierto uso.
**Validación**: con una fila antigua de prueba, ejecutar la limpieza y
comprobar que desaparecen el objeto y la fila; una cita reciente no se toca.

---

### Fase 6: La foto llega al WhatsApp del negocio

**Limitación de WhatsApp (no es una decisión de diseño):** el enlace
`wa.me/<numero>?text=...` —que es lo que usa el formulario— **solo acepta
texto**. No existe ningún parámetro para adjuntar una imagen. Ningún sitio
web puede meter un archivo en ese mensaje. Las únicas tres vías reales:

| Vía | Qué logra | Costo |
|---|---|---|
| **A. Enlace en el mensaje** | El texto lleva "📷 Ver fotos: …" y el equipo abre la ficha de la cita con su sesión | Ninguno. Funciona hoy |
| **B. Hoja de compartir del móvil** (`navigator.share` con archivos) | La imagen **sí** viaja al chat como imagen. El cliente elige WhatsApp en la hoja del sistema | Ninguno, pero es un segundo toque y solo en móvil |
| **C. WhatsApp Cloud API** | El sistema envía el mensaje con la foto, solo | Cuenta de WhatsApp Business verificada, plantillas aprobadas y pago por conversación |

**Propuesta: A + B.** A garantiza que el equipo siempre llegue a la foto;
B hace que en el celular —donde reservan casi todos— la imagen llegue de
verdad al chat.

- **A**: al enviar, el endpoint ya devuelve los `ids` de las citas creadas
  (`{ success: true, data: { ids } }`). El mensaje incluye un enlace a la
  ficha en el panel (`/dashboard/citas?cita=<id>`), que **exige sesión de
  equipo**: si el enlace se reenvía, quien no sea del equipo no ve nada.
  Coherente con "las fotos son respaldo interno".
- **B**: si el navegador soporta `navigator.canShare({ files })`, ofrecer
  "Enviar también la foto 📷" junto al botón de WhatsApp. Si no lo soporta,
  el botón no aparece: nada se rompe y el enlace de A ya cubre el caso.

**Validación**:
- El mensaje generado contiene el enlace a la ficha y el enlace abre las
  fotos con sesión de equipo (y **no** sin ella).
- En móvil real, el botón de compartir entrega la imagen a WhatsApp.
- Sin fotos (el cliente marcó "no tengo al perrito cerca"), el mensaje no
  incluye enlace muerto.

> Si más adelante se quiere el envío automático con la imagen (vía C), es
> un proyecto aparte: número de empresa verificado, plantillas y costo por
> conversación. No se hace en este PRP.

## Gotchas

- **EXIF de orientación**: las fotos de celular vienen rotadas; al pasarlas
  por canvas se pierde el flag y salen de costado. Hay que aplicar la
  rotación al comprimir. Es el error clásico de esta función.
- **`canvas.toBlob` con WebP**: soportado en Safari iOS 14+. Si el
  navegador lo rechaza, caer a JPEG en vez de subir el original.
- **Migrar el bucket a privado rompe las URLs guardadas**: las filas
  existentes de `fotos_sesion` apuntan a `/object/public/...`. Hay que
  reescribirlas o resolver la ruta al firmar.
- **`fotos_sesion.tipo` tiene un CHECK**: admite `antes`/`durante`/
  `despues`/`referencia` (migración 004). No inventar tipos nuevos sin
  ampliar el CHECK.
- **La política de storage exige el uid como primera carpeta** para las
  subidas del cliente (migración 004). Cambiar la ruta a `<sesion_id>/`
  obliga a ajustar esa policy, o el cliente no podrá subir.
- **Borrar la cita borra la fila** (`ON DELETE CASCADE`) **pero no el
  objeto del bucket**: quedaría basura huérfana. La limpieza debe
  contemplarlo.
- **HALLAZGO F1: el bucket `reservas` NO tiene policy de DELETE.** Ni el
  dueño ni un admin pueden borrar un objeto con la clave anon (403 Access
  denied); solo se puede desde el panel de Supabase. La Fase 5 (retención)
  **no funcionará** hasta agregar esa policy — sin ella la limpieza
  automática no borra nada y el aviso de "12 meses" sería falso.
- **`storage.objects` no admite DELETE por SQL** (`storage.protect_delete()`
  lo bloquea): hay que usar la Storage API o el panel.
- **El mensaje de WhatsApp se arma hoy sin esperar la respuesta del
  endpoint**: el POST y el `buildWhatsAppMessageMulti` corren en paralelo.
  Para incluir el enlace a la cita hay que encadenarlos — y con cuidado,
  porque si la reserva falla el mensaje igual debe salir (el WhatsApp es el
  canal real del negocio; perder la conversación es peor que perder el
  enlace).
- **`navigator.share` exige gesto del usuario y HTTPS**: no se puede
  disparar dentro de un `then()` lejano ni en `localhost` sin HTTPS. Se
  prueba en móvil real o con un túnel, no en el escritorio.

## Anti-patrones

- NO guardar imágenes ni base64 en columnas de Postgres.
- NO volver a `localStorage` (se eliminó en PRP-001 F3).
- NO subir el original "por si acaso": es la diferencia entre 2 semanas y
  13 meses de plan gratuito.
- NO permitir que cualquiera borre fotos: son evidencia.
- NO servir imágenes sin `width`/`height` (provoca saltos de maquetación).
- NO borrar fotos al cancelar una cita: el registro puede ser justamente la
  prueba de un reclamo.
