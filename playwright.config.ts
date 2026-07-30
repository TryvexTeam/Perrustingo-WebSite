import { defineConfig } from "@playwright/test";

/* Suite mínima de humo (deuda técnica A, 30-jul). No reemplaza las pruebas
   manuales — las hace repetibles: los dos caminos que dan de comer al
   negocio (reservar y el panel) se revisan solos antes de cada publicación,
   en vez de depender de que alguien se acuerde.

   OJO: el servidor de desarrollo apunta a la base REAL. Por eso ningún test
   crea reservas ni escribe nada — solo se ejercitan las puertas que
   rechazan (sin efectos) y las pantallas públicas. El flujo completo con
   sesión queda documentado en tests/e2e/README.md para cuando exista un
   entorno de pruebas con su propia base. */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Si el servidor ya está corriendo (desarrollo normal), se reutiliza.
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
