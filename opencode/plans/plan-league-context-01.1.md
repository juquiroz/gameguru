# PLAN-LEAGUE-CONTEXT-01.1 — Aislamiento multi-liga de picks + identidad + routing de standings

**Estado**: aprobado (2026-08-09) y **ejecutado en la misma sesión** (harness **285/285**, QA E2E **45/45**, smoke **18/18**, QA multi-liga **23/23**, build OK, **sin commit/push**).

## 1. Resumen

QA-MULTI-LEAGUE-DIAGNOSTIC encontró **corrupción silenciosa multi-liga**: la constraint global `picks_user_id_week_game_id_key UNIQUE(user_id, week, game_id)` hacía que el 2º upsert de un mismo `game_id` en otra liga **sobrescribiera en silencio** el pick de la liga anterior (o fallara con 23505 según la variante del onConflict). Además, la UI no dejaba clara la liga que se está viendo (solo el nombre en el Topbar) y la tabla de posiciones de una liga practice no era la del Training Camp.

**Propuesta**: (1) migración `006.2` que elimina la UK global y deja UKs **por liga** (season/regular: `(user_id, league_id, week, game_id)`; sesión: `(user_id, league_id, training_session_id, game_id)`); (2) `picksApi.upsert` default → UK por liga, `PicksService` → UK de sesión explícita; (3) identidad de liga siempre visible (badge `LeagueIdentity`); (4) routing de standings por tipo de liga; (5) LeagueSelector en el header que cambia de liga preservando la vista.

## 2. Hallazgo QA (fuente de verdad)

| # | Hallazgo | Impacto |
|---|---|---|
| 1 | UK **global** `(user_id, week, game_id)` en `picks` (la filtró el diagnóstico) | El mismo usuario jugando el mismo partido en 2 ligas pierde/sobrescribe picks |
| 2 | `picksApi.upsert` sin onConflict → upsert por PK; `PicksService` sin onConflict de sesión | Ambiguo; el fix 006.4-FIX (`user_id, week, game_id`) reintroducía el cross-league overwrite |
| 3 | La identidad de liga solo vivía en el Topbar (`league.name`) | Con 2+ ligas, "Mis Picks/Tabla" no dejaba claro a qué liga pertenecían |
| 4 | `#/league/:id/standings` renderizaba SIEMPRE `Leaderboard` legacy (season) | En ligas practice mostraba la tabla semanal legacy, no la del Training Camp |
| 5 | No había forma de cambiar de liga sin salir de la vista | Fricción alta con 2+ ligas |

## 3. Decisiones (preguntadas y resueltas)

1. **La URL manda** (reafirma BUILD-LEAGUE-CONTEXT-01): el `page` de la ruta `#/league/:id/:view` es la fuente de verdad para preservar la vista al cambiar de liga; `activePage` (legacy) es solo fallback.
2. **La entrada desde el hub NO navega**: al hacer clic en una liga desde `LeaguesSummary` el usuario **se queda en el dashboard** (donde vive el CTA "MAKE YOUR PICKS" del hub y el estado del roster). Los flujos de **modales** (ExperienceWizard, Join, CreateSimulation) sí fijan la URL de la liga (practice → `training`, season → `league`).
3. **`training` sigue EXCLUIDO** del auto-redirect legacy (`LEGACY_REDIRECTABLE`) hasta la migración del lobby del TC a contexto de ruta (BUILD-LEAGUE-CONTEXT-02).
4. **Standings por tipo de liga**: `LeagueStandings` despacha — `league_mode === 'practice' || simulation` → jornada del Training Camp (`GameWeekLeaderboard` en `GameWeekProvider`; sin jornada → empty-state con CTA al lobby); caso contrario → `Leaderboard` legacy.
5. **UKs por liga como contrato de datos**: la BD garantiza la unicidad por liga; el onConflict del cliente apunta a la UK correspondiente (default season vs sesión explícita).

## 4. Cambios de esquema — `supabase/006.2-picks-unique.sql`

Idempotente, aplicado **vía Management API** y verificado en la BD real:

- Aborta si detecta duplicados dentro de las UK por liga (`DO $$ ... RAISE EXCEPTION`).
- Asegura `picks_user_league_week_game_key UNIQUE(user_id, league_id, week, game_id)` (season/regular, `training_session_id IS NULL`).
- Asegura `picks_session_game_unique UNIQUE(user_id, league_id, training_session_id, game_id)` (sesiones TC).
- **Dropea la UK global** `picks_user_id_week_game_id_key`.
- Crea índices `picks_league_idx (league_id)` y `picks_league_week_idx (league_id, week)`.

**Verificación en BD real (transacción ROLLBACK)**: mismo usuario `6812c5fe-…`, mismo `game_id` `tc-2-1`, dos ligas → **2 filas aisladas** (KC + SF), cada una bajo su UK por liga.

## 5. Cambios de código

- **`src/supabase.js`**: `picksApi.upsert` default `onConflict = 'user_id,league_id,week,game_id'` (UK por liga de season; `PicksService` pasa la de sesión explícitamente).
- **`src/domains/game-week/PicksService.js`**: `savePick` y `confirmPicks` → `onConflict: 'user_id,league_id,training_session_id,game_id'`.
- **`src/App.jsx`**: `effectiveLeague = routeLeague || currentLeague` (Topbar/BottomNav); entradas con `setActiveLeague(lg.id, page)` (wizard/sim/join) y hub → `enterLeague + handleNavigate('dashboard')`; `LeagueStandings` en el render de `standings` (ruta y legacy `#board`); `preserveLeagueView` para el LeagueSelector.
- **`src/components/LeagueIdentity.jsx`** (nuevo): badge 🏆 nombre + código + chip TC #n + chip Semana n; integrado en `Picks.jsx`, `Leaderboard.jsx`, `GameWeekView.jsx` y expuesto vía `GameWeekContext` (value con `league`/`event`).
- **`src/pages/LeagueStandings.jsx`** (nuevo): despacho por `league_mode`; `useTrainingSession` null-safe; `GameWeekProvider` + `GameWeekLeaderboard` para practice.
- **`src/components/Topbar.jsx` + `Topbar.module.css`**: `LeagueSelector` (`<select>` de ligas) → `onSelectLeague` → `setActiveLeague(id, preserveLeagueView(lg))`. i18n `topbar.switchLeague` (es/en).
- **i18n (es/en)**: `league.identity*`, `leaderboard.practiceEmpty/practiceGoLobby`, `topbar.switchLeague`.

## 6. Verificación

| Fase | Resultado |
|---|---|
| 0 pre-flight BD (constraints, dups, league_games PK) | ✅ Management API |
| 1a/1b migración 006.2 | ✅ aplicada + `pg_constraint`/índices + aislamiento ROLLBACK real |
| 6 harness (nuevos tests 01.1 + actualización 006.4-H/I/J al contrato por-liga) | ✅ **285/285** |
| QA E2E `qa-tc0063.mjs` (flujo TC→GW→picks→simulación) | ✅ **45/45** |
| QA smoke `qa-league-smoke.mjs` (routing/URL) | ✅ **18/18** |
| QA multi-liga `qa-multileague-picks.mjs` (nueva) | ✅ **25/25** (×5 corridas estables) — 2 ligas, mismo `game_id`, picks KC+SF aislados en BD (2 filas) y en la UI; limpieza best-effort de ligas al final |
| `npm run build` | ✅ |

## 6.1 Fix QA: race en `usePicks` (encontrado al estabilizar el QA multi-liga)

Al estabilizar el QA (×5), se reprodujo un **bug real latente** en `src/hooks/usePicks.js`: al cambiar de liga, el `loadPicks` en vuelo podía pisar la selección local recién hecha (el render inicial muestra `SIN SELECCIÓN` con `picks={}` antes de que resuelva la carga de la liga nueva → el click del usuario se borraba). Se reescribió el hook con:
- **`cancelled` flag** (descartar resoluciones de ligas/semanas anteriores, race de orden A→B→A).
- **Merge DB + local**: `selectPick` marca el juego en `localEdits` (`useRef`); al resolver la carga se conservan los picks locales sobre el snapshot de BD (`{...dbMap, ...local}`). Sin esto, una selección hecha durante la carga se perdía.
- `submitted` se deriva de la carga (`!!data?.length`), no de una bandera que quedaba pegada de la liga anterior.

Verificado: harness **285/285**, QA E2E **45/45**, smoke **18/18**, QA multi-liga **25/25** ×5, build ✅.

## 7. Pendientes (fuera de este BUILD)

- BUILD-LEAGUE-CONTEXT-02: migrar el lobby del Training Camp a contexto de ruta (des-excluir `training` de `LEGACY_REDIRECTABLE`).
- Fases 7-8 de PLAN-LEAGUE-CONTEXT: selector inline contextual + limpieza `Lobby.jsx`/`Dashboard.jsx` huérfanos.
- Nota: `BUILD-TC-006.4-FIX` (sección §8.6.4 de `training-camp.md`) queda **superado** por 006.2 + 01.1: el fix band-aid `(user_id, week, game_id)` evitaba el crash 23505 pero sobrescribía picks entre ligas; la UK global se eliminó en esta migración.
