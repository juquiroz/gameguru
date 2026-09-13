# HANDOFF — Panel admin para `platform_admin`: ligas + participantes por role y pestaña "API"

Fecha: 2026-09-13 · Riesgo: **COMPLEJO** (gate de auth/RLS + vista nueva) · Estado: **BUILD COMPLETO, QA OK, sin deploy**

## Contexto

El PO pidió dos mejoras para el rol `platform_admin` en el panel de administración del webapp:

1. Poder ver la cantidad de ligas creadas en la webapp y, al hacer click en una, ver los
   participantes **diferenciados por role**.
2. Una pestaña **"API"** que muestre las reglas de uso del API configuradas (cooldowns por
   ventana, límites diarios, programación del cron) como referencia para ajustes futuros.

Hallazgo clave del PLAN: la feature 1 **ya existía** casi completa — `PlatformOverview`
(muestra `Ligas` + enlaces), `PlatformLeagues` (listado paginado con counts) y
`PlatformLeagueDetail` (miembros con columna **Role**) — pero el gate era `isSuperAdmin`
(≈ `platform_superadmin`), lo que **excluía a `platform_admin`** (`useSuperAdmin` en
`src/hooks/useSuperAdmin.js` y gate en `src/App.jsx`). La feature 2 no existía.

## Decisiones del PO (aprobadas antes del BUILD)

- Acceso `platform_admin`: **solo lectura + API**. NO a calendario maestro (`superadmin`) ni a
  `Reconciliation` (aplica scores). Ambas quedan exclusivas de `platform_superadmin`.
- Nav: **botón "Admin"** (→ consola con conteo de ligas) + **botón "API"**, visibles para
  `platform_admin` y `platform_superadmin` en Topbar. Superadmin conserva su calendario actual.
- Contenido pestaña API: cooldowns (en vivo) + budget diario (en vivo) + cron (constante
  documentada) + últimos `sync_runs`. Sin migración de BD (RLS ya existente).

## Cambios

| Archivo | Qué |
|---|---|
| `src/hooks/useSuperAdmin.js` | Ahora devuelve `isPlatformAdmin` (claim `platform_admin` **o** `platform_superadmin`, fallback legacy `is_superadmin`). `isSuperAdmin` solo claim superadmin. |
| `src/App.jsx` | Gate diferencial: consola read-only (`platform`, `platformLeagues`, `platformLeague`, `platformUsers`, `platformUser`, `platformApi`) → `isPlatformAdmin`; `superadmin` + `platformReconciliation` → `isSuperAdmin`. Nueva ruta `platformApi` renderiza `<PlatformApi/>`. Prop `isPlatformAdmin` a Topbar/BottomNav. |
| `src/domains/platform/models/apiConfig.js` | **Nuevo** dominio puro/testable: `orderCooldownWindows`, `formatCooldown`, `defaultBudgetLimits`, `computeBudgetSummary`, `summarizeSyncRuns`, `CRON_REFERENCE`, `PROVIDER_LIMITS`. |
| `src/domains/platform/index.js` | Exporta el modelo `apiConfig`. |
| `src/supabase.js` | `platformApi.apiConfig()` consulta en vivo `sync_cooldown_config`, `api_budget` (últimos 30 días) y `sync_runs` (últimos 50). |
| `src/router/hashRouter.js` | `#/platform/api` → `{ type: 'platformApi' }` (parse + build). |
| `src/router/routes.js` | Helper `platformApiRoute()`. |
| `src/pages/PlatformApi.jsx` + `.module.css` | **Nuevos**: pestaña API read-only (cooldowns, budget, cron, últimos runs). |
| `src/components/Topbar.jsx` | Botones "🛰️ Admin" y "🔌 API" para `isPlatformAdmin`; conserva "⚙️ Admin" calendar y "🔄 Reconciliation" para superadmin. |
| `src/components/BottomNav.jsx` | Item "Admin" para `platform_admin` (id `platform`); superadmin conserva `superadmin`. |
| `tests/platform-api-config.test.js` | **Nuevo** (13 asserts de dominio). |
| `tests/routes.test.js` | Caso round-trip `#/platform/api`. |

## Tests / QA

- `node --test tests/`: **385/385 pass** (antes 370; +15 nuevos).
- `npm run build`: **OK** (vite, sin errores; warning de chunk >500KB preexistente).
- Sin migración de BD: `sync_cooldown_config` tiene RLS SELECT autenticado (010.0), y
  `api_budget`/`sync_runs` SELECT platform admins (010.0/009.0). `profiles`, `leagues`,
  `league_members` ya tienen SELECT público; `picks`/`league_games` read con
  `public.is_platform_admin()` (007.3, cubre ambos roles). Verificado en los .sql.

## Riesgos residuales

- **No deployado**: el webapp corre en GitHub Pages; `npm run deploy` NO se ejecutó (no
  solicitado y empuja a GitHub). La UI nueva no estará visible hasta el deploy.
- El claim JWT `app_metadata.platform_role` solo llega al token tras re-login/refresh de un
  usuario `platform_admin` (trigger 007.0 sincroniza `profiles.platform_role` → claim). Si el
  rol se asigna y el JWT aún no lo trae, el hook cae al fallback legacy (`is_superadmin`), que
  será `false` → se pedirá re-login. No se tocó nada de este lado.
- `platform_api.apiConfig()` depende de que las tablas estén expuestas vía PostgREST (schema
  `public`, sí lo están). El cron se muestra como **constante documentada** (`*/3`), no en vivo:
  `cron.job` es schema interno sin acceso REST (decisión del plan).

## Pending decisions / siguiente paso

- Confirmar si se hace `npm run deploy` del webapp a GitHub Pages para que `platform_admin`
  vea la pestaña Admin/API en producción.
- Opcional: dentro de `PlatformLeagueDetail`, los participantes ya se diferencian por la
  columna `Role`; si el PO quiere agrupar/ordenar por role se puede refinar más tarde.