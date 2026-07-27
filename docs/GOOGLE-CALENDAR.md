# Google Calendar — respaldo de las citas confirmadas

Cada cita que el equipo **confirma** en el panel se copia al Google Calendar
del negocio; si se **cancela**, el evento se borra. Es un espejo de respaldo:
la agenda real sigue siendo la plataforma.

**Sin configurar, la plataforma funciona igual.** Todas las llamadas a Google
son no-op silencioso mientras falten las variables — verificado: confirmar una
cita sin credenciales la deja `confirmada` y no registra ningún error.

## Variables de entorno

En Vercel → proyecto → **Settings → Environment Variables** (Production):

| Variable | De dónde sale | Obligatoria |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | credencial OAuth de Google Cloud Console | sí |
| `GOOGLE_OAUTH_CLIENT_SECRET` | ídem | sí |
| `GOOGLE_CALENDAR_REFRESH_TOKEN` | se obtiene una vez con el flujo de abajo | sí |
| `GOOGLE_CALENDAR_ID` | id del calendario; por defecto `primary` | no |

## Puesta en marcha (una sola vez)

1. **Google Cloud Console** → crear proyecto (o usar uno existente).
2. **APIs y servicios → Biblioteca** → habilitar **Google Calendar API**.
3. **Pantalla de consentimiento OAuth**: publicarla como **In production**.
   Si queda en *Testing*, el refresh token **expira a los 7 días** y el
   respaldo deja de funcionar en silencio.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth** → tipo
   *Aplicación web*. En **URI de redirección autorizados** agregar:
   ```
   https://<dominio-del-sitio>/api/google/callback
   ```
   (una entrada por dominio: el de Vercel y, cuando exista, `perrustingo.com`).
5. Cargar `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` en Vercel y
   **redeploy**.
6. Entrar al sitio **como admin** y visitar `/api/google/connect`. Google pide
   permiso; al aceptar, la página muestra el **refresh token una sola vez**.
7. Guardarlo como `GOOGLE_CALENDAR_REFRESH_TOKEN` en Vercel y **redeploy**.

Desde ahí, cada confirmación crea o actualiza su evento.

## Cómo comprobar que quedó andando

Confirmar una cita de prueba en `/dashboard/citas` y verificar que aparece en
el calendario del negocio, a la **misma hora** que muestra el panel.

## Detalles que conviene saber

- **El id del evento es determinístico**: se deriva del uuid de la cita (sin
  guiones). Por eso no hace falta guardar el id de Google en la base, y
  confirmar dos veces actualiza el mismo evento en vez de duplicarlo.
- **Reconfirmar revive el evento**: si una cita se cancela (evento borrado) y
  luego se vuelve a confirmar, el `PUT` lo restaura.
- **Un fallo de Google nunca bloquea el panel**: la cita ya quedó guardada en
  la base; el error solo se registra en los logs (`[google-calendar]`).
- **Horario de verano**: los instantes se construyen con `offsetNegocio()`
  (`lib/agenda.ts`), que devuelve `-04:00` o `-03:00` según la fecha. Chile
  cambia de hora dos veces al año; un offset fijo corría las citas una hora.
- **El refresh token no se guarda en la plataforma**: la variable de entorno es
  la única fuente. Si se pierde, se repite el paso 6.
