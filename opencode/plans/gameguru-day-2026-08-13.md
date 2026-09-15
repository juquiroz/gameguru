# gameguru — Resumen diario 2026-08-13 (Jue)

Rama: development. Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb` (anon key en `.env`; service_role en `/tmp/opencode/sb_service_role`; Management API token en `/tmp/opencode/sb_token`). Tooling: node v20.20.2, vite 5.4.21, puppeteer-core@23 (Chrome v151), esbuild 0.21.5 (harness). Contexto previo: `gameguru-day-2026-08-12.md` (Preseason GO/FROZEN, TZ-001→005, BUILD-UX week actions; harness 311/311). **Sesión 10 (este día): Plataforma SUP-000 + SUP-001 implementado y verificado** — rol de plataforma con RLS real a nivel BD (nunca `if(isSuperAdmin)` como autorización), auditoría y consola read-only `#/platform`. Harness **362/362**, `npm run build` ✅, QA platform **32/32**, regresión E2E completa verde. **Sesión 10b (este día): BUILD-SCORE-001** — fix del ScoreEditor (partial updates) + eliminación del master sync del flujo League Admin + tie display. Harness **369/369**, `qa-scoreeditor.mjs` **27/27**, regresión completa verde. **Sesión 10c (este día): BUILD-SUP-002** — consola de ligas read-only `#/platform/leagues` (+ detalle), exclusiva de `platform_superadmin`. Harness **435/435**, `npm run build` ✅, `qa-platform-leagues.mjs` **31/31**, regresión completa verde. **Sesión 10d (este día): PLAN-SUP-003** — diseño aprobado de Platform User Management (read-only), sin implementar (`opencode/plans/plan-sup-003.md`). **Sin commit/push.**

## Sesión 10 — 🛡️ Plataforma (BUILD-SUP-000 + SUP-001)

**Estado**: implementado y verificado. Plan documentado en `opencode/plans/superadmin.md`. **Sin commitear.**

### Contexto
Antes: `profiles.is_superadmin` + policy UPDATE de `profiles` con guarda solo de `id = auth.uid()` (vulnerable a auto-escalamiento), `master_games` sin policy UPDATE (ruta `masterGamesApi.update` rota) y autorización resuelta en el frontend. Regla adoptada: **RLS confía en el claim JWT `app_metadata.platform_role`**, no en lookups a `profiles` ni en el frontend.

### FASE 0 — Auditoría live DB (read-only)
`/tmp/opencode/qae2e/audit-live-db-*.json`: 47 policies; RLS activo en 9 tablas; `game_weeks`/`pick_submissions`/`training_sessions` public-read (gap S1, fuera de alcance); `profiles` SELECT público; counts (leagues=29, profiles=176, league_members=43, master_games=321, league_games=277). Hallazgos → definieron 007.x (ver superadmin.md).

### SUP-000 — Roles + RLS (migraciones `007.0`–`007.3` aplicadas, idempotentes)
- **007.0**: `profiles.platform_role` + CHECK + backfill (solo `is_superadmin` → `platform_superadmin`; los League Admins NO se convierten a `platform_admin`, tier declarado/dormante) + trigger `trg_sync_platform_role_to_jwt` (SECURITY DEFINER, `search_path=''`) que sincroniza `auth.users.raw_app_meta_data.platform_role`; `handle_new_user` reconciliado (existía solo en BD viva).
- **007.1**: helpers `public.is_platform_superadmin()`/`is_platform_admin()` (leen `auth.jwt()`, fail-closed); `master_games` INSERT/UPDATE/DELETE superadmin + SELECT público; `profiles` UPDATE con guarda de columnas (anti auto-escalamiento) + INSERT restringido `platform_role='user'`; sin policies legacy `is_superadmin`.
- **007.2**: `admin_audit_log` + `log_admin_action(...)` SECURITY DEFINER; sin policy INSERT (writes futuros Edge Functions/service_role, SUP-004); SELECT solo platform admins.
- **007.3**: `picks`/`league_games` SELECT global adicional para platform admins (consola; nunca service_role en navegador).

### SUP-001 — Consola + dominio
- Dominio puro `src/domains/platform/`: `models/roles.js` (roles/rank/`platformRoleFromJwt`/helpers), `models/overview.js` (métricas puras, `computeTodayGames` por timezone, `computeHealthSummary` Healthy/Warning/Error), `services/platformService.js` (`canManageLeague`).
- `src/hooks/useSuperAdmin.js`: claim JWT como fuente primaria, fallback legacy `profiles.is_superadmin` solo si el claim no aporta rol.
- `platformApi.overview()` en `src/supabase.js` (8 selects paralelos); `src/pages/PlatformOverview.jsx` + `.module.css`; `PlatformDenied.jsx`; ruta `#/platform` (`parseHash`/`buildHash`/`platformRoute`) con guard de **deny explícito** en `App.jsx` (~línea 250).
- Refactor `canManageLeague` en los 9 inline + 2 extra detectados (LeaguePage/Lobby/LeagueDashboard/HomeDashboard/useDashboardData/useTrainingSession/GameWeekContext/LeaguesSummary/LeaguesOverview/Picks + 2 mensajes en Picks/Leaderboard). `Picks.jsx:170` (badge 👑 por miembro) sin tocar.

### QA
- **Probes RLS en BD viva** (GUC `request.jwt.claims` + `SET ROLE authenticated`): claim superadmin → helpers true; user auto-promueve → ERROR 42501; user edita username → OK; user inserta master_games → ERROR; superadmin UPDATE master_games → OK; platform_admin lee todos picks/league_games → OK. Único superadmin: `bambino29`, claim JWT ya sincronizado.
- **`qa-platform.mjs` 32/32** (nuevo, en `/tmp/opencode/qae2e/`).
- **Harness `regression.mjs` 362/362** (311 baseline + 51 nuevos: roles, canManageLeague, overview, timezone edge cases, health, platformRoute), 0 FAIL. **`npm run build` ✅** (654.53 kB js, 193 modules).
- **Regresión E2E full verde**: `qa-preseason.mjs` **15/15**, `qa-tc0063.mjs` **45/45**, `qa-league-smoke.mjs` **18/18**, `qa-multileague-picks.mjs` **25/25**, `qa-timezone.mjs` **18/18**, `qa-weekactions.mjs` **27/27** (0 errores consola/red en todas).
- **Aprendizaje QA**: `qa-weekactions` era flaky por hora del día — el primer partido de la semana 2 real es `2026-08-13T23:00Z` → deadline 22:00Z; al correr después del deadline la "semana 2 abierta" quedaba bloqueada (3 asserts invertidos sin cambio de código). No era regresión: se ancló la semana 2 al futuro (`2099`) con PATCH service_role en el setup → determinista 27/27.

### Pendientes (mañana)
- Backlog plataforma (SUP-002/003/004/005/006/007) y gaps FASE 0 (S1/S2) en `opencode/plans/superadmin.md`.
- Backlog post-preseason (`preseason.md`) y Training Camp HOLD (BUILD-TC-006.3).
- Git a cargo del usuario (working tree con cambios de hoy sin commitear: SUP-000/001 + BUILD-SCORE-001 + docs).

## Sesión 10b — 🎯 Actualizaciones parciales de marcador (BUILD-SCORE-001)

**Estado**: implementado y verificado. Detalle completo en `opencode/plans/preseason.md` (sección BUILD-SCORE-001). **Sin commitear.**

### Contexto
`ScoreEditor` guardaba un marcador solo si se reescribían AMBOS scores. Root cause: estado inicial con números de PostgREST (`useState(initialAwayScore ?? '')` → `7`) + `.trim()` incondicional en submit → `(7).trim()` → `TypeError` antes de `onSave`, fuera del try/catch → SAVE en silencio.

### Cambios
- `src/utils/scores.js` (nuevo): `normalizeScoreInput(v) = String(v ?? '').trim()`.
- `src/components/ScoreEditor.jsx`: init de estado con `normalizeScoreInput(...)`; `.trim()` en submit ahora seguro.
- `src/components/LeagueGamesManager.jsx`: **eliminado** `masterGamesApi.setScoresByGameId(...)` del flujo League Admin (un league admin NO tiene permiso UPDATE sobre `master_games` por RLS — solo `is_platform_superadmin()`; el error se tragaba con `console.error`). `league_games` es la source of truth de la captura manual. `setScoresByGameId` queda definido en `src/supabase.js` sin caller (reservado para reconciliación SUP-004). NO se tocó RLS, NO SECURITY DEFINER, NO Edge Function, NO provider.
- Tie display fix: `hasResult = g.finished && (g.result || (g.home_score != null && g.away_score != null))` → `10-10 FINAL` (result null) se muestra como resultado válido. La calificación de empates en Picks/Standings sigue en backlog.
- **LIVE-001 NO implementado** (live/quarters/clock/provisional standings/provider/ESPN futuros).

### QA
- **Harness `regression.mjs` 369/369** (7 tests nuevos `normalizeScoreInput`: 7/0/"7"/" 7 "/null/undefined/typeof). `npm run build` ✅ (654.53 kB js, 193 modules).
- **`qa-scoreeditor.mjs` 27/27** (nuevo, en `/tmp/opencode/qae2e/`): A entrada inicial 10-7 → B solo home 10→17 → 17-7 → C solo away 7→14 → 17-14 → D ambos → 24-21 → E reabrir sin editar intacto → F 10-10 FINAL mostrado como resultado → G 0-0 con 0 válido. 0 errores consola, 0 requests fallidos, 0 HTTP 4xx, **0 writes a `master_games`** (sync eliminado verificado). Liga QA descartable + limpieza cascade.
- **Regresión E2E full verde**: `qa-preseason.mjs` 15/15, `qa-tc0063.mjs` 45/45, `qa-league-smoke.mjs` 18/18, `qa-multileague-picks.mjs` 25/25, `qa-timezone.mjs` 18/18, `qa-weekactions.mjs` 27/27.

### Pendientes
- Manual Frontend QA del flujo de marcadores (League Admin).
- Backlog: calificación de empates en Picks/Standings, reconciliación Provider → `master_games` → `league_games` (SUP-004), LIVE-001.
- Git a cargo del usuario (working tree con cambios de hoy sin commitear: SUP-000/001 + BUILD-SCORE-001 + docs).

## Sesión 10c — 🛡️ Consola de ligas read-only (BUILD-SUP-002)

**Estado**: implementado y verificado. Detalle completo en `opencode/plans/superadmin.md` (sección SUP-002). **Sin commitear.**

### Qué se hizo
- **Rutas**: `platformLeaguesRoute()` (`#/platform/leagues`) y `platformLeagueRoute(id)` (`#/platform/leagues/:id`) en `routes.js` + parse/build en `hashRouter.js`; gate en `App.jsx` ampliado a 4 tipos de ruta plataforma con `isSuperAdmin` → `PlatformDenied` (League Admin y usuario normal → deny).
- **`src/pages/PlatformLeagues.jsx`**: listado con tabla (League/Sport/Season/Mode/Sim/Owner/Members/Games/Picks/Timezone/Created), 6 filtros + búsqueda nombre/owner (`ilike`), paginación server-side size 10 (`count: 'exact'`), estados loading/empty/no-results/error.
- **`src/pages/PlatformLeagueDetail.jsx`**: statsBar (Miembros/Juegos/Picks/Partidos hoy) + 8 cards (Overview, Owner/Admin, Timezone, Health, Partidos de hoy, Miembros, Juegos, Standings, Picks resumen). Lógica pura en `src/domains/platform/models/leagues.js` (`computeLeagueMetrics`, `computeLeagueHealth`, `buildStandingsForLeague` reusa `StandingsCalculator`, `summarizePicks`, `formatInTimezone`, `ownerName`, `searchLeagues`).
- **`platformApi.leaguesList`/`leagueDetail`** en `src/supabase.js` con nested counts (`league_members(count)`, `league_games(count)`, `picks(count)`). **Bug real encontrado por QA**: filtro `simulation` limpio enviaba `simulation=eq.` vacío → 400 `22P02`; fix guard `filters.simulation !== ''`.
- `PlatformOverview.jsx`: botón "Ligas →".

### QA
- **Harness `regression.mjs` 435/435** (~66 tests SUP-002), `npm run build` ✅ (673.46 kB js, 199 modules).
- **`qa-platform-leagues.mjs` 31/31** (nuevo): superadmin QA creado por SQL en `auth.users` (Management API `/admin/users` no existe en este proyecto; `supabase_auth.admin.create_user` bloqueado por `0A000`) + claim JWT sincronizado con 2 PATCH a `profiles.platform_role`; listado/columnas; count exact UI=33 BD=33; paginación server-side; filtro sport; búsqueda ilike + no-results; detalle con contenido real (7 miembros / 49 juegos / 128 picks) y 8 secciones; mobile sin overflow; 0 console/red/4xx/writes; usuario normal → PlatformDenied en ambas rutas; cleanup cascade con superadmin real intacto.
- **Hallazgo QA**: los `.cardTitle` usan `text-transform: uppercase` → asserts del detalle en mayúsculas (la primera corrida falló 5 asserts por eso).
- **Regresión E2E full verde**: platform 32/32, scoreeditor 27/27, preseason 15/15, tc0063 45/45, smoke 18/18, multileague 25/25, timezone 18/18, weekactions 27/27.

### Pendientes
- Backlog plataforma restante (SUP-004/005/006/007) y gaps S1/S2.
- Git a cargo del usuario (working tree con cambios de hoy sin commitear: SUP-000/001/002 + BUILD-SCORE-001 + docs).

## Sesión 10d — 📋 PLAN-SUP-003 (Platform User Management, aprobado, sin implementar)

**Estado**: PLAN aprobado en modo READ-ONLY. Detalle en `opencode/plans/plan-sup-003.md`. **Nada de código/BD/RLS/roles modificado.**

### Qué se diseñó
- **Auditoría real** (Management API, read-only): `auth.users` (208) NO leíble desde frontend (0 grants anon/authenticated); `profiles` (207) sin `created_at`; `league_members` (49) y `leagues` (35) SELECT público; `picks` (288) solo platform admin (superadmin cumple `is_platform_admin()`); 1 auth user huérfano (`tc0051-…`); 0 usernames vacíos; 35/35 ligas con admin consistente; actividad por usuario calculable (`GREATEST` de picks/leagues/memberships).
- **Rutas**: `#/platform/users`, `#/platform/users/:id` (gate `isSuperAdmin`, deny normal/League Admin, sin cambios RLS).
- **Listado**: username, platform_role (badge), registrado, ligas, administra, picks, última actividad; búsqueda username `ilike` + id UUID; filtros reales (platform_role, con/sin ligas, con/sin picks, league admin, participación por mode, sim) vía embedded filters.
- **Detalle**: Overview, League Participation (links a `#/platform/leagues/:id`), Activity, Platform Role (platform_role vs league role), Health flags.
- **Decisiones de alcance (usuario)**: ✅ migración `profiles.created_at` (backfill desde auth.users, sin RLS); ✅ sin email en MVP (requiere RPC → backlog); ✅ card "Usuarios" con métricas en `PlatformOverview`.
- **Active User**: derivado (≥1 pick o ≥1 liga admin o ≥1 membresía); `last_login` → backlog. **100% read-only**, sin asignación de roles, sin acciones administrativas.
- **Dependencias BUILD**: migración `008.0-profiles-created-at.sql` + índice `league_members(user_id)`; dominio `src/domains/platform/models/users.js`; `platformApi.usersList`/`userDetail`; QA `qa-platform-users.mjs`; regresión completa.
- **Riesgos**: ninguno blocker/high; Medium: backfill de created_at (hacerlo antes de `SET NOT NULL`), embedded filters, huérfano invisible (limitación). Sin git.

### Pendientes
- Ejecutar BUILD-SUP-003 cuando el usuario lo apruebe (migración + dominio + UI + API + harness + QA + docs).

## Sesión 10e — 📋 BUILD-SUP-003 (Platform User Management, implementado)

**Estado**: implementado y verificado. Detalle completo en `opencode/plans/superadmin.md` (sección SUP-003). **Sin commitear.**

### Migración
- **`supabase/008.0-profiles-created-at.sql`** aplicada vía Management API: `profiles.created_at timestamptz NOT NULL DEFAULT now()` + backfill desde `auth.users.created_at` (antes de `SET NOT NULL`) + índices `profiles_created_at_idx` y `league_members_user_id_idx`. Verificada: 207/207 profiles con `created_at`, 0 NULLs.

### Dominio
- **`src/domains/platform/models/users.js`** (lógica pura): `applyUserFilters`, `searchUsers`/`applyUserSearch` (UUID exacto o `ilike`), `assembleUserIndex` (4 reads planos client-side, sin embeds PostgREST porque la BD no tiene FK `profiles→league_members` ni `profiles→picks`), `matchUserFilters`, `computeUserList`, `computeLastActivity`/`isActiveUser`, `computeUserMetrics`, `computeUserHealth`, `buildLeagueParticipation`, `computeUserOverview`.

### Rutas y gate
- `platformUsersRoute()` → `#/platform/users`; `platformUserRoute(userId)` → `#/platform/users/:id` en `routes.js` + parse/build en `hashRouter.js`. Gate en `App.jsx` ampliado a 6 tipos de ruta plataforma con `isSuperAdmin` → `PlatformDenied`.

### Páginas
- **`src/pages/PlatformUsers.jsx`**: tabla Username/Platform Role/Registered/Leagues/Administers/Picks/Last Activity, 6 filtros + búsqueda por nombre o UUID, paginación size 10, clic en fila → detalle.
- **`src/pages/PlatformUserDetail.jsx`**: statsBar (Ligas/Administra/Picks/Activo) + 4 cards (Overview, Platform Role, Actividad derivada, Health) + tabla de participación en ligas con links a `#/platform/leagues/:id`.
- `PlatformOverview.jsx`: card "👥 Usuarios" con métricas + botones "Usuarios →".

### API
- **`platformApi.usersList`** en `src/supabase.js`: 4 reads planos (`Promise.all`) + ensamblado client-side. **Bug real**: `parseSimulation` booleanizaba `simulation` y el filtro se descartaba; fix: guardar el string crudo.
- `userDetail`: profile por id + ligas que administra + membresías con `leagues(...)` embebido + picks timestamps.

### QA
- **Harness `regression.mjs` 533/533** (~98 tests SUP-003), `npm run build` ✅.
- **`qa-platform-users.mjs` 36/36**: superadmin QA vía SQL + claim JWT; count exact UI=BD; filtros contra BD REAL 1:1 con service role; búsqueda por nombre y UUID; detalle vacío y con picks; mobile sin overflow; 0 errores consola/red/4xx/writes; usuario normal → PlatformDenied; cleanup con superadmin real intacto.
- **Regresión E2E full verde**: platform 32/32, platform-leagues 31/31, scoreeditor 27/27, preseason 15/15, tc0063 45/45, smoke 18/18, multileague 25/25, timezone 18/18, weekactions 27/27.

### Pendientes
- Backlog plataforma restante (SUP-004/005/006/007) y gaps S1/S2.
- Git a cargo del usuario.

## Sesión 11 — 🧭 Fix UX multi-liga (14-ago)

**Estado**: implementado y verificado. **Sin commitear.**

### Contexto
Se reportaron 3 bugs en la navegación multi-liga:
1. El botón "Unirse" no aparecía cuando el usuario ya tenía ligas.
2. Al seleccionar una liga nueva desde el dashboard, las vistas (Picks, Standings) seguían mostrando datos de la liga anterior.
3. El selector de liga del Topbar no actualizaba correctamente al cambiar entre ligas.

### Fix 1 — Botón "Unirse" visible con ligas
- **`src/domains/dashboard/components/LeaguesSummary.jsx`**: nuevo prop `onJoinClick`; encabezado con `sectionHeader` (título + botón "Unirse").
- **`src/domains/dashboard/components/HomeDashboard.jsx`**: pasa `onJoinClick` a ambas instancias de `LeaguesSummary`.
- **`src/domains/dashboard/dashboard.module.css`**: nuevo `.sectionHeader` (flex, space-between).

### Fix 2 — Contexto de liga persistido en memoria
- **`src/league/context/LeagueContext.jsx`**: `persistedId` cambia de `useMemo` (read-only al montar) a `useState` + `setPersistedId`. Se actualiza al resolver una liga desde la URL y al llamar `setActiveLeague`. Esto hace que las rutas legacy (`#picks`, `#board`) resuelvan la liga recién seleccionada sin esperar reload.

### Fix 3 — Entrada a liga desde dashboard actualiza URL
- **`src/App.jsx`**: `onEnterLeague` en el `Home` ahora llama `setActiveLeague(lg.id, 'league')` además de `enterLeague(lg)`, escribiendo la URL `#/league/:id`.

### Fix 4 — Selector de liga estable en Topbar
- **`src/components/Topbar.jsx`**: nuevo prop `route`. Lista ordenada alfabéticamente (`sortedLeagues`). Valor del `<select>` derivado de `route.leagueId` (URL) o `league.id`, no del orden de `myLeagues`.
- **`src/App.jsx`**: pasa `route` al `Topbar`.

### QA
- `npm run build` ✅ (693.69 kB js, 204 modules).
- `git diff --check` sin errores.
- Round-trip de rutas `#/league/:id/picks` y `#/league/:id/standings` verificado.
- Cambios previos del working tree preservados.

### Pendientes
- QA manual en navegador con 2+ ligas reales (admin en ambas).
- Git a cargo del usuario.

---

## Estado actual del proyecto (fin de sesión 14-ago)

### Completado
- Training Camp hasta BUILD-TC-006.3 (HOLD).
- Preseason PS-001→PS-004 (GO/FROZEN).
- Timezone por liga TZ-001→TZ-005.
- Acciones de semana en Picks.
- Roles de plataforma y RLS JWT (SUP-000/001).
- Consola read-only de ligas (SUP-002).
- Consola read-only de usuarios (SUP-003).
- Fix ScoreEditor partial updates (BUILD-SCORE-001).
- Fix UX multi-liga (join visible, contexto persistido, selector estable).

### Pendiente inmediato
- **SUP-004**: reconciliación Provider → `master_games` → `league_games`. Plan aprobado en sesión, requiere decisiones de PO/Arquitecto antes de BUILD (precedencia provider/manual, autorización de `platform_admin`, política de override, S1/S2, dependencia ESPN). **CRÍTICO** → BUILD con `gpt-5.6-luna` `high`.
- **Backlog post-preseason**: provider real ESPN, sincronización automática de resultados, reconciliación manual vs provider, calificación de empates, LIVE-001.
- **Backlog plataforma**: SUP-005 (Audit UI), SUP-006 (user.timezone), SUP-007 (live scores/ESPN).
- **Gaps de seguridad**: S1 (tablas públicas `training_sessions`/`game_weeks`/`pick_submissions`), S2 (`league_roster_open` no aplicada), revocación de grants `anon` sobre `admin_audit_log`.
- **Training Camp**: HOLD en BUILD-TC-006.3.

### Working tree
- Rama: `development`.
- Último commit: `98e17b9` (12-ago).
- Cambios sin commitear: SUP-000/001/002/003 + BUILD-SCORE-001 + fix UX multi-liga + migración 008.0 + docs.
- Git a cargo del usuario.
