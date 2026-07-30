# Tests de humo (Playwright)

```bash
npm run test:e2e
```

Reutiliza el servidor de desarrollo si ya está corriendo; si no, lo levanta.

## Qué cubren

- **portada** — la cara pública carga con sus textos clave (incluidos los
  que se corrigieron el 30-jul: "Aviso al correo", "tu mascota")
- **proteccion** — panel, perfil y respaldo rechazan al visitante sin sesión
- **reserva-api** — las puertas del endpoint público rechazan cupones
  inventados, ofertas inexistentes y bots (honeypot), **sin escribir nada**

## Qué NO cubren todavía, y por qué

El flujo completo con sesión — reservar de verdad y confirmar desde el
panel del peluquero — **crea datos y manda correos reales**, porque el
servidor de desarrollo apunta a la base de producción (no existe entorno de
pruebas con base propia).

El día que exista ese entorno, lo que falta es:

1. Reserva completa: wizard de punta a punta con un perrito, verificar que
   la cita nace `pendiente`
2. Panel: login de peluquero → confirmar → recargar → sigue confirmada
   (la prueba que destapó el bug del 30-jul)
3. Aviso "está listo": enviar una vez, verificar que el segundo intento
   rechaza

Presupuesto de rate limit: el endpoint permite 30 peticiones por IP cada
10 minutos; la suite consume 3.
