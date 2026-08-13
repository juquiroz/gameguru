# gameguru — Resumen diario 2026-08-07 (Vie)

Rama: development. Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb` (acceso DDL vía Management API `api.supabase.com/v1/projects/.../database/query` + token CLI de gnome-keyring; sin service_role ni proyecto linkeado). Tooling: node v20.20.2, vite 5.4.21, esbuild 0.21.5 (harness), supabase CLI 2.101.0 sin link. Contexto previo: `gameguru-day-2026-08-05.md` (BUILD-TC-005 implementado, migración 005.2 pendiente).

## Qué se hizo hoy (BUILD-TC-005.1 — Persistencia Supabase + flujo Game Week en modo nube)

Cierra el hito TC-005: se valida la persistencia real en Supabase y el flujo completo **Liga → TC → Fixture Generation → Game Week → Picks → Confirmación → Lock** contra la base de nube, se aplica el backfill pendiente (004.1) y se prepara el terreno para el Simulation Engine (TC-006).

### Migraciones
- **`supabase/005.2-game-week.sql` ya estaba aplicada** (por el usuario). Verificación íntegra vía Management API: tablas `game_weeks`/`pick_submissions` (PKs + UK `game_weeks(training_session_id,week)` + UK `pick_submissions(game_week_id,user_id)` + CHECKs de WeekState/`event_type` + FKs + índices) y columnas `league_games.training_session_id`, `picks.training_session_id`/`submitted_at`, `training_sessions.picks_deadline_at`/`pick_window_minutes`. Rest 200 con anon key.
- **`supabase/004.1-season-system.sql` NO estaba aplicada** → ejecutada vía Management API (por SQL directo, no por SQL Editor): `leagues.league_mode` (default 'regular'), `leagues.season` (default '2026'), `master_games.phase` (default 'regular'), CHECKs `leagues_league_mode_check`/`master_games_phase_check`, índices `master_games_phase_idx`/`leagues_league_mode_idx`, backfill. Verificado: la liga real `16d92451-…` ("5agostoprueba") quedó `league_mode='practice'`, `season='2026'`, `simulation=true`.
- RLS: `game_weeks`/`pick_submissions` tienen políticas PUBLIC; `leagues`/`picks`/`league_games` requieren usuario autenticado → el E2E real usó un usuario creado por signup.

### Fix A (DB) — upsert de picks
`picks_session_game_unique` era un **índice parcial**, y PostgREST `on_conflict` solo acepta **unique constraints** (no índices parciales) → `picksApi.upsert({ onConflict: 'user_id,league_id,training_session_id,game_id' })` fallaba con `23505`/PGRST. Se aplicó en la base el `DROP INDEX` + `ADD CONSTRAINT ... UNIQUE` idempotente y se actualizó `supabase/005.2-game-week.sql` (Fix A). El E2E confirmó el rechazo correcto del duplicado (23505) y el upsert por sesión OK.

### Fix B (app) — GameWeekContext con sesión FG
`GameWeekContext` filtraba los partidos solo por `event.id` (sesión Game Week), pero `FixtureGeneratorService` enlaza los `league_games` a la sesión **fixture_generation** → la vista de jornada quedaría vacía en modo nube. Fix: `sessionGameMatch` acepta un `Set` de ownerIds (sesión GW + sesión FG leídas con `trainingSessionsApi.list`, que ahora selecciona `event_type`) + fallback `tc-<sessionNo>-`.

### Verificación
- **E2E real 25/25 PASS** (`/tmp/opencode/tc0051-e2e.mjs`, REST sobre Supabase real con usuario autenticado): perfil, insert liga, join admin, TC (insert + `finished`), FG (insert + 10 `league_games` con `training_session_id=fgId` + `completed`), sesión GW (`event_type game_week`), insert `game_weeks` `picks_open`, rechazo duplicado UK, upsert picks×10 con onConflict por sesión, select 10, confirmación (`submitted_at`), `pick_submissions`, patch `picks_locked`, **persistencia tras refresh** (week/subs/picks/sesión/liga_games), patch `completed`, delete liga con cascade limpio. Datos de prueba borrados.
- **Regresión 56/56 PASS** (harness node con mock de supabase: `/tmp/opencode/regression.mjs` + `build-harness.cjs`, bundle esbuild): directores TC/FG/GW, calendario (determinismo, 16→32 equipos una vez, doble jornada, tiempos), estados defensivos, servicios GW/picks/levels/FG/TS. Los 11 FAILs iniciales eran aserciones del harness desalineadas con el contrato real (p. ej. `getTrainingState` devuelve **string**, no `{state}`; `TICK` lee `start_at` del evento, no del payload; `lastCompletedStep` de un paso activo i = i-1; `GENERATION_PROGRESS` usa `generated>=total`; editar un pick des-confirma); corregidas, no son bugs de la app.
- `npm run build` ✅ (165 módulos); smoke test `vite preview` ✅ (index/js/css 200 bajo `/gameguru/`).
- Flujo manual en navegador: no posible (entorno headless) → el E2E REST replicó las llamadas que hace la app (documentado; pendiente verificación manual con capturas).

## Estado
- Listo para el commit de hito (BUILD-001→TC-005), sin push. Siguiente BUILD: **TC-006 (Simulation Engine)** — parte de `picks_locked` (`getConfirmedPicks` ya es su punto de integración).
