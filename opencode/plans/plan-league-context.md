# PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario

**Estado**: aprobado (2026-08-08). **BUILD-LEAGUE-CONTEXT-01 (Fases 1-3) implementado y verificado el 2026-08-09** (harness 278/278, QA E2E 45/45, smoke multi-liga 18/18, build OK, sin commit/push). **PLAN-LEAGUE-CONTEXT-01.1 (aislamiento multi-liga de picks + LeagueIdentity + LeagueStandings + LeagueSelector) ejecutado el 2026-08-09 — ver `opencode/plans/plan-league-context-01.1.md`** (harness 285/285, QA E2E 45/45, smoke 18/18, QA multi-liga 25/25 ×5 + fix de race en `usePicks`). Pendientes: Fases 4-8 (ver §12 y el log de cambios abajo).

## 1. Summary

GameGuru hoy **no tiene un concepto seguro de "liga activa"**: `currentLeague` es estado en memoria de `useLeague` (`src/hooks/useLeague.js:155`), no se persiste y no vive en la URL. El routing es `useState('activePage')` con hash cosmético (`#picks`), leído **una vez al montar** sin listener `hashchange` (`src/App.jsx:67-72,74-79`). Cualquier página gateada (`picks`, `board`, `league`, `training`) usa `currentLeague` (`src/App.jsx:144-161`), peligroso con 2+ ligas.

**Propuesta**: la URL `#/league/:leagueId/...` es la **fuente de verdad** del contexto. Se introduce un mini-router hash, `LeagueContext` (sincroniza `activeLeagueId` como ayuda de navegación con persistencia en `localStorage`), `LeagueRoute` (guarda de membership) y un `LeagueSelector` global en el header.

**Decisiones tomadas (preguntadas y resueltas)**:
1. **Hash paths** (`#/league/:id/...`) — compatible con GH Pages (base `/gameguru/`, sin fallback SPA).
2. **Hub + auto-enter persistido** en el dashboard (todas las ligas visibles; `activeLeagueId` persistido solo como sugerencia; la URL manda).
3. **Header global + selector inline contextual** (el dropdown global del header es la fuente principal; las páginas muestran selector inline solo cuando no hay contexto resuelto).

## 2. Hallazgo QA actual

| Área | Comportamiento hoy | Riesgo con 2+ ligas |
|---|---|---|
| Dashboard | `LeaguesSummary` muestra todas las ligas en tarjetas (`HomeDashboard.jsx:168-196`) | Ninguno (es el hub) |
| My Picks / Standings / My League / Training | Renderizan con `currentLeague` (in-memory) | **Alto**: muestran la liga de la última entrada, no la que el usuario cree ver |
| Header | `league.name` + botón "Mis Ligas" que sale de la liga (`Topbar.jsx:46-51`) | No hay forma de cambiar de liga sin salir de la página |
| Persistencia | `currentLeague` muere en refresh; no hay clave localStorage | Tras reload el usuario vuelve al hub |

Hallazgos adicionales:
- `useDashboardData` usa `contextLeague = currentLeague || leagues[0]` (`src/domains/dashboard/hooks/useDashboardData.js:17`): fallback a la primera liga sin marcar `hasCurrentLeague`; formalizar en Fase 2.
- Páginas huérfanas: `src/pages/Lobby.jsx` y `src/pages/Dashboard.jsx` (no importadas en `App.jsx`). El `?join=` se genera pero nadie lo consume.

## 3. Arquitectura propuesta

```
src/
  router/
    hashRouter.js         # parse/build del hash → ruta { type, leagueId, view }
    routes.js             # tabla de rutas + redirects legacy (#picks → #/league/:id/picks)
  league/
    context/LeagueContext.jsx   # Provider + useActiveLeague()
    LeagueRoute.jsx             # guard de membership + render children con league resuelto
    LeagueSelector.jsx          # dropdown de ligas (header + inline)
    useActiveLeague.js          # { activeLeague, activeLeagueId, setActiveLeague }
    activeLeagueStorage.js      # localStorage 'gameguru.activeLeagueId' (solo ayuda)
```

**Principios**
1. La URL es la **única fuente de verdad** cuando existe contexto.
2. `activeLeagueId` es una **ayuda** (sugerencia de navegación), nunca resuelve una ruta con `leagueId`.
3. `LeagueRoute` **valida membership** antes de renderizar; no-miembro → selector + aviso, **nunca datos**.
4. Las páginas reciben `league` resuelto por la ruta (mismo contrato de props de hoy) con `key={leagueId}` para remount limpio.

## 4. Routing propuesto (hash paths)

| URL (hash) | Vista | Fuente de liga |
|---|---|---|
| `#dashboard` | Hub (todas las ligas + auto-enter sugerido) | — |
| `#/league/:leagueId` | Mi Liga (`LeaguePage`) | ruta |
| `#/league/:leagueId/picks` | Mis Picks (`Picks`) | ruta |
| `#/league/:leagueId/standings` | Tabla (`Leaderboard`) | ruta |
| `#/league/:leagueId/publicpicks` | Picks Públicos | ruta |
| `#/league/:leagueId/training` | Training Camp / Game Week | ruta |
| `#/league/:leagueId/preseason` | *(futuro)* | ruta |
| `#/league/:leagueId/season` | *(futuro)* | ruta |
| `#superadmin` | Admin global | — |

**Redirects / resolución sin contexto**
- `#picks`/`#board`/`#league`/`#training` (legacy): resolver a `#/league/:activeLeagueId/<view>` si hay `activeLeagueId` válido; si no → `#dashboard`.
- `#/league` (sin id): hub/selector.
- `?join=XXXXXX`: consumirlo (hoy huérfano) → entrar a la liga y navegar a `#/league/:id`.

**Gestor**: mini-router propio (parse del hash + `hashchange`), sin dependencias. `parseHash(hash) → Route`, `buildHash(route) → '#/league/x/standings'`.

## 5. League Context propuesto (API)

```js
// LeagueContext.jsx — Provider montado dentro de AppInner (sobre LangProvider)
{
  myLeagues,            // del hook useLeague (ya existe)
  activeLeague,         // liga resuelta (objeto) o null
  activeLeagueId,       // id de la URL, o el persistido como sugerencia, o null
  setActiveLeague,      // (leagueId) => actualiza URL + localStorage (navegación)
  switchLeagueInView,   // (leagueId) => mantiene la vista actual, cambia liga en URL
  resolveForView,       // (view) => leagueId a usar dado URL+persistencia
  membershipCheck,      // (leagueId) => bool (leagueId ∈ myLeagues)
  enterLeagueFromHub,   // (league) => setActiveLeague + navigate
}
```

- `setActiveLeague` escribe `localStorage['gameguru.activeLeagueId']` (sugerencia) **y** navega la URL.
- `useActiveLeague()` lanza error fuera del Provider (patrón `useLanguage`/`useGameWeek`).
- `useLeague` gana `persistActiveLeague(id)`/`loadPersistedLeague()` (en `activeLeagueStorage.js`), sin volverse fuente de verdad.

## 6. UX — Usuario con una sola liga

- `#dashboard` → hub con 1 tarjeta; auto-enter **sugiere** la única liga.
- Pulsar **Standings** → `#/league/:id/standings` **directo** (resolve de 1 liga, sin preguntar). Igual Picks/My League/Training.
- Refresh: la URL mantiene la liga.
- Header: `🏆 <Liga> ▼` con la única liga; dropdown sin otras opciones.

## 7. UX — Usuario con múltiples ligas

- `#dashboard` → hub con **todas** las tarjetas, liga sugerida resaltada; clic → `enterLeagueFromHub`.
- **Standings sin contexto** (`#board` legacy o `#/league` sin id, 2+ ligas) → **selector de liga antes de mostrar la tabla** (requisito del prompt).
- **Ya dentro de Liga B**: `#/league/B/picks` → Standings → `#/league/B/standings` sin volver a preguntar.
- **Cambiar liga**: dropdown del header → `switchLeagueInView` → `#/league/C/standings` manteniendo la vista.
- **My Picks**: selectores **League** (header + inline contextual) y **Week** (`week-tabs` existentes). Layout: `League: [Liga B ▼]   Week: [Week 3 ▼]`.
- **My League / My Leagues**: `#/league` (sin id) y `#dashboard` muestran **todas** las ligas; `LeaguePage` con `:leagueId` muestra esa liga.

## 8. Header selector (`Topbar` + `BottomNav`)

- Reemplazar `league.name` + botón "Mis Ligas" (`Topbar.jsx:46-51`) por dropdown **`🏆 <Liga activa> ▼`**: lista `myLeagues` con check sobre la actual; clic → `switchLeagueInView(leagueId)`; ítem "➕ Unirse / Crear" y "Mis Ligas (hub)" al pie.
- Versión compacta en `BottomNav` (mobile): pill `🏆 Liga B` que abre el mismo selector.
- `isPractice` (item "Training Camp" en nav, `Topbar.jsx:7,14`) se computa del league activo por URL.

## 9. Seguridad / membership

- `LeagueRoute` (wraps cada `#/league/:leagueId/...`):
  1. Resuelve `leagueId` de la URL.
  2. Busca en `myLeagues` (ya proviene de `league_members` en Supabase: `leaguesApi.getMyLeagues`, `src/supabase.js:38-42`). No es miembro → selector + `t('topbar.needLeague')` o "No tienes acceso a esta liga"; **nunca** datos.
  3. Es miembro → `league = myLeagues.find(id)` y render con `key={league.id}`.
- Queries de datos siempre con `league.id` de la URL (getForWeek/getForSession/getForLeague/getMembers…): nunca se mezclan datos de otra liga.
- RLS existente (SELECT por membresía) como defensa en profundidad.
- `#superadmin` sin liga: sin cambios.

## 10. Compatibilidad con Training Camp / Game Week / Simulation

- `TrainingCamp` y `GameWeekContext` consumen `league` por props → con `LeagueRoute` la prop viene de la URL. **Contrato de props intacto**.
- `useTrainingSession({ leagueId, userId, league })` ya toma `leagueId` explícito → solo cambia la fuente del valor.
- **Remount al cambiar liga**: `key={league.id}` (sustituye/refuerza `lobbyVersion`, `src/App.jsx:36,161`).
- `handleChangeLeague` (`src/App.jsx:81-84`) → pasa a `switchLeagueInView` en el header; tras eliminar liga (`LeaguePage.jsx:136`) → `#dashboard`.
- Admin/modales (`ExperienceWizard`, `JoinLeagueModal`, `CreateSimulationModal`, `TrainingCampSetupModal`): `enterLeague(lg)` → `setActiveLeague(lg)` + navegación como hoy.

## 11. Impacto sobre Picks / Standings + bug `picks_user_id_game_id_key`

**Bug (BUILD-TC-006.4-FIX, ya documentado en `training-camp.md §8.6.4`)**:
- Constraint real `picks_user_id_week_game_id_key UNIQUE(user_id, week, game_id)` **sin league_id ni training_session_id** (verificado en `pg_constraint`). Los `game_id` se reutilizan entre ligas (`w1g1` estáticos, `tc-<sessionNo>-<n>` del TC; `tc-2-1` en 11 ligas).
- Fix vigente: `onConflict: 'user_id,week,game_id'` (`src/supabase.js:95`) → guardado idempotente, 1 fila por `(user, week, game)` global; el pick se actualiza al último contexto.

**Relación con League Context**:
- El League Context **no causa** el 23505 (es un problema del data model). Sí influye en la experiencia:
  - **Cambio de liga con save pendiente**: `submitPicks` captura `league.id` y `game_id` en el closure (`usePicks.js:38-44`). Si el usuario cambia de liga mientras `saving`, los rows se escriben con la liga capturada, pero como `game_id` coincide entre ligas, el pick de la liga anterior queda **sobrescrito** por el onConflict global. Con la URL como fuente de verdad el flujo es determinista (el save va contra la liga de la ruta), pero el solapamiento a nivel BD persiste.
  - Con `key={leagueId}` + URL se elimina el síntoma más grave: "muestro datos de la liga equivocada".
- **Recomendación (documentada, NO corregida en este plan)**: el data model de picks debe decidirse en BUILD futuro — opción A) `game_id` únicos por liga (prefijo con short-id de liga en TC; duplicar calendario estático por liga) liberando `picks` para `UNIQUE(user_id, league_id, week, game_id)`; u opción B) aceptar formalmente la regla "1 pick por `(user, week, game)` global" (ya implementada, menor riesgo). Flag `LEAGUE_CONTEXT_PICKS_ISSUE` para el handoff.

## 12. Plan de implementación por fases

| Fase | Alcance | Entregable | Verificación |
|---|---|---|---|
| **0** | Handoff/plan aprobado (este doc) | docs | Revisión |
| **1** | Mini-router hash (`parseHash`/`buildHash` + `hashchange`), tabla de rutas + redirects legacy | `src/router/*` | Tests unitarios parse/resolve/redirect |
| **2** | `LeagueContext` + `activeLeagueStorage` + `useActiveLeague` | `src/league/context/*` | Tests resolución URL>persistencia>fallback |
| **3** | `LeagueRoute` (guarda membership) + refactor `App.jsx` (render por ruta, `key={league.id}`, eliminar gate `!currentLeague`) | `App.jsx` + `LeagueRoute` | Smoke manual multi-liga |
| **4** | `LeagueSelector` en Topbar + BottomNav; `switchLeagueInView` | `Topbar`/`BottomNav` | QA header |
| **5** | UX multi-liga: hub + auto-enter, selector inline en Standings/Picks (League+Week), `?join=` consumido | `HomeDashboard`/`Leaderboard`/`Picks` | QA E2E browser |
| **6** | Migrar `LeaguePage`/`TrainingCamp` a contexto de ruta; limpiar huérfanos (`Lobby.jsx`, `Dashboard.jsx`) | páginas | Regresión completa |
| **7** *(futuro)* | Rutas `preseason`/`season`/Open Lobby común | — | — |
| **8** *(futuro)* | Decisión data model de picks (bug 23505) | migración opcional | — |

**Estado de implementación (BUILD-LEAGUE-CONTEXT-01, 2026-08-09):**
- ✅ **Fase 1** — `src/router/hashRouter.js` (`parseHash`/`buildHash`/`normalizeHash`), `src/router/routes.js` (helpers `league*Route`, `LEGACY_VIEW_MAP`, `LEGACY_REDIRECTABLE`, `resolveForView`, `navigate`), `src/router/useHashRoute.js`.
- ✅ **Fase 2** — `src/league/activeLeagueStorage.js`, `src/league/context/leagueResolution.js` (puro: `computeRouteState`/`getActiveLeagueId`/`buildContextValue`), `src/league/context/LeagueContext.jsx` (Provider + `useLeagueContext`). `leaguesApi.getById` + `membersApi.getMembership` en `src/supabase.js`.
- ✅ **Fase 3** — `src/league/LeagueRoute.jsx` (guard A-D: READY/DENIED/NOT_FOUND/LOADING). `App.jsx` refactorizado en `AppInner` (auth + `useLeague`) + `AppShell` (dentro del Provider); rutas `#/league/:id[/page]` renderizan las páginas legacy con `league` de la URL y `key={leagueId}`; redirects legacy solo para `LEGACY_REDIRECTABLE`; hub `#dashboard` → `Home`. **El gate `!currentLeague` del flujo legacy se mantiene** (las páginas legacy no migradas siguen usándolo; la ruta de liga lo reemplaza por LeagueRoute).
- ⏳ **Fases 4-8 pendientes** (BUILD-LEAGUE-CONTEXT-02 en adelante).
- **Ajuste de alcance en Fase 1 (detectado por QA E2E)**: el auto-redirect legacy **excluye `#training`** (`LEGACY_REDIRECTABLE` = picks/board/publicpicks/league). El lobby del Training Camp usa `currentLeague` + `lobbyVersion` + modal con `initialName=currentLeague?.name` y remontarlo vía LeagueRoute rompía el resume de corrida inyectada; su migración es Fase 6. `resolveForView` sigue mapeando `training` (pure, para Fase 6).
- **Ajuste de alcance en Fase 3**: el hub `#dashboard` se renderiza por ruta (la URL es la fuente de verdad); las páginas legacy se renderizan por `activePage` cuando la ruta no es de liga (sin tocar su lógica).

Restricciones: **no tocar** `SimulationDirector`/`MatchSimulator`/`StandingCalculator`/`EventDirector`; TC-007 fuera de alcance.

## 13. Tests

**Harness (`/tmp/opencode/regression.mjs` + esbuild)**: `parseHash` (rutas válidas/legacy/malformadas), `buildHash` round-trip, `resolveForView` (1 liga → auto; 2+ sin contexto → null→selector; URL manda sobre persistencia), guard membership (miembro/no miembro → selector sin datos), redirects legacy, `switchLeagueInView` mantiene view, auto-enter sugerido en hub.

**QA E2E browser** (puppeteer, patrón `qa-tc0063.mjs`), usuario con 2 ligas reales A y B:
1. `#/league/B/standings` → tabla de B (dato distintivo de B).
2. `#/league/B/picks` → pulsar Standings → `#/league/B/standings` sin preguntar liga.
3. Header dropdown → cambiar a A → `#/league/A/standings` (misma vista).
4. `#board` legacy con 2+ ligas sin persistencia → selector antes de la tabla.
5. `#/league/C/standings` sin ser miembro → selector + aviso, 0 datos de C.
6. Refresh en `#/league/B/picks` → mantiene B; Picks muestra League+Week.
7. Regresión 242/242 previa intacta.

**Verificación BUILD-LEAGUE-CONTEXT-01 (2026-08-09, Fases 1-3)**: harness **278/278** con 36 tests nuevos LC-A..J (URL>persistencia, guard READY/DENIED/NOT_FOUND/LOADING, refresh round-trip, navegación A→B/B→A, persistencia al entrar, hub passthrough, redirects legacy + `training` excluido). QA E2E `qa-tc0063.mjs` **45/45** (TC/Game Week/Picks/Simulation intactos). QA nuevo `qa-league-smoke.mjs` **18/18** (rutas de liga reales: READY/refresh/picks/standings/NOT_FOUND/DENIED sin datos/redirect `#board`/hub). Los QA E2E del plan (puntos 1-6 completos con 2 ligas + selector header) se ejecutan en BUILD-02 cuando exista el LeagueSelector.

## 14. Riesgos

- **Formato de hash**: `#picks` → `#/league/x/picks` rompe bookmarks/compartidos (mitigación: redirects legacy + `?join=` consumido).
- **GH Pages**: hash paths evitan el fallback; no se toca el deploy.
- **`useDashboardData` `leagues[0]` fallback**: formalizar en Fase 2 para que el hub no muestre la primera liga como contexto.
- **StrictMode / doble efecto**: router y `LeagueContext` idempotentes (patrón `simGuardRef` de `useTrainingSession`).
- **Remount Training Camp/Game Week**: cubierto con `key={leagueId}`.
- **Solapamiento picks multi-liga** (bug 23505): documentado; opción B (regla global `(user, week, game)`) vigente; cambio de data model para BUILD futuro.
- **`superadmin`/`Auth`**: sin liga, no afectados por el guard.

## 15. Preguntas resueltas / pendientes

Resueltas: hash paths; hub + auto-enter persistido; header + inline contextual.
Pendientes para BUILD: (a) ¿eliminar `Lobby.jsx`/`Dashboard.jsx` en Fase 6? (b) ¿selector inline de Standings dropdown compacto o grid de tarjetas? (recomendado: dropdown compacto).
