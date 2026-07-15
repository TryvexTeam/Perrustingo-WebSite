# Arquitectura del proyecto — Perrustingo

> Next.js 16 (App Router) + Tailwind 4 + Supabase (SSR). Actualizado: 2026-07.

## Árbol de carpetas

```
app/                    Rutas (App Router)
├── page.tsx            Landing
├── agenda/             Calendario semanal (hoy: datos demo de lib/agenda.ts)
├── reserva/            Formulario inteligente de reserva
├── dashboard/          Panel del equipo (roles admin/trabajador)
│   ├── tarifas/        Editor de tarifas (admin)
│   └── anuncios/       Editor de promos (admin)
├── login/ registro/ recuperar/ perfil/   Cuentas de usuario
├── auth/               callback + reset de Supabase
└── offline/ politicas/ not-found.tsx …

components/             Organizado por feature
├── layout/             SiteMenu, StaggeredMenu, Footer, LangSwitcher,
│                       CookieBanner, ServiceWorkerRegister, BotonWhatsApp, LoaderHuellita
├── landing/            Secciones de la home (Hero, Servicios, Precios, Tamanos, FAQ, …)
├── reserva/            FormReserva (form de 4 pasos)
├── agenda/             CalendarioSemanal
├── admin/              EditorTarifas, EditorPromos
├── auth/               Formularios de login/registro/recuperar
└── ui/                 Primitivas compartidas (Reveal, PawIcon, CloudCard, Doodles, …)

lib/                    Lógica sin UI
├── reserva.ts          Tipos del form, precios, mensaje WhatsApp
├── agenda.ts           Tipos de citas + CITAS_DEMO (reemplazar por tabla `sesiones`)
├── tarifas.ts promos.ts razas.ts site.ts
└── supabase/           client.ts (browser) · server.ts (RSC) · middleware.ts (sesión)

supabase/schema.sql     Schema completo con RLS (perfiles, perros, sesiones, tarifas, …)
middleware.ts           Refresh de sesión Supabase
```

## Convenciones

- **Imports absolutos** `@/components/...`, `@/lib/...` — no usar `../`.
- Componente nuevo → carpeta del feature al que pertenece; si lo usan ≥2 features → `ui/`.
- Lógica/datos sin JSX → `lib/`.
- `npm run lint` y `npm run typecheck` deben pasar antes de commit.

## Conexión a base de datos (pendiente — coordinar)

Todo ya está preparado para Supabase:

1. Variables en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   Mientras la URL contenga `TU_PROYECTO`, dashboard y agenda muestran modo demo.
2. Ejecutar `supabase/schema.sql` en SQL Editor del proyecto.
3. Contrato de auth: tabla `perfiles` con `rol IN ('cliente','trabajador','admin')`.
   El dashboard filtra por ese rol vía `auth.getUser()` — cualquier login debe crear/usar esa tabla.

## Deuda técnica conocida

- 5 warnings `react-hooks/set-state-in-effect` (lecturas de localStorage al montar) — migrar a `useSyncExternalStore` cuando se toquen esos componentes.
- `components/landing/Proximamente.tsx`, `StatsBar.tsx`, `ContadorVivo.tsx`: **sin usos** — candidatos a eliminar.
- `FormReserva.tsx` (628 líneas): dividir por pasos cuando se conecte a `sesiones`.
- `StaggeredMenu.tsx` carga gsap en el bundle inicial de todas las páginas — evaluar carga diferida.
- `bg-azul.jpeg` / `bg-azul2.jpeg` en raíz: sin referencias en el código.
