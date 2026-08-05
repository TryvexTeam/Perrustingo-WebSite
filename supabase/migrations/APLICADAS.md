# Migraciones aplicadas en producción

Registro de qué está realmente aplicado en la base de Perrustingo
(`ywizsopnlqjyxfndlncw`), para no tener que adivinarlo leyendo el historial de
git. Una migración en el repo **no** significa una migración aplicada.

| Migración | Aplicada | Verificación |
|---|---|---|
| `032_tramos_precio.sql` | 2026-08-04 | 9 tramos · 8 kg cobra $25.000 · 0 huecos entre 0 y 120 kg |
| `033_precio_altura_contextura.sql` | 2026-08-04 | contextura 3 filas / 0 recargos · altura 1 franja / 0 ajustes (ambas neutras, a propósito) |
| `034_bloqueos_por_hora_y_persona.sql` | 2026-08-04 | días cerrados conservados (1→1) · `capacidad_en(now())` responde · las 3 funciones ejecutables por `anon` |
| `035_operacion_completa.sql` | 2026-08-04 | `cancelar_con_token('<uuid inexistente>')` responde `no_encontrada` desde producción · `/api/cupon` responde `no_existe` (lee las columnas nuevas) |
| `036_grant_escritura_cupones.sql` | 2026-08-04 | catálogo: `cupones` → `authenticated` con INSERT/SELECT/UPDATE y `service_role` igual |
| `037_consumo_atomico_penalizacion.sql` | 2026-08-04 | aplicada junto con la 035; el consumo atómico solo lo ejecuta `service_role` |
| `038_agenda_por_peluquero.sql` | 2026-08-04 | catálogo: `sesiones_equipo` → `authenticated` con SELECT (una vista recreada nace sin privilegios) |
| `039_horario_por_persona.sql` | 2026-08-05 | catálogo: `horarios_peluquero` → `authenticated`/`service_role` con DELETE/INSERT/SELECT/UPDATE y **`anon` sin SELECT** · `peluqueros_resumen()` responde `total=2, con_horario=0` |

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
- Las 035–039 se aplicaron por el mismo camino, **partidas en bloques
  numerados** y con etiquetas propias de dollar-quote (`$cancelar$`,
  `$consumir$`, `$horarios$`). Ninguna dio problemas.

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

## Instalado pero apagado, a propósito

Tres cosas quedaron en la base sin efecto visible. **No son pendientes
técnicos: son decisiones del dueño**, y conviene no "arreglarlas" por
iniciativa propia.

| Qué | Estado | Por qué |
|---|---|---|
| `politica_citas.activa` | `false` | Un recargo por atraso solo es defendible si el cliente lo aceptó al reservar, y el formulario todavía no se lo dice. Encenderla antes significa que se entera con la cuenta en la puerta. |
| `servicios_precio` | los 5 en 0 | La capacidad está instalada; los valores los pone Rodolfo. |
| `horarios_peluquero` | vacía | Sin filas, cada peluquero cuenta como que trabaja todo el horario del local — el comportamiento previo. La agenda se recorta recién cuando se configure a alguien. |

El patrón es el mismo en las tres y vale la pena nombrarlo: **la ausencia de
configuración significa "como estaba", nunca "cerrado"**. En este proyecto un
valor por defecto que nadie comunicó ya mandó reservas reales a un número
equivocado durante semanas.

## Ojo con `es_peluquero`

`rol` y `es_peluquero` son cosas distintas, y confundirlas cuesta una tarde:

- `rol` (`admin`/`trabajador`/`cliente`) dice qué puede hacer en el sistema.
- `es_peluquero` dice si sus manos atienden un perrito, y por lo tanto si suma
  un cupo a esa hora. Un trabajador de recepción no debe sumar capacidad.

Hasta el 5-ago **nadie** tenía `es_peluquero = true`, así que `capacidad_paralela()`
venía devolviendo la capacidad de respaldo de la config en vez de gente real —y
por eso ni el filtro por peluquero de la 038 ni los horarios de la 039 se
notaban. Se marca en `/dashboard/usuarios`.

Si algo relacionado con capacidad "no hace nada", esto es lo primero que hay que
mirar:

```sql
select * from public.peluqueros_resumen();   -- total = 0 → nadie marcado
```

## Pendiente

Los `comment on table` de la 034 (`bloqueos`) no quedaron aplicados por lo del
punto y coma. Es documentación del esquema; se puede correr aparte cuando se
quiera:

```sql
comment on table public.bloqueos is
  'Bloqueos de agenda. Sin horas = dia completo; sin peluquero_id = todo el local. Restan capacidad al motor de cupos.';
```
