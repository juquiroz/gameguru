# SuperAdmin / Plataforma — SUP-000 + SUP-001 + SUP-002 + SUP-003 (implementado 2026-08-13)

Rol de plataforma con RLS a nivel de base de datos, auditoría y consola read-only. **Sin commitear** (Git a cargo del usuario, rama `development`).

## Contexto y regla crítica

Antes: `profiles.is_superadmin` + policy `UPDATE` de `profiles` con guarda solo de `id = auth.uid()` (un usuario podía auto-escalarse editando su propio `is_superadmin`), `master_games` sin policy `UPDATE` (ruta `masterGamesApi.update` rota) y el guardado se resolvía en el frontend con `if (isSuperAdmin)`.

**Regla**: nunca `if (isSuperAdmin)` como única autorización. RLS confía exclusivamente en el claim JWT `app_metadata.platform_role` (sincronizado por trigger), no en lookups a `profiles` ni en el frontend.

## SUP-000 — Modelo de roles + RLS (FASE 0 → migraciones)

### FASE 0 — Auditoría live DB (read-only)
JSON en `/tmp/opencode/qae2e/audit-live-db-*.json`. 47 policies; RLS activo en 9 tablas; `game_weeks`/`pick_submissions`/`training_sessions` public-read (gap S1, fuera de alcance); `profiles` SELECT público; counts: leagues=29, profiles=176, league_members=43, master_games=321, league_games=277. Hallazgos que definieron 007.x: `handle_new_user` existía solo en BD viva (reconciliado en 007.0); `profiles` con policy UPDATE vulnerable a auto-escalamiento; `master_games` sin policy UPDATE; `league_roster_open` 0 filas (005.4 nunca aplicada; gap S2 documentado, fuera de alcance).

### Migraciones aplicadas (idempotentes, vía Management API)

**`supabase/007.0-platform-roles.sql`**
- `profiles.platform_role TEXT NOT NULL DEFAULT 'user' CHECK (platform_role IN ('user','platform_admin','platform_superadmin'))`.
- Backfill (solo esto): `is_superadmin = true` → `platform_superadmin`; el resto queda `user`. **Los League Admins NO se convierten a `platform_admin`** (`platform_admin` es un tier declarado/dormante: no existe en 007.0 ningún `UPDATE ... SET platform_role='platform_admin'`).
- Trigger `trg_sync_platform_role_to_jwt` (SECURITY DEFINER, `search_path=''`): tras UPDATE/INSERT de `profiles` sincroniza `auth.users.raw_app_meta_data.platform_role` (el claim llega al JWT tras re-login o refresh del token).
- `handle_new_user` reconciliado (existía solo en BD viva; la migración usa `CREATE OR REPLACE` preservando el comportamiento). `profiles.is_superadmin` queda legacy.

**`supabase/007.1-platform-rls.sql`**
- Helpers públicos: `is_platform_superadmin()`, `is_platform_admin()` (leen `auth.jwt()`; fail-closed).
- `master_games`: policies INSERT/UPDATE/DELETE para superadmin (JWT); SELECT público conservado (remedio: antes no había policy UPDATE → ruta rota).
- `profiles`: policy UPDATE reemplazada por guarda de columnas (permite `username`/`platform_role` solo cuando `platform_role` no cambia; bloquea cambiar `id`/`platform_role`); policy INSERT restringida a `platform_role = 'user'`. Sin policies legacy por `is_superadmin`.

**`supabase/007.2-admin-audit-log.sql`**
- `admin_audit_log(id, actor_id, actor_username, action, entity, entity_id, payload, created_at)`.
- `log_admin_action(...)` SECURITY DEFINER, `search_path=''`.
- Sin policy INSERT (escrituras futuras solo Edge Functions/service_role — SUP-004); SELECT solo platform admins vía JWT.

**`supabase/007.3-platform-read-rls.sql`**
- `picks` y `league_games`: SELECT adicional para `is_platform_admin()` (lectura global para la consola; nunca service_role en navegador).

## SUP-001 — Consola read-only + dominio

- **Dominio puro `src/domains/platform/`** (sin React):
  - `models/roles.js`: `PLATFORM_ROLES`, rank, `platformRoleFromJwt(user)` (lee `user.app_metadata.platform_role`), `isPlatformSuperAdmin`, `isPlatformAdmin`, `canReadPlatform` (superadmin o admin).
  - `models/overview.js`: métricas puras — `computeOverviewMetrics` (leagues/members/players/games por fuente y fase, picks count), `computeTodayGames` (por timezone de liga, `gameTimeToDate` + `dateKeyInTimezone`), `computeHealthSummary` (`Healthy`/`Warning`/`Error`).
  - `services/platformService.js`: `canManageLeague(league, user)` — reemplaza los inline `league.admin_id === user?.id || league.role === 'admin'`.
- **`src/hooks/useSuperAdmin.js`**: claim JWT `app_metadata.platform_role` como fuente primaria; fallback legacy `profiles.is_superadmin` solo si el claim no aporta rol.
- **`platformApi.overview()`** en `src/supabase.js`: 8 selects paralelos (leagues, profiles, members, master_games por phase, league_games por league_mode, picks).
- **UI**: `src/pages/PlatformOverview.jsx` + `.module.css` (cards de métricas, hoy por liga, salud del sistema), `src/components/PlatformDenied.jsx`.
- **Ruta `#/platform`**: `parseHash`/`buildHash`/`platformRoute` en `src/router/hashRouter.js` + `routes.js`; guard en `App.jsx` (~línea 250) con **deny explícito** (nada de caída silenciosa). Consola accesible solo con cliente anónimo autenticado + claim JWT.
- **Refactor `canManageLeague`**: aplicado en los 9 inline + 2 extra detectados — `LeaguePage.jsx:24`, `Lobby.jsx:127`, `LeagueDashboard.jsx:20`, `HomeDashboard.jsx:59`, `useDashboardData.js:84`, `useTrainingSession.js:381`, `GameWeekContext.jsx:176`, `LeaguesSummary.jsx:18-20`, `LeaguesOverview.jsx:30`, `Picks.jsx:264` (gestión) + 2 mensajes (`Picks.jsx:236`, `Leaderboard.jsx:163`). Queda `Picks.jsx:170` (badge 👑 por miembro) sin tocar.

## Verificación

- **RLS probes en BD viva** (`/tmp/opencode/qae2e/rls-probe2.mjs`, GUC `request.jwt.claims` + `SET ROLE authenticated`): claim superadmin → helpers true; user auto-promueve → ERROR 42501; user edita username → OK; user inserta master_games → ERROR; superadmin UPDATE master_games → OK; platform_admin lee todos picks/league_games → OK.
- **QA `qa-platform.mjs` 32/32** (esquema/backfill/claim, helpers/triggers, policies master_games/profiles/audit, 9 probes RLS).
- **Harness `regression.mjs` 362/362** (311 baseline + 51 nuevos) + `npm run build` ✅ (654.53 kB js, 193 modules).
- **Regresión E2E completa verde**: `qa-timezone.mjs` 18/18, `qa-preseason.mjs` 15/15, `qa-tc0063.mjs` 45/45, `qa-league-smoke.mjs` 18/18, `qa-multileague-picks.mjs` 25/25, `qa-weekactions.mjs` **27/27**. Aprendizaje QA: `qa-weekactions` era flaky por hora del día (primer partido semana 2 = `2026-08-13T23:00Z` → deadline 22:00Z) — se ancló la semana 2 al futuro con PATCH service_role para hacerla determinista (no era regresión del refactor).

## Único superadmin
`bambino29` (`6812c5fe-b760-48e0-a28f-24005b7a8905`), claim JWT ya sincronizado (`platform_superadmin`).

## Modelo de roles real (auditoría BUILD-SUP-DOC-001, read-only 2026-08-13)

La separación **Platform Admin ≠ League Admin** está correctamente implementada. Estado real en BD viva:

| Rol | Valor | Asignación |
|---|---|---|
| `user` | 195 | default; incluye a los **32 League Admins** (33 distinct admins, 1 es `bambino29`) |
| `platform_admin` | **0** | tier **declarado pero dormante**; asignación explícita por operador (hoy solo vía SQL/service_role, no hay ruta en-app) |
| `platform_superadmin` | 1 (`bambino29`) | explícita (backfill `is_superadmin=true`) |

- **League Admin**: `platform_role='user'`; administra su liga por `league_members.role='admin'` (RLS + `canManageLeague`). NO recibe acceso global.
- **Platform Admin**: requiere asignación explícita; NO se deriva de ser League Admin. Su lectura global (`picks`/`league_games`/audit log) solo se activa con esa asignación.
- **Platform SuperAdmin**: acceso global completo vía policies explícitas (`master_games` writes, consola, etc.).
- **Backfill 007.0** convirtió únicamente `is_superadmin=true → platform_superadmin`. La descripción previa "admin de liga → `platform_admin`" era **incorrecta** (el SQL nunca lo hizo) y quedó corregida en este BUILD.

## SUP-002 — Consola de ligas read-only (implementado 2026-08-13)

Gestión de plataforma de todas las ligas, **exclusiva de `platform_superadmin`** (League Admin y usuario normal → `PlatformDenied`), 100% **read-only** (0 writes a tablas de negocio verificado en QA).

### Rutas y gate
- `platformLeaguesRoute()` → `#/platform/leagues`; `platformLeagueRoute(leagueId)` → `#/platform/leagues/:id` (`src/router/routes.js`); parse/build en `hashRouter.js` (`parseHash`/`buildHash` añaden `platformLeagues`/`platformLeague`).
- `App.jsx`: gate ampliado a los 4 tipos de ruta plataforma con `isSuperAdmin` → `PlatformDenied` (deny explícito, sin caída silenciosa).

### Páginas
- **`src/pages/PlatformLeagues.jsx`** + `.module.css`: tabla League/Sport/Season/Mode/Sim/Owner/Members/Games/Picks/Timezone/Created; 6 filtros (`league_mode`, `simulation`, `deadline_mode`, `season`, `sport`, `phase`) + `ownerQuery` + búsqueda por nombre y owner (`ilike`); paginación server-side (size 10, `count: 'exact'`); estados loading/empty/no-results/error seguro.
- **`src/pages/PlatformLeagueDetail.jsx`** + `.module.css`: statsBar (Miembros/Juegos/Picks/Partidos hoy) + 8 cards: Overview, Owner/Admin, Timezone, Health, Partidos de hoy, Miembros, Juegos, Standings, Picks resumen. Tarjetas con `text-transform: uppercase` (los textos capturados en QA salen en mayúsculas).
- `PlatformOverview.jsx`: botón "Ligas →".

### Dominio (lógica pura, `src/domains/platform/models/leagues.js`)
`DEFAULT_PAGE_SIZE`, `buildOwnerMap`, `ownerName`, `applyLeagueFilters`, `searchLeagues` (`ilike`), `paginate`, `buildFilterOptions`, `computeLeagueMetrics` (members/games/picks/today), `computeLeagueHealth` (`Saludable`/`Con advertencias`/`Con errores` vía `HEALTH_STATUS`), `buildStandingsForLeague` (reusa `StandingsCalculator.computeStandings` — requiere `pick/game_id/result/finished` en las filas), `summarizePicks`, `formatInTimezone`.

### API (`src/supabase.js`, `platformApi`)
- `leaguesList`: selects con **nested counts** (`league_members(count)`, `league_games(count)`, `picks(count)`), `count: 'exact'` (header `Prefer`), `.range()`; filtros `eq`/`ilike`/`order`.
- `leagueDetail`: 6 selects paralelos (liga, members con profile, games con teams, picks con member y game, admin, today).
- **Bug real encontrado por QA**: al limpiar el filtro `simulation` se enviaba `simulation=eq.` vacío → PostgREST 400 `22P02 invalid input syntax for type boolean: ""`. Fix: guard `filters.simulation !== ''`.

### Aprendizajes QA (script `/tmp/opencode/qae2e/qa-platform-leagues.mjs`)
- **Crear superadmin QA sin Management API** (`POST /projects/{ref}/admin/users` → 404 "Cannot POST"; `supabase_auth.admin.create_user()` → `0A000 cross-database references`): insert SQL directo en `auth.users` con `encrypted_password = crypt(pw,gen_salt('bf'))`, `confirmation_token/recovery_token/email_change_token_new/email_change = ''`, `is_super_admin/is_sso_user/is_anonymous = false`, `email_confirmed_at = now()`. **`confirmed_at` es GENERATED (no insertable, 428C9)**. `handle_new_user` crea el profile.
- **Claim JWT**: 2 PATCH a `profiles.platform_role` (`user`→`platform_superadmin`) sincronizan `app_metadata.platform_role` vía trigger 007.0 (verificado en login).
- **PostgREST count**: `Prefer: count=exact` + leer `content-range` (el param `&count=exact` da PGRST100).
- **Enter en búsqueda**: `page.keyboard.press('Enter')` NO dispara `onKeyDown` de React → dispatch de `KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true})`.
- **`page.evaluate`** no cierra sobre funciones del scope Node → helpers inline.
- **Uppercase**: los `.cardTitle` tienen `text-transform: uppercase` → asserts en mayúsculas.

### Verificación
- **Harness `regression.mjs` 435/435** (369 baseline + ~66 SUP-002: rutas, filtros, searchLeagues ilike, paginate, owner, metrics, health, standings, picks summary, formatInTimezone). `npm run build` ✅ (673.46 kB js, 199 modules).
- **`qa-platform-leagues.mjs` 31/31**: superadmin QA vía SQL + claim JWT; columnas del listado; count exact UI=33 BD=33; paginación server-side; filtro sport; búsqueda ilike exacta + no-results; detalle sobre liga con contenido real (momiospreseason: 7 miembros / 49 juegos / 128 picks, 8 secciones, health, standings, owner resuelto, volver al listado); mobile sin overflow; 0 console/red/4xx/writes; usuario normal → PlatformDenied en ambas rutas; cleanup cascade + superadmin real intacto (solo `bambino29`).
- **Regresión E2E completa verde**: `qa-platform.mjs` 32/32, `qa-scoreeditor.mjs` 27/27, `qa-preseason.mjs` 15/15, `qa-tc0063.mjs` 45/45, `qa-league-smoke.mjs` 18/18, `qa-multileague-picks.mjs` 25/25, `qa-timezone.mjs` 18/18, `qa-weekactions.mjs` 27/27.

## SUP-003 — Platform User Management (implementado 2026-08-13)

Diseño aprobado en sesión 2026-08-13/14 (plan `plan-sup-003.md`), implementado read-only. Consola de usuarios `#/platform/users` + `#/platform/users/:id` para `platform_superadmin`: listado (username, platform_role, registrado, ligas, administra, picks, última actividad), búsqueda por username/UUID, 6 filtros (platform_role, con/sin ligas, con/sin picks, rol en liga, participación por `league_mode`, simulación), detalle (statsBar + cards Overview/Platform Role/Actividad derivada/Health + Participación en ligas con links a `#/platform/leagues/:id`) y card "👥 Usuarios" en `PlatformOverview`.

### Rutas y gate
- `platformUsersRoute()` → `#/platform/users`; `platformUserRoute(userId)` → `#/platform/users/:id` (`src/router/routes.js`); parse/build en `hashRouter.js` (`parseHash`/`buildHash` añaden `platformUsers`/`platformUser`).
- `App.jsx`: gate ampliado a los 6 tipos de ruta plataforma con `isSuperAdmin` → `PlatformDenied` (deny explícito; League Admin y usuario normal denegados, `platform_admin` no activa el gate).

### Páginas
- **`src/pages/PlatformUsers.jsx`** + `.module.css`: tabla Username/Platform Role/Registered/Leagues/Administers/Picks/Last Activity; 6 filtros + búsqueda por nombre o UUID (Enter); paginación size 10 (`ceil(count/pageSize)`); estados loading/empty/no-results/error seguro; clic en fila → detalle.
- **`src/pages/PlatformUserDetail.jsx`** + `.module.css`: statsBar (Ligas/Administra/Picks/Activo) + 4 cards + tabla de participación con links a `platformLeagueRoute`. NUNCA email/auth status (fuera del MVP).
- `PlatformOverview.jsx`: card "👥 Usuarios" con `computeUserOverview(rows)` (total/conLigas/sinLigas/conPicks/superadmins) + botones "Usuarios →" y "Gestionar Usuarios →".

### Dominio (lógica pura, `src/domains/platform/models/users.js`)
`DEFAULT_USERS_PAGE_SIZE=10`, `USER_NO_FILTER`, `applyUserFilters` (normaliza/whitelist, no descriptores PostgREST), `searchUsers` (descriptor UUID/ilike) y `applyUserSearch` (entry-level), `assembleUserIndex` (une las 4 tablas), `matchUserFilters` (predicado puro), `computeUserList` (filtros + búsqueda + orden `created_at` desc + paginación → `{items,count}`), `computeLastActivity` (GREATEST de picks/ligas/membresías), `isActiveUser` (≥1 pick O ≥1 liga administrada O ≥1 membresía), `computeUserMetrics`, `computeUserHealth` (missing_username / legacy_inconsistent / admin_without_member_row), `buildLeagueParticipation`, `computeUserOverview`.

### Decisión clave — FKs reales de la BD viva (check `check-fks.mjs`)
La BD NO tiene FK `profiles→league_members` ni `profiles→picks`; SOLO `league_members→leagues` y `pick_submissions→profiles`. Consecuencia: los embeds/counts anidados desde `profiles` (`league_members(count)`, `picks(count)`) y filtros `league_members.role`/`leagues.league_mode`/`leagues.simulation` desde `profiles` fallan en runtime con PostgREST `PGRST200` (build compila, runtime NO). Los nested filters desde `league_members` (con embed `leagues`) devuelven resultados incoherentes (`leagues: null`). Por eso **`platformApi.usersList` ensambla client-side**: 4 reads planos (profiles, league_members, leagues, picks — todos con policies de lectura públicas/de plataforma) + dominio puro. Escala al MVP (~207 perfiles); server-side requeriría FKs nuevas o RPC de agregación (nota en el código).

### API (`src/supabase.js`, `platformApi`)
- `usersList`: 4 `Promise.all` planos → `assembleUserIndex` + `computeUserList` → `{items,count}`. `userDetail`: profile por id + ligas administradas (`admin_id=eq`) + membresías con `leagues(...)` embebido (FK real) + picks timestamps. `userFilterOptions`: `participationModes`/`simulations` reales desde `leagues`. `overview` select enriquecido con `platform_role, is_superadmin, created_at`.
- **Bug real encontrado por QA**: `parseSimulation` booleanizaba `simulation` (`true`/`false`) y `applyUserFilters` (string-based) lo descartaba → el filtro simulaba "todos". Fix: guardar el string crudo (`setFilter('simulation', e.target.value)`).

### Migración `supabase/008.0-profiles-created-at.sql` (aplicada a BD viva, idempotente)
`profiles.created_at timestamptz NOT NULL DEFAULT now()` + backfill desde `auth.users.created_at` (no hay email/last_login en public schema; `auth.users` con 0 grants al navegador) + índices `profiles_created_at_idx` y `league_members_user_id_idx`. Verificada: 207/207 profiles con `created_at`, 0 NULLs, 0 mismatches vs `auth.users.created_at`. Registro (fecha) sale de `profiles.created_at`; email/last_login/estado de cuenta = backlog (RPC/Edge Function).

### Verificación
- **Harness `regression.mjs` 533/533** (incluye ~66 SUP-002 + nuevo bloque SUP-003: applyUserFilters normalizado, applyUserSearch, assembleUserIndex, matchUserFilters, computeUserList con orden/paginación, computeLastActivity, isActiveUser, computeUserMetrics, computeUserHealth, buildLeagueParticipation, computeUserOverview, rutas). `npm run build` ✅.
- **`qa-platform-users.mjs` 36/36**: superadmin QA vía SQL + claim JWT; columnas del listado; count exact UI=BD; paginación; **filtros contra BD REAL comparados 1:1 con service role** (has_leagues=49, has_picks=22, league_role=admin=35, participation_mode=practice=27, simulation=true=37 — todos UI=BD); búsqueda por nombre (bambino29) y por UUID; detalle de usuario vacío (cards + participación vacía) y de usuario con 48 picks; mobile 390px sin overflow; 0 console/red/4xx/writes; usuario normal → PlatformDenied en ambas rutas; cleanup cascade + superadmin real intacto (solo `bambino29`).
- **Regresión E2E completa verde**: `qa-platform.mjs` 32/32, `qa-platform-leagues.mjs` 31/31, `qa-scoreeditor.mjs` 27/27, `qa-preseason.mjs` 15/15, `qa-tc0063.mjs` 45/45, `qa-league-smoke.mjs` 18/18, `qa-multileague-picks.mjs` 25/25, `qa-timezone.mjs` 18/18, `qa-weekactions.mjs` 27/27.

## Fuera de alcance / backlog
- SUP-004/005 (writes por Edge Functions/service_role + policy INSERT de `admin_audit_log`; Audit UI), SUP-006/007 (user.timezone, live scores/ESPN), SUP-008/009 (email/last_login/estado de cuenta vía RPC/Edge Function — hoy `auth.users` con 0 grants). SUP-002 y SUP-003 implementados (ver arriba). Gap S1 (public-read de `game_weeks`/`pick_submissions`/`training_sessions`), gap S2 (`league_roster_open`).
- Preseason GO/FROZEN; Training Camp HOLD (BUILD-TC-006.3).
- **Backlog de seguridad (opcional, no implementado)**: revocar grants `anon` sobre `admin_audit_log` — defense-in-depth. Hoy el RLS (policy `is_platform_admin()`) ya bloquea a anon; revocar los grants `SELECT/INSERT/UPDATE/DELETE` de `anon` (conservando los de `authenticated`, que la policy necesita) sería limpieza mínima sin cambio de comportamiento. No se hizo en BUILD-SUP-DOC-001 (no tocar grants en BUILD de docs).

## BUILD-SCORE-001 (2026-08-13) — impacto en plataforma
- **`master_games` sync eliminado del flujo League Admin** (`LeagueGamesManager.handleSetScores`): con la policy UPDATE de `master_games` restringida a `is_platform_superadmin()` (007.1), la llamada `masterGamesApi.setScoresByGameId` siempre fallaba para un League Admin y el error se tragaba con `console.error`. Decisión: **`league_games` es la source of truth de la captura manual** para las vistas de la liga; el RLS de `master_games` NO cambia en este BUILD; la reconciliación `Provider → master_games → league_games` queda para SUP-004 (el método `setScoresByGameId` permanece en `src/supabase.js` sin caller, reservado para ese uso).
- Root cause del SAVE roto y fix en `opencode/plans/preseason.md` (sección BUILD-SCORE-001); verificación: harness 369/369, `qa-scoreeditor.mjs` 27/27, regresión completa verde.
