# gameguru — Resumen diario 2026-08-09 (Dom)

Rama: development. Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb` (sin service_role; anon key en `.env`). Tooling: node v20.20.2, vite 5.4.21, puppeteer-core@23 (Chrome v151), esbuild 0.21.5 (harness), libsecret-tools (token Management API en `/tmp/opencode/sb_token`). Contexto previo: `gameguru-day-2026-08-08.md` (BUILD-LEAGUE-CONTEXT-01 Fases 1-3: mini-router hash + LeagueContext + LeagueRoute, harness 278/278, QA E2E 45/45, smoke 18/18). **Sesión 8 (este día): PLAN-LEAGUE-CONTEXT-01.1 ejecutado de punta a punta** — aislamiento multi-liga de picks (migración `006.2` aplicada), identidad de liga siempre visible, routing de standings por tipo de liga, LeagueSelector en el Topbar. Harness **285/285**, QA E2E **45/45**, smoke **18/18**, QA multi-liga **25/25** (nueva, ×5 estables) + fix de race en `usePicks`. **Sin commit/push.**

## Sesión 8 — PLAN-LEAGUE-CONTEXT-01.1 (corrección del aislamiento multi-liga)

**Estado**: implementado y verificado. Plan documentado en `opencode/plans/plan-league-context-01.1.md`. **Sin commitear.**

### Hallazgo de fondo (QA-MULTI-LEAGUE-DIAGNOSTIC)
La constraint **global** `picks_user_id_week_game_id_key UNIQUE(user_id, week, game_id)` corrompía picks entre ligas: mismo usuario + mismo `game_id` en 2 ligas → el 2º upsert **sobrescribía en silencio** la fila de la otra liga. El fix previo (TC-006.4-FIX, `onConflict (user_id, week, game_id)`) evitaba el crash 23505 pero **reintroducía** el cross-league overwrite. 150 filas en `picks`, 0 duplicados, todas de sesión.

### Cambios
- **Migración `supabase/006.2-picks-unique.sql`** — idempotente, **aplicada vía Management API** y verificada: dropea la UK global, asegura las UK **por liga** (`(user_id, league_id, week, game_id)` season / `(user_id, league_id, training_session_id, game_id)` sesión), índices `picks_league_idx`/`picks_league_week_idx`. Verificación de aislamiento en BD real (ROLLBACK): mismo usuario/game_id en 2 ligas → **2 filas (KC + SF)**.
- **`src/supabase.js`**: `picksApi.upsert` default → UK por liga `user_id,league_id,week,game_id`.
- **`src/domains/game-week/PicksService.js`**: `savePick`/`confirmPicks` → onConflict de sesión explícito.
- **`src/App.jsx`**: `effectiveLeague` para Topbar/BottomNav; entradas con URL binding (wizard → `training`/`league`, join/sim → liga, **hub → se queda en el dashboard** para no perder el CTA "MAKE YOUR PICKS"); `standings` → `LeagueStandings` (ruta y `#board`); `preserveLeagueView` para el selector.
- **`src/components/LeagueIdentity.jsx`** (nuevo): badge 🏆 nombre + código + chips TC/Semana; integrado en Picks, Leaderboard, GameWeekView; `GameWeekContext` expone `league`/`event`.
- **`src/pages/LeagueStandings.jsx`** (nuevo): practice → `GameWeekLeaderboard` (en `GameWeekProvider`; sin jornada → empty-state + CTA lobby); season → `Leaderboard` legacy.
- **`src/components/Topbar.jsx`/`.module.css`**: **LeagueSelector** (dropdown de ligas) que cambia de liga preservando la vista desde la ruta actual.
- **i18n (es/en)**: `league.identity*`, `leaderboard.practiceEmpty/practiceGoLobby`, `topbar.switchLeague`.

### QA
- Regresión harness **285/285** (nuevos tests 01.1: aislamiento service-level con spy de onConflict + guard del default real en fuente; tests 006.4-H/I/J actualizados al contrato por-liga).
- QA E2E `qa-tc0063.mjs` **45/45** (flujo TC→GW→picks→auto-simulación; el onConflict por-liga no rompió el flujo single-league).
- QA smoke `qa-league-smoke.mjs` **18/18** (routing/URL).
- **QA multi-liga nueva `qa-multileague-picks.mjs` 25/25 (×5 corridas estables)**: un usuario crea 2 ligas season con el MISMO partido, hace pick KC en A y SF en B (cambiando por el LeagueSelector preservando la vista), verifica **2 filas aisladas en `picks`** (REST) + aislamiento en la UI + 0 errores consola/red. Incluye **limpieza best-effort** de las ligas al final (no acumula datos de QA en la BD).
- `npm run build` ✅.
- **Regresión de UX detectada y corregida en el camino**: la Fase 2 navegaba al salir del hub (rompía el CTA del dashboard); revertido el hub a "quedarse en el dashboard" (el QA 45/45 lo pilló).
- **Fix de race en `usePicks` (bug real latente, hallado al estabilizar el QA multi-liga)**: el `loadPicks` en vuelo al cambiar de liga podía **borrar la selección local** recién hecha (`SIN SELECCIÓN` inicial → click del usuario → la carga resuelve y pisa `picks`). Hook reescrito con flag `cancelled` + **merge DB+local** (`localEdits` en `useRef`), y `submitted` derivado de la carga. Sin este fix, el QA fallaba intermitente (20/25) por timing. Ver `plan-league-context-01.1.md §6.1`.
- **Limpieza BD**: 8 ligas `QA-MULTI-*` huérfanas de las corridas pre-cleanup eliminadas vía Management API (picks/members/games + leagues).

### Pendientes
- BUILD-LEAGUE-CONTEXT-02: lobby del Training Camp a contexto de ruta (des-excluir `training` de `LEGACY_REDIRECTABLE`).
- Fases 7-8 de PLAN-LEAGUE-CONTEXT (selector inline contextual, limpieza `Lobby.jsx`/`Dashboard.jsx`).
- Nota: `BUILD-TC-006.4-FIX` (§8.6.4) queda **superado** por 006.2 + 01.1.
