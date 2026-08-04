-- ============================================================
-- 025 — Los anuncios pueden llevar a alguna parte
-- ============================================================
-- Pedido del señor Ignacio (27-jul): que los anuncios de la portada puedan
-- ser botones, no solo imágenes. Hasta ahora un cliente veía el arte de
-- "Perrustingo a domicilio" y no tenía dónde tocar; el que quisiera saber
-- más se quedaba con las ganas.
--
-- `url` nula significa "sin enlace": el anuncio se sigue mostrando como
-- imagen suelta, que es como funcionan los cuatro que ya existen. Nadie
-- tiene que tocar nada para que sigan igual.

ALTER TABLE public.promos
  ADD COLUMN IF NOT EXISTS url TEXT;

-- Solo http y https, y esto NO es una formalidad: el campo lo escribe el
-- admin y termina dentro de un `href` de la portada pública. Un
-- `javascript:...` guardado acá es código corriendo en el navegador de cada
-- visitante. La validación ya está en la aplicación (`normalizarUrlPromo`),
-- pero la base es la última línea: si mañana alguien escribe en la tabla por
-- otro camino —el editor SQL, un script, otra app— la restricción sigue ahí.
ALTER TABLE public.promos
  DROP CONSTRAINT IF EXISTS promos_url_http;
ALTER TABLE public.promos
  ADD CONSTRAINT promos_url_http
  CHECK (url IS NULL OR url ~* '^https?://[^\s]+$');

-- Verificación post-aplicación (correr a mano):
-- INSERT INTO promos (id, nombre, img, alt, slot) VALUES
--   ('prueba-xss', 'x', '/x.png', 'x', 'oculto');
-- UPDATE promos SET url = 'javascript:alert(1)' WHERE id = 'prueba-xss';
--   -> debe fallar con "violates check constraint promos_url_http"
-- DELETE FROM promos WHERE id = 'prueba-xss';
