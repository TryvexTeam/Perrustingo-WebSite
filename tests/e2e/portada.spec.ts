import { test, expect } from "@playwright/test";

/* La cara pública: si esto no carga, no existe el negocio online. */

test("la portada carga con sus textos clave", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Perrustingo/);
  // El titular pedido por el señor Adley (30-jul).
  await expect(page.getByText("Todo lo que tu mascota necesita")).toBeVisible();
  // El aviso corregido: correo, no WhatsApp (30-jul). Si alguien lo revierte
  // sin querer, este test lo delata.
  await expect(page.getByText("Aviso al correo")).toBeVisible();
});

test("el formulario de reserva abre en el primer paso", async ({ page }) => {
  await page.goto("/reserva");
  // Navegador limpio = banner de cookies encima. Se descarta como lo haría
  // un visitante real; "Rechazar" para no consentir nada en un robot.
  const rechazar = page.getByRole("button", { name: "Rechazar" });
  if (await rechazar.isVisible().catch(() => false)) {
    await rechazar.click();
  }
  // El visitante sin sesión ve primero la invitación a crear cuenta — es el
  // camino real, así que el test lo recorre en vez de saltárselo.
  await expect(page.getByRole("heading", { name: "¿Creamos tu cuenta?" })).toBeVisible();
  await page.getByRole("link", { name: "Reservar sin cuenta →" }).click();
  await expect(page.getByText("¿Cuántos perritos vienen?")).toBeVisible();
  // Los tres botones de cantidad, que son la puerta de entrada del flujo.
  await expect(page.getByRole("button", { name: /^1/ })).toBeVisible();
});

test("la agenda semanal carga", async ({ page }) => {
  await page.goto("/agenda");
  await expect(page.getByText("Encuentra la hora perfecta")).toBeVisible();
});
