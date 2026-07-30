import { test, expect } from "@playwright/test";

/* Las puertas del endpoint público de reservas. Todos estos casos RECHAZAN
   antes de escribir nada — por eso son seguros contra la base real. Son
   las defensas que la revisión del 30-jul endureció; si una regresión las
   abre, estos tests fallan.

   Presupuesto: el rate limit por IP es 30 cada 10 minutos; esta suite
   consume 3. */

const CONTACTO = {
  nombre: "Prueba Automatica",
  email: "pruebas@example.com",
  telefono: "+56 9 5555 0000",
  comuna: "Renca",
};

const PERRO = { detalle: { nombrePerro: "Test" }, precioEstimado: 10000 };

test("un cupón inventado rechaza la reserva", async ({ request }) => {
  const r = await request.post("/api/reservas", {
    data: {
      contacto: CONTACTO,
      fechaDeseada: "2026-09-15",
      servicio: "Baño completo",
      cupon: { codigo: "INVENTADO", pct: 50 },
      perros: [PERRO],
    },
  });
  expect(r.status()).toBe(400);
  const cuerpo = await r.json();
  expect(cuerpo.error).toContain("cupón");
});

test("una oferta inexistente rechaza la reserva", async ({ request }) => {
  const r = await request.post("/api/reservas", {
    data: {
      contacto: CONTACTO,
      fechaDeseada: "2026-09-15",
      servicio: "Baño completo",
      ofertaId: "00000000-0000-4000-8000-000000000000",
      cupon: { codigo: "PRIMERA_CITA", pct: 10 },
      perros: [PERRO],
    },
  });
  expect(r.status()).toBe(400);
  expect((await r.json()).error).toContain("descuento");
});

test("el honeypot anti-spam rechaza el envío", async ({ request }) => {
  const r = await request.post("/api/reservas", {
    data: {
      contacto: CONTACTO,
      fechaDeseada: "2026-09-15",
      servicio: "Baño completo",
      perros: [PERRO],
      // Los humanos nunca llenan este campo: está oculto en el formulario.
      apellidoPaterno: "Bot",
    },
  });
  expect(r.status()).toBe(400);
});
