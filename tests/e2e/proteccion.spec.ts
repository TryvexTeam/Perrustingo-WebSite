import { test, expect } from "@playwright/test";

/* Las puertas cerradas. Cada test corre en un navegador limpio, sin sesión
   — exactamente el visitante que estas rutas deben rechazar. */

test("el panel del equipo exige sesión", async ({ page }) => {
  await page.goto("/dashboard/citas");
  await expect(page).toHaveURL(/\/login/);
});

test("el perfil exige sesión", async ({ page }) => {
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/login/);
});

test("el respaldo del negocio exige sesión", async ({ request }) => {
  const r = await request.get("/api/respaldo");
  expect(r.status()).toBe(401);
});
