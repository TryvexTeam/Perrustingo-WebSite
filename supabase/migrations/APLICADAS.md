# Migraciones aplicadas en producción

Registro de qué está realmente aplicado en la base de Perrustingo
(`ywizsopnlqjyxfndlncw`), para no tener que adivinarlo leyendo el historial de
git. Una migración en el repo **no** significa una migración aplicada.

| Migración | Aplicada | Verificación |
|---|---|---|
| `032_tramos_precio.sql` | 2026-08-04 | 9 tramos · 8 kg cobra $25.000 · 0 huecos entre 0 y 120 kg |
| `033_precio_altura_contextura.sql` | 2026-08-04 | contextura 3 filas / 0 recargos · altura 1 franja / 0 ajustes (ambas neutras, a propósito) |
| `034_bloqueos_por_hora_y_persona.sql` | 2026-08-04 | días cerrados conservados (1→1) · `capacidad_en(now())` responde · las 3 funciones ejecutables por `anon` |

## Cómo se aplicaron

Por el editor SQL de Supabase, **partidas en bloques**. Vale la pena anotarlo
porque volverá a pasar:

- El editor corre todo el script en **una sola transacción**: un error en
  cualquier línea bota el resto.
- No admite **varias funciones `$$` en un mismo script**. Hay que ir de a una,
  y conviene usar etiquetas propias (`$capacidad$`, `$bloqueos$`) en vez de
  `$$` pelado.
- Un `comment on ... is '...;...'` con **punto y coma dentro de las comillas**
  descuadra el parseo del editor. Por eso los `comment on table` de la 034 no
  se aplicaron: son documentación, no afectan el comportamiento.
- `format('%I')` también se maltrata; se usó `quote_ident()` en su lugar.

## Cómo verificar de nuevo

El script completo de verificación (8 revisiones con OK/REVISAR) está en el
historial de la sesión del 4-ago. Lo esencial:

```sql
select count(*) from public.tramos_precio;                    -- 9
select public.capacidad_en(now());                            -- >= 1
select count(*) from public.tramos_altura where pct <> 0;      -- 0 (neutra)
select count(*) from public.ajustes_precio
  where categoria = 'contextura' and pct <> 0;                 -- 0 (neutra)
```

## Pendiente

Los `comment on table` de la 034 (`bloqueos`) no quedaron aplicados por lo del
punto y coma. Es documentación del esquema; se puede correr aparte cuando se
quiera:

```sql
comment on table public.bloqueos is
  'Bloqueos de agenda. Sin horas = dia completo; sin peluquero_id = todo el local. Restan capacidad al motor de cupos.';
```
