-- ============================================================
-- 030 — Queda registrado cuándo se avisó que el perrito está listo
-- ============================================================
-- Reportado durante la verificación del 30-jul: el mismo cliente recibió dos
-- veces el correo "Filu está listo 🐾", con tres minutos de diferencia.
--
-- El botón del panel SÍ se bloquea después de enviar, pero con estado de
-- React: vive mientras el panel esté abierto. Al cerrarlo y volver a abrirlo
-- —o al recargar la página— vuelve a cero y el aviso se puede repetir. No
-- había forma de saber que ya se había mandado, porque no se guardaba en
-- ninguna parte.
--
-- Un correo enviado no se puede recoger. Esa es justamente la razón que el
-- código ya invocaba para no avisar antes de tiempo; vale igual para no
-- avisar dos veces.
--
-- Se guarda el instante, no un booleano: así el panel puede decir CUÁNDO se
-- avisó, que es lo que alguien necesita saber al retomar una cita ajena.

ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS aviso_listo_en TIMESTAMPTZ;

COMMENT ON COLUMN public.sesiones.aviso_listo_en IS
  'Cuándo se le avisó al cliente que puede pasar a buscar al perrito. NULL = todavía no.';

-- ── La vista del equipo tiene que mostrarlo ──────────────────
-- Se recrea completa porque una vista no hereda las columnas nuevas de su
-- tabla. Es la misma definición de la 027 más `aviso_listo_en`: las reglas
-- de privacidad de contacto quedan EXACTAMENTE igual — email, teléfono y
-- notas_cliente siguen viéndose solo con rol admin.

DROP VIEW IF EXISTS public.sesiones_equipo;

CREATE VIEW public.sesiones_equipo
WITH (security_invoker = false) AS
SELECT
  s.id,
  s.estado,
  s.fecha_cita,
  s.fecha_fin,
  s.servicio,
  s.precio_base,
  s.precio_final,
  s.perro_id,
  s.cliente_id,
  s.oferta_id,
  s.detalle_form,
  s.notas_equipo,
  s.created_at,
  -- Nuevo en la 030. No es dato de contacto: es un instante, y el peluquero
  -- necesita verlo para no repetir el aviso.
  s.aviso_listo_en,
  -- El nombre SÍ lo ve el peluquero: necesita saber a quién le entrega el
  -- perrito. Lo que no puede es contactarlo por fuera.
  s.contacto_nombre,
  CASE WHEN public.get_rol() = 'admin' THEN s.contacto_email END     AS contacto_email,
  CASE WHEN public.get_rol() = 'admin' THEN s.contacto_telefono END  AS contacto_telefono,
  -- La comuna queda visible para todo el equipo: con ella no se contacta a
  -- nadie, y las analíticas la agrupan para ver de dónde llegan los clientes.
  -- Taparla rompería un gráfico sin proteger nada.
  s.contacto_comuna,
  -- `notas_cliente` parece inofensiva, pero el endpoint de reservas escribe
  -- ahí "nombre · teléfono · correo" cuando faltan columnas (ver el fallback
  -- de app/api/reservas/route.ts). Es el mismo dato por otra puerta.
  CASE WHEN public.get_rol() = 'admin' THEN s.notas_cliente END      AS notas_cliente
FROM public.sesiones s
WHERE public.get_rol() IN ('admin', 'trabajador');

ALTER VIEW public.sesiones_equipo SET (security_barrier = true);

GRANT SELECT ON public.sesiones_equipo TO authenticated;

-- Verificación post-aplicación (correr a mano):
--
-- 1) La columna existe:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'sesiones' AND column_name = 'aviso_listo_en';
--   -> una fila
--
-- 2) La vista la expone y NO perdió las reglas de privacidad:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'sesiones_equipo' ORDER BY 1;
--   -> debe incluir aviso_listo_en, contacto_email, contacto_telefono
--      (estas dos últimas siguen devolviendo NULL para el rol trabajador)
