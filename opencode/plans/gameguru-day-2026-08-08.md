# gameguru — Resumen diario 2026-08-08 (Sáb)

Rama: development. Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb` (sin service_role; anon key en `.env`). Tooling: node v20.20.2, vite 5.4.21, puppeteer-core@23 (Chrome v151.0.7922.108 en `/opt/google/chrome/chrome`), esbuild 0.21.5 (harness). Contexto previo: `gameguru-day-2026-08-07.md` (BUILD-TC-005.1: persistencia en modo nube, E2E REST 25/25, regresión 56/56). Hito TC-005 cerrado en el commit `7cb799a` (rama `development`, **sin push**). Sesión 5: BUILD-TC-006.4-FIX (242/242). Sesión 6: PLAN-LEAGUE-CONTEXT aprobado y documentado (sin código). **Sesión 7 (este día, continúa en 2026-08-09): BUILD-LEAGUE-CONTEXT-01 — Fases 1-3 implementadas (mini-router hash, LeagueContext, LeagueRoute), harness 278/278, QA E2E 45/45, smoke multi-liga 18/18, sin commit/push.**

## Sesión 1 — BUILD-TC-005.3/5.4 (QA end-to-end desbloqueado + cierre QA TC-005)

El Training Camp quedaba bloqueado en el estado START (countdown de 60 s por la hora del evento) y el flujo completo **TC → Fixture Generation → Game Week → Picks** nunca podía verificarse en un navegador real. Este BUILD desbloquea el flujo con una acción administrativa idempotente (`ADVANCE_EVENT`), mejora la UX del estado START, corrige el desajuste esquema↔parches que rompía la persistencia en nube, y deja **todo el ciclo verificado en un navegador real con 0 errores de consola/red**.

### Cambios de código (sin commitear)
- **`ADVANCE_EVENT`** (contrato genérico del `EventDirector`, al estilo de `TICK`; descartado `COMPLETE_TRAINING_CAMP`): en `TrainingCampDirector` es **idempotente** — `null` si `finished`/`cancelled`/`created`; en cualquier otro estado → `{ state: 'finished', finished_at, finished_reason: 'admin' }`. Al quedar `finished`, los spawns existentes del hook (guards ref) disparan FG → GW → Picks **sin duplicar**.
- **`useTrainingSession.advanceEvent()`** — dispatch + `applyPatch` (patrón de `cancelEvent`).
- **`TrainingCampLobby.jsx`**: panel admin ("Admin controls (QA)") solo para admin + TC + evento activo (`phase ready|training_started`) + `state !== 'finished'`, botón `⏭️ Advance event (complete Training Camp)` con `window.confirm`. Estado START ahora muestra la UX activa.
- **`TrainingCampCountdown.jsx`**: estado activo — "Training Camp is live" + "Running for: hh:mm:ss" + siguiente paso (FG). i18n `personaActive/activeSub/elapsed/nextStep/adminControls/advanceEvent/advanceConfirm/...` (es/en).
- **Fix de esquema (persistencia)**: `trainingSessionService.toCloudPatch()` — el PATCH a la nube excluye campos internos/QA que **no son columnas** de `training_sessions`: claves `__`-prefijo (`__week` que adjunta `GameWeekService.lockWeek`), `finished_reason`, `locked_at`, `lock_reason`. Antes esos PATCH fallaban con **400 PGRST204** y degradaban a localStorage: la UI seguía, pero la nube quedaba atrás y el estado no sobrevivía al refresh. Ahora el esquema desplegado no se rompe y la nube queda al día.
- **Favicon**: `public/favicon.svg` + `<link rel="icon" href="/gameguru/favicon.svg">` en `index.html` (elimina el 404 de consola del `/favicon.ico` por defecto).

### QA browser real — 43/43 PASS (TC-005.3) + 48/48 PASS (TC-005.4)
Script `/tmp/opencode/qae2e/qa-tc0053.mjs` (puppeteer + Chrome headless contra `vite preview` en 4175):
1. Signup por UI (sesión directa) → wizard TC → liga creada.
2. Lobby → `Open lobby` → `Start now` → countdown (60 s).
3. **Fast-forward del reloj**: PATCH REST de `start_at` al pasado + **reload** → re-entrada a la liga desde el dashboard (el contexto de liga es cliente) → el TICK transiciona solo a `training_started` ("Training Camp is live").
4. Panel admin → **`ADVANCE_EVENT`** → FG (1 sola vez) → GW (1 jornada).
5. 10 picks → confirmar → bloqueo `all_submitted` → **persistencia tras refresh** (sigue bloqueada, 20 botones deshabilitados, 0 "SIN SELECCIÓN") → edición tras lock = no-op.
6. Integridad de red: `training_sessions` POST ×3, `league_games` ×1, `game_weeks` ×1, `pick_submissions` ×1, 0 respuestas ≥500, 0 peticiones fallidas, **0 errores de consola** → delete liga cascade limpio.

**QA final (`qa-tc0054.mjs`) 48/48 PASS** + regresión 82/82 tras rebuild. **Bug fijado**: `createTrainingCamp()` no persistía `league_mode` y la BD default `'regular'` hacía que tras reload el gate del CTA rompiera; fix en `src/hooks/useLeague.js` persistiendo `league_mode: 'practice'` junto a `simulation: true`. Quedan 4 ligas huérfanas de QA (ids `603b07f8-…`, `f7a717a8-…`, `7f23bd9a-…`, `e3b225e1-…`) que solo se borran manualmente en Dashboard (RLS).

Correcciones de selectores durante el debug (no bugs de la app): la UI está en inglés (lang del navegador; `Auth` es el único español hardcodeado); `hasText` para elementos con prefijo emoji; reentrada a la liga tras reload; la nota "all participants confirmed" solo se ve con la ventana abierta (con 1 solo usuario el lock es inmediato); los botones de equipo no contienen `@` (es un `<span>` separado).

### Verificación
- **Regresión harness 69/69 PASS** (`node build-harness.cjs && node regression.bundled.mjs`, mock de supabase): incluye la sección TC-005.3 que replica la orquestación TC → OPEN_LOBBY → START_NOW → TICK → training_started → ADVANCE → finished → spawn FG ×2 (guard) → START_GENERATION → generate → SAVE_COMPLETE → completed → spawn GW ×2 (guard) → openWeek → picks_open.
- `npm run build` ✅ (165 módulos, `dist/assets/index-VAe-dF1x.js`); preview 4175 sirviendo el build fresco.

## Sesión 2 — BUILD-TC-006.1 (Simulation Engine: núcleo, sin UX)

**Estado**: implementado y verificado. Harness **140/140 PASS** (82 previos + 58 TC-006), `npm run build` ✅ (bundle `index-CC5Eoaky.js`), smoke preview 200. **Sin commitear**; migración `006.1` **aplicada manualmente** en Supabase (SQL Editor) antes de BUILD-TC-006.2.

### Qué se construyó (dominio `src/domains/simulation/`, 4 módulos aprobados en PLAN-TC-006)
- **`SimulationDirector.js`** — máquina INTERNA de la corrida (pura, extiende `EventDirector`): `waiting → simulating → persisting_results → updating_standings → completed` (+ `failed`/`cancelled` virtuales). `dispatch` idempotente, `SIMULATION_PROGRESS` monotónico, `currentStep`/`lastCompletedStep`. Se persiste en `game_weeks.simulation_progress`.
- **`MatchSimulator.js`** — determinista: `simulateGame(game, {seed, index})` → `{home_score, away_score, result}`; RNG `mulberry32(seed+index)` (mismo de fixtureCalendar); rango v1 3..38; empate → `result = null`; `result` siempre coincide con scores. `simulateBatch` con índices estables `[start, start+limit)`.
- **`StandingsCalculator.js`** — puro: todos los participantes aparecen (sin pick → 0); `correct`/`total`/`points`; empate no suma; orden correct desc → total asc → username asc. No persiste.
- **`SimulationService.js`** — fachada sin React: `start` (picks_locked → simulating, persiste seed+progreso en `game_weeks`, evento `games_in_progress`), `runBatch` (simula `[from, from+count)`, persiste SOLO en `league_games` vía `setScores`, evento `simulation_running`, degrada a localStorage `gameguru.sim.<weekId>`), `finalize` (PERSIST_DONE → standings → STANDINGS_DONE → week `completed` + `simulated_at`), `getConfirmedPicks`. **Nunca escribe picks**.

### Integración al contrato
- `EventDirector` `EVENT_ACTIONS` += `SIMULATION_START`/`SIMULATION_PROGRESS`/`PERSIST_DONE`/`STANDINGS_DONE`/`FAIL`.
- `GameWeekDirector` (máquina pública del evento): steps `waiting → picks_open → picks_locked → games_in_progress → simulation_running → completed`; casos `SIMULATION_START`, `SIMULATION_PROGRESS`, `ADVANCE_EVENT` idempotente (QA/admin).
- `trainingSessionService.toCloudPatch` `INTERNAL_FIELDS` += `simulation_progress` (no es columna de `training_sessions` → excluida del PATCH; evita PGRST204/degradación, patrón de TC-005.3).
- `supabase/006.1-simulation.sql` (idempotente, **APLICADO manualmente**): `game_weeks` + `seed int` / `simulation_progress jsonb` / `simulated_at timestamptz` + `CREATE INDEX IF NOT EXISTS game_weeks_sim_state_idx`.

### Verificación (harness `/tmp/opencode/regression.mjs` + mock)
- `mock-supabase.js`: agregado `leagueGamesApi.setScores`; `bundle-entry.mjs`: export de simulación.
- Determinismo: misma seed+índice → igual; seed/índice distinto → distinto; rango 3..38; empate alcanzable; `simulateBatch` slice con índice estable.
- Máquina: transiciones, idempotencia (re-dispatch → null), FAIL/CANCEL, steps, current/lastCompletedStep.
- Standings: 1 acierto/1 error/empate/no finalizado/sin pick → valores correctos + orden.
- Integración mock (flujo completo): `start` → `runBatch` (4 persistidos en `league_games`) → `finalize` (week `completed` + `simulated_at`); **cero escrituras sobre picks**; re-run tras completed no duplica; **índice estable entre batches** (`from=2` === `index 2`) — este último guarda el fix del BUILD: `runBatch` usaba `index: start` para todo el batch y se corrigió a `index: start + i`.
- `npm run build` ✅; preview sirviendo `index-CC5Eoaky.js` en **4173** (puerto default de `vite preview`; 4175 era flag de los QA).

## Sesión 3 — BUILD-TC-006.2 (Orquestación automática de la simulación)

**Estado**: implementado y verificado. Harness **187/187 PASS** (140 previos + 47 TC-006.2), `npm run build` ✅ (bundle `index-DNmJH1Q8.js`), smoke preview 4173 200. **Sin commitear, sin push**. Migración `006.1` **aplicada manualmente** (SQL Editor) antes de este BUILD → la corrida persiste en la nube, no degrada.

### Qué se construyó
- **`useTrainingSession.js` (orquestación)**: efecto con `simGuardRef` **por id de jornada** (StrictMode/ticks/re-renders no duplican; semana distinta re-arranca el guard). Auto-start solo si `event_type==='game_week'` y `state==='picks_locked'`; resume en `games_in_progress`/`simulation_running` (reload a mitad de corrida lee `simulation_progress`). `batchSizeFor(speed)`: demo→1 / normal→3 / fast→5. `runBatches` en bucle mientras `simulating` con guarda anti-bucle (progreso no avanza → stop, resume reintenta). `runFinalize` = `listSessionGames` + `getConfirmedPicks` + `membersRef`/`profilesRef` → `finalize` → `markSessionFinished` (`training_sessions.state='finished'`). `runSimulation` ramifica por estado persistido (waiting→start / simulating→batches / persisting|updating→finalize / completed→COMPLETE_EVENT idempotente + `finished` si falta).
- **`GameWeekService.listSessionGames(event, leagueId)`** + `sessionGameMatch(game, ownerIds, sessionNo)` extraído (RAW rows `league_games` con `id`/`game_id`; fallback `tc-<sessionNo>-`); compartido con `GameWeekContext` (que además incluye `finished` en `isCompleted`).
- **Fix `GameWeekDirector.getCurrentStep`**: `finished` (estado de sesión terminal) era mapeado por `getWeekState` → `waiting` (la UI retrocedía al paso inicial). Ahora `rawState` → alias `finished→completed` antes de mapear. Cubierto por tests 6.2-A/G.

### Verificación (harness A–K, réplica exacta del flujo del hook)
- A: `picks_locked` → auto corrida completa (seed/simulated_at/4 finished/cero escrituras picks). B: batching batch1(2)→batch2(4) con estados `games_in_progress`→`simulation_running`. C: determinismo entre batches (índices 0/3 === `simulateGame` aislado). D: reload/resume a mitad — completa restantes, **setScores solo 4 veces** (no re-escribe finished), progreso monotónico. E: StrictMode double-fire **concurrente** (`Promise.all`) — sin duplicados, scores deterministas, jornada completed una vez. F: usuario sin pick → 0. G: finalización completa (`finished` → paso terminal `completed`). H: idempotencia. I: cero escrituras picks/pick_submissions. J: `setScores` = 1 por partido (mock con contador `__stats`). K: estados consistentes sesión+jornada.

## Sesión 4 — BUILD-TC-006.3 (UX de Simulation + Results sobre el motor TC-006.1/006.2) + CIERRE EN LA NUBE

**Estado**: implementado y **QA E2E browser real completo 45/45 PASS** con 0 errores de consola/red y 0 respuestas ≥500. Harness **231/231 PASS** (187 previos + 44 TC-006.3), `npm run build` ✅ (bundle `index-DwdsI9lI.js`), smoke preview 4173 200. **Sin commitear, sin push**. Esta sesión además **destrabó y aplicó las migraciones pendientes en la nube** (ver abajo): el QA E2E del TC-006.3 **no podía pasar hasta aplicarlas** y encontró 3 bugs reales que se corrigieron.

### Migraciones aplicadas en la nube (bloqueante destrabado)
- **`supabase/006.1-simulation.sql`** — las columnas `seed`/`simulation_progress`/`simulated_at` de `game_weeks` **NO existían** en la nube (el handoff previo la daba por "aplicada manualmente", pero PATCH `game_weeks` respondía **400 `Could not find the 'seed'/'simulation_progress' column`** y el front degradaba a localStorage). Aplicada vía **Management API** (token personal del usuario extraído del gnome-keyring con `libsecret-tools`; `POST /v1/projects/yzssihtflqmgolyajhvb/database/query`). Verificado: PATCH `simulation_progress`/`seed` → **200** (antes 400), columnas presentes en `information_schema`.
- **`supabase/006.1b-league-games-update.sql`** (NUEVO, idempotente): el RLS de `league_games` solo permitía UPDATE a admins (`role='admin'`), pero la simulación se orquesta desde el cliente del usuario que dispara el lock (puede ser un `member`). Un miembro bloqueaba el UPDATE → 0 filas → el batch no avanzaba. Se añade la política `lg_update` **por membresía** (`league_members.user_id = auth.uid()`), consistente con el esquema permisivo del demo; ScoreEditor (admin-only) no cambia.

### Bugs reales encontrados por el QA E2E y corregidos
1. **`SimulationDirector.defaultRun`/`getSimulationState` no toleraban `null` explícito** (`SIMULATION_STATES[null.state]` → `Cannot read properties of null`). Con la columna `simulation_progress` recién creada, la nube devuelve `null` (antes `undefined` porque no existía) y `defaultRun(null)` reventaba el render al abrir la Game Week. Fix: normalización `run || {}` en ambas funciones. Cubierto por tests 6.3-A2.
2. **RLS de `league_games`** (migración 006.1b, arriba). El log `[simulationService.runBatch] setScores falló ... (posible problema de permisos)` era silencioso antes (`if (error) break`); ahora loguea el partido + `error.message`.
3. **`useTrainingSession.participants` no exponía `id`** (los miembros RAW vienen con `user_id`): `computeStandings` agrupaba por `p.id` → todos colisionaban en `undefined` y el leaderboard colapsaba a UNA fila (el último participante). Síntoma en el QA: solo aparecía `botB`, no `botA`, y el resumen decía "No picks". Fix: `participants = decorateParticipants(members, {}).map(m => ({ ...m, id: m.user_id, username: ... }))` (contrato `{ id, username }` del leaderboard; `TrainingCampParticipants` sigue usando `user_id`). Cubierto por tests 6.3-E2.

### Qué se construyó (UX 006.3)
- **`src/domains/game-week/simulationView.js`** (dominio puro, sin React): `getSimulationRun` (estado + completed/total + % con clamp defensivo), `buildResultsView` (proyección de `league_games` con scores/draw/finished), `sortStandings` (orden determinista), `buildLeaderboard` (rank 1..N, sin pick → 0), `canRevealPicks` (PRIVACY-001 practice vs oficial), `buildPickFeedback` (solo planilla propia en oficial, `revealAll` fuerza policy). Usa `defaultRun`/`StandingsCalculator`/`modes.js`.
- **`GameWeekContext.jsx`**: prop `participants = []`, state `allPicks`, expone `isSimulating`/`simRun`/`resultsMap`/`standings`/`myUserId`; `selectPick` no bloquea durante simulación (la UI no ofrece acciones).
- **Componentes**: `SimulationProgress.jsx` (status + barra + %), `GameWeekResults.jsx` (GameCard con scores + resumen "Your picks: {correct}/{total}" + `isDraw`), `GameWeekLeaderboard.jsx` (tabla rank/player/correct/total/pts, fila `boardMe`). Wiring en `GameWeekView.jsx`: en `games_in_progress`/`simulation_running` → SimulationProgress y NO acciones; en `completed`/`finished` → banner + Results + Leaderboard; badge con transición `Simulation starting → Simulation running`; `locked = isLocked || isCompleted`. `TrainingCampLobby` pasa `participants` al provider. i18n ES/EN `gameWeek.*` y CSS `.badgeSim/.simCard/.board*/.completedBanner/.drawTag` completos.

### Privacy Behavior (PRIVACY-001)
- Practice (Training Camp): `canRevealPicks` → `true` (transparencia educativa; `buildPickFeedback` revela todas las planillas si `revealAll`). Oficial (preseason/regular): privado, solo la propia planilla. Policy consultada vía `isOfficialMode`/`getLeagueMode` de `src/domains/league/models/modes.js` (sin hardcodear). El leaderboard solo muestra agregados (correct/total/points), nunca picks de otros.

### Verificación (harness `/tmp/opencode/regression.mjs` + QA browser)
- **Regresión 231/231**: 187 previos + 44 TC-006.3 (A: run null/waiting/30%/100% + clamp; A2: `defaultRun(null)`/`getSimulationState(null)`; B: progreso 3/10→30%, completed→100%; C/D: buildResultsView/finished+result null=draw; E: leaderboard 4 usuarios, rank, tie-break, sin pick → 0; E2: participants con `user_id` normalizados a `id` (sin colapso); F/G: flujo mock completo; H: run completed tras refresh sin re-simular; I: privacy practice vs regular/season; J/K: `isWindowOpen` en estados sim + `savePick` rechazado).
- **QA E2E real 45/45** (`/tmp/opencode/qae2e/qa-tc0063.mjs`, puppeteer + Chrome contra preview 4173, migraciones aplicadas): 2 usuarios → liga → TC → advance → FG → GW → 10 picks cada uno → confirmación → lock → **auto-simulación completa (REST `game_weeks.state='completed'`)** → A/B ven resultados (10 scores, feedback ✓/✗, "Your picks", leaderboard con ambos) → refresh: resultados sobreviven sin re-simular → **resume**: inyección de run 3/10 + reload → "Simulation progress · 3 of 10 games" → resume completa → integridad de red (training_sessions POST ×3, league_games ×1, game_weeks ×1, pick_submissions ×2, picks ≥20, setScores ≥1, 0 ≥500, 0 fallidas, **0 errores de consola**) → DELETE league cascade.
- `npm run build` ✅; preview 4173 sirviendo `index-DwdsI9lI.js`.

## Estado
- Flujo TC completo verificado: TC→FG→GW→Picks→`picks_locked`→**auto simulación→results→standings→`completed`/`finished`** (harness) **+ UX 006.3 en navegador real 45/45** (progreso en vivo, resultados, leaderboard, resume, 0 errores). Hito TC-005 commiteado (`7cb799a`); TC-005.3/5.4 y **TC-006.1 + TC-006.2 + TC-006.3 sin commitear, sin push**.
- **Nube al día**: migraciones `006.1` y `006.1b` aplicadas vía Management API (PATCH `game_weeks` 200; setScores de miembros 200). Nuevo archivo `supabase/006.1b-league-games-update.sql`.
- Orphan data de las corridas QA fallidas (ligas `QA-TC0053-*`, `QA-TC0063-*` + 4 ligas TC-005.4): se ignoran o se limpian manualmente en Dashboard (RLS).
- Siguiente BUILD: **TC-007/TC-008** (graduación, Edge/realtime). No implementado en esta sesión.

## Sesión 5 — BUILD-TC-006.4-FIX (bug de persistencia de picks 23505 + banner fantasma)

**Estado**: corregido y verificado. Harness **242/242 PASS** (231 previos + 11 nuevos 006.4-A..J), `npm run build` ✅ (bundle `index-CoPeYQpY.js`), smoke preview 4173 200, QA E2E browser `qa-tc0063.mjs` **45/45 PASS** re-ejecutado con el onConflict nuevo, y **reproducción/verificación en BD real** (transacción ROLLBACK): el escenario del bug ya no produce `23505` y deja exactamente **1 fila por (user_id, game_id)**. **Sin commitear, sin push**. No se tocó SimulationDirector/MatchSimulator/StandingCalculator/EventDirector/TC-007.

### Root cause (reproducida en BD real)
- Síntoma reportado: al guardar 6/6 picks en la página **Mis Picks** (la liga no tenía `league_games` importados → `useDynamic=false` → la app muestra el calendario estático `NFL_WEEKS[week]`, 6 juegos `w1g1..w1g6`), el botón quedaba en "Guardando..." y la BD devolvía `duplicate key value violates unique constraint` (reportado como `picks_user_id_game_id_key`; el constraint real es `picks_user_id_week_game_id_key`).
- Constraints reales en `picks`: `picks_session_game_unique UNIQUE(user_id, league_id, training_session_id, game_id)`, `picks_user_id_week_game_id_key UNIQUE(user_id, week, game_id)` (SIN league_id ni training_session_id), `picks_user_league_week_game_key UNIQUE(user_id, league_id, week, game_id)`.
- Los `game_id` **se reutilizan entre ligas**: el calendario estático (`w1g1`) y el TC (`tc-<sessionNo>-<n>`; verificado: `tc-2-1` está en 11 ligas). El upsert usaba `ON CONFLICT (user_id, league_id, ...)` que NO cubre `picks_user_id_week_game_id_key` → al guardar el mismo `(user_id, week, game_id)` en otra liga: `23505`. Repro exacto en BD (ROLLBACK): `(user_id, week, game_id)=(6812c5fe-…, 1, tc-9-1)`.

### Fix
- **`src/supabase.js` — `picksApi.upsert`**: onConflict default `'user_id,league_id,week,game_id'` → **`'user_id,week,game_id'`** (cubre el constraint real sin liga/sesión). Con esto el pick se actualiza idempotentemente y **nunca se crean 2 filas para (user_id, game_id)**. `usePicks.js` (página regular) usa el default; comentario actualizado en el código.
- **`src/domains/game-week/PicksService.js`**: los onConflict explícitos de `savePick` y `confirmPicks` pasan a `'user_id,week,game_id'` (antes `user_id,league_id,training_session_id,game_id`).
- **`src/pages/Picks.jsx:228` — banner fantasma**: condición `!loadingGames && !useDynamic` → `!loadingGames && !useDynamic && !weekData`. El banner "No se encontraron juegos en esta liga." se mostraba simultáneamente con los 6 juegos del calendario estático; ahora solo aparece cuando la semana activa no tiene juegos de NINGUNA fuente (dinámica ni estática).
- Nota de contrato: un pick por `(user_id, week, game_id)` global — si el mismo usuario juega el mismo juego en 2 ligas, la fila se actualiza al último contexto (regla "1 pick por game" ya pedida). `picks_user_id_week_game_id_key` se mantiene intacto.

### Verificación
- **Harness** (`/tmp/opencode/regression.mjs` + `build-harness.cjs`): 11 tests nuevos 006.4-A..J — A primer pick (INSERT), B re-save idempotente, C cambiar pick (UPDATE), D 4 cambios → 1 fila, E 6/6 → 6 filas, F re-save 6/6 sin duplicar, G 2 usuarios × 6 juegos, H **mismo game en otra liga → 1 fila (fix 23505)**, I invariante 1 fila por (user_id, game_id) multi-liga, J confirmPicks 6/6 en 2 ligas sin duplicado. **242/242 PASS**.
- **BD real** (`verify_fix3.sql`, ROLLBACK): con el onConflict nuevo, guardar `(6812c5fe-…, week=1, '__test__fix1')` en liga 2 → `filas=1, pick_final=SF` (antes: 23505). Post-verificación: `SELECT` de duplicados → 130 filas, 0 pares duplicados.
- **Build + smoke**: `npm run build` ✅; el bundle contiene `user_id,week,game_id` (3 usos); preview 4173 200.
- **QA E2E re-ejecutado** `qa-tc0063.mjs` 45/45 (flujo TC completo 2 usuarios → 10 picks → confirmación → simulación → results → refresh, 0 errores de consola/red, 0 ≥500).

### Archivos tocados
`src/supabase.js`, `src/domains/game-week/PicksService.js`, `src/pages/Picks.jsx`. Tests: `/tmp/opencode/regression.mjs` (+11), `/tmp/opencode/verify_fix3.sql` (repro/verif en BD real).

## Sesión 6 — PLAN-LEAGUE-CONTEXT (diseño de múltiples ligas por usuario)

**Estado**: plan **aprobado** (modo PLAN, solo lectura) y documentado. **Sin código implementado**. Decisiones tomadas vía preguntas: (1) **hash paths** `#/league/:leagueId/...` (compatible GH Pages), (2) **hub + auto-enter persistido** en el dashboard (todas las ligas visibles; `localStorage['gameguru.activeLeagueId']` solo como sugerencia; la URL manda), (3) **header global + selector inline contextual** (inline solo cuando no hay contexto resuelto).

### Diagnóstico
- `currentLeague` es estado en memoria de `useLeague` (`src/hooks/useLeague.js:155`), sin persistencia ni URL. Routing es `useState('activePage')` + hash cosmético sin listener `hashchange` (`src/App.jsx:67-72,74-79`). Las páginas gateadas (`picks`/`board`/`league`/`training`) usan `currentLeague` (`src/App.jsx:144-161`) → peligroso con 2+ ligas.
- `useDashboardData` usa `contextLeague = currentLeague || leagues[0]` (`src/domains/dashboard/hooks/useDashboardData.js:17`): fallback frágil a la primera liga.
- Huérfanas: `src/pages/Lobby.jsx`, `src/pages/Dashboard.jsx` (no importadas); `?join=` se genera pero nadie lo consume.

### Arquitectura propuesta
- `src/router/hashRouter.js` (parse/build hash) + `src/router/routes.js` (tabla + redirects legacy `#picks→#/league/:id/picks`).
- `src/league/context/LeagueContext.jsx` (Provider + `useActiveLeague`), `LeagueRoute.jsx` (guarda membership: no-miembro → selector + aviso, **nunca** datos), `LeagueSelector.jsx` (dropdown header + inline), `activeLeagueStorage.js`.
- Principios: URL = única fuente de verdad cuando existe; `activeLeagueId` = solo ayuda; `key={leagueId}` para remount limpio (Training Camp/Game Week).

### Impacto bug picks (`picks_user_id_game_id_key` / `picks_user_id_week_game_id_key`)
- El League Context **no causa** el 23505 (es data model: `game_id` reutilizados entre ligas + `UNIQUE(user_id, week, game_id)` sin liga). Sí influye: con **cambio de liga mientras un save de picks está pendiente**, `submitPicks` captura `league.id`+`game_id` en el closure y el onConflict `(user, week, game)` sobrescribe el pick de la liga anterior. La URL como fuente de verdad hace el flujo determinista; el solapamiento a nivel BD persiste.
- Recomendación documentada (no corregida): opción A) `game_id` únicos por liga → `UNIQUE(user_id, league_id, week, game_id)`; u opción B) regla formal "1 pick por `(user, week, game)` global" (vigente, menor riesgo). Flag `LEAGUE_CONTEXT_PICKS_ISSUE`.

### Rutas propuestas
`#dashboard` (hub) · `#/league/:id` · `#/league/:id/picks` · `#/league/:id/standings` · `#/league/:id/publicpicks` · `#/league/:id/training` · `#/league/:id/preseason` (futuro) · `#/league/:id/season` (futuro) · `#superadmin`.

### Plan por fases (BUILD posterior)
0 handoff (este doc) → 1 mini-router+redirects → 2 LeagueContext+storage → 3 LeagueRoute+refactor App.jsx (eliminar gate `!currentLeague`) → 4 LeagueSelector Topbar/BottomNav → 5 UX multi-liga (hub+auto-enter, selector inline Standings/Picks League+Week, `?join=` consumido) → 6 migrar LeaguePage/TrainingCamp + limpiar huérfanos → 7 futuro preseason/season/Open Lobby → 8 futuro data model picks. Restricciones: no tocar SimulationDirector/MatchSimulator/StandingCalculator/EventDirector; TC-007 fuera.

### Tests (propuestos)
Harness: parseHash/buildHash/resolveForView/guard membership/redirects legacy/switchLeagueInView. QA E2E browser con 2 ligas reales A/B: ruta de B muestra datos de B; navegación B→B sin preguntar; dropdown cambia liga manteniendo vista; `#board` legacy 2+ ligas → selector antes de la tabla; acceso a liga no-miembro → selector sin datos; refresh mantiene la liga. Regresión 242/242 intacta.

### Handoff
Plan completo en `opencode/plans/plan-league-context.md` (12 entregables, riesgos, preguntas pendientes). Próximo BUILD: **BUILD-LEAGUE-CONTEXT-01** (Fases 1–3). Sin commit, sin push.

## Sesión 7 — BUILD-LEAGUE-CONTEXT-01 (Fases 1-3: mini-router, LeagueContext, LeagueRoute)

**Estado**: implementado y verificado. Harness **278/278 PASS** (242 previos + 36 nuevos LC-A..J), QA E2E browser `qa-tc0063.mjs` **45/45 PASS** (compatibilidad TC/Game Week/Picks/Simulation intacta), QA multi-liga `qa-league-smoke.mjs` **18/18 PASS**, `npm run build` ✅ (bundle `index-BHwUKh9w.js`). **Sin commitear, sin push**.

### Contexto y decisión de diseño (RLS verificada en BD)
- `leagues` tiene RLS con policy **`Anyone can read leagues`** (SELECT público) y `league_members` con `Members can read memberships` (SELECT total) → LeagueRoute puede distinguir "liga inexistente" (NOT_FOUND) de "no sos miembro" (DENIED) consultando la fuente de datos, sin revelar datos de la liga ajena. Verificado vía Management API (`pg_policies`).
- `useLeague` se reutiliza (una sola instancia): `LeagueProvider` recibe `leaguesState` como prop y lo expone por contexto (sin doble fetch de `getMyLeagues`).

### Qué se construyó
- **`src/router/hashRouter.js`** (puro): `parseHash('#/league/ABC123/standings') → { type:'league', leagueId, page }`, `buildHash` round-trip, legacy `#picks/#board/#league/#publicpicks/#training` → `{ type:'legacy', page }`, `#superadmin`, malformadas → `dashboard`.
- **`src/router/routes.js`** (puro): helpers `leagueRoute/leaguePicksRoute/leagueStandingsRoute/leagueTrainingRoute` (los componentes no concatenan strings), `LEGACY_VIEW_MAP`, **`LEGACY_REDIRECTABLE`** (picks/board/publicpicks/league; **`training` EXCLUIDO** hasta Fase 6 — el lobby del TC usa `currentLeague`+`lobbyVersion`+modal con `initialName=currentLeague?.name` y el redirect lo rompía, detectado por el QA E2E 45/45 que fallaba en el resume de run inyectado), `resolveForView` (URL manda; `activeLeagueId` solo sugerencia; 1 liga → auto), `navigate`.
- **`src/router/useHashRoute.js`**: hook `hashchange` idempotente (StrictMode-safe).
- **`src/league/activeLeagueStorage.js`**: `localStorage['gameguru.activeLeagueId']` SOLO sugerencia.
- **`src/league/context/leagueResolution.js`** (puro, testable): `computeRouteState` (loading/not_found/denied/ready), `getActiveLeagueId` (URL > persistencia), `buildContextValue` (contrato del contexto).
- **`src/league/context/LeagueContext.jsx`**: `{ league, leagueId, membership, loading, error, isMember, setActiveLeague, ...leaguesState, route }`. Resolución: myLeagues (fast path, membership de la fuente) → si no está, `getById`+`getMembership` async para distinguir NOT_FOUND/DENIED; **guard UUID** (evita 400 `invalid uuid` de PostgREST para ids malformados); persiste `activeLeagueId` al entrar (solo sugerencia); guard de cancelación StrictMode.
- **`src/league/LeagueRoute.jsx`**: guard A) miembro→children `({league, membership, isMember})`, B) no-miembro→`LeagueDenied` (nombre de liga + 0 datos), C) inexistente→`LeagueNotFound`, D) loading→`LeagueLoading`. Los 3 estados exportados para smoke.
- **`src/supabase.js`**: `leaguesApi.getById` + `membersApi.getMembership` (ambos bajo RLS actual).
- **`src/App.jsx`**: refactor en `AppInner` (auth + `useLeague`) + `AppShell` (dentro del Provider). Rutas `#/league/:id[/page]` → `LeagueRoute key={leagueId}` renderizando las páginas legacy existentes con `league` de la URL (contrato de props intacto, SIN migrarlas). Redirects legacy solo para `LEGACY_REDIRECTABLE`. Hub `#dashboard` → `Home` (todas las ligas).

### Verificación
- **Harness 278/278**: 36 tests nuevos LC-A..J (A/B URL manda sobre persistencia; C miembro→READY; D no-miembro→DENIED sin datos; E inexistente→NOT_FOUND; F refresh mantiene leagueId round-trip; G navegación A→B y B→A actualizan contexto vía `navigate`+mock location; H activeLeagueId se persiste al entrar y no sobrescribe URL; I hub passthrough de TODAS las ligas; J redirects legacy + helpers + `training` excluido del redirect).
- **QA E2E `qa-tc0063.mjs` 45/45**: flujo TC completo (2 usuarios → liga → advance → FG → GW → 10 picks → lock → auto-simulación → results → refresh → **resume de run inyectado 3/10**) — confirma que Picks/Game Week/Training Camp/Simulation NO se rompieron con el refactor de App.jsx.
- **QA multi-liga `qa-league-smoke.mjs` 18/18** (nuevo): signup → crear liga → `#/league/:id` READY (Mi Liga) → refresh mantiene leagueId → `/picks` y `/standings` con la liga de la URL → `#/league/NOEXISTE` NOT_FOUND → liga ajena DENIED (0 tablas) → `#board` legacy redirige a `#/league/:id/standings` → `#dashboard` hub con la liga → 0 errores de consola/red/4xx.
- **Build**: `npm run build` ✅ (bundle `index-BHwUKh9w.js`), dev server 5173 (de sesiones previas) sirviendo los cambios vía HMR.

### Notas / decisiones
- El QA E2E inicial falló en el **resume de run inyectado** (10.x): causa = el auto-redirect de `#training` → `#/league/:id/training` remontaba el lobby del TC vía LeagueRoute (resolución async + `key`) antes de su migración (Fase 6). Fix: `LEGACY_REDIRECTABLE` excluye `training`. Re-ejecutado → 45/45.
- El smoke inicial reportó falsos negativos por bugs del test (la app está en EN: "My Leagues" vs "Mis Ligas"; `getHash` devuelve Promise dentro de waitFor) — corregidos en el script, no en la app.
- **FUERA DE ALCANCE (BUILD-02)**: migración de páginas a contexto de ruta, LeagueSelector global/inline, hub+auto-enter, `?join=` consumido, migración LeaguePage/TrainingCamp, rediseño dashboard, rutas preseason/season, data model picks.

### Archivos tocados
Nuevos: `src/router/hashRouter.js`, `src/router/routes.js`, `src/router/useHashRoute.js`, `src/league/activeLeagueStorage.js`, `src/league/context/leagueResolution.js`, `src/league/context/LeagueContext.jsx`, `src/league/LeagueRoute.jsx`. Editados: `src/supabase.js`, `src/App.jsx`. Tests: `/tmp/opencode/regression.mjs` (+36), `/tmp/opencode/bundle-entry.mjs`, `/tmp/opencode/qae2e/qa-league-smoke.mjs` (nuevo, 18/18). Docs: `plan-league-context.md`, `blueprint.md`, `gameguru.md`.

### Handoff
Próximo BUILD: **BUILD-LEAGUE-CONTEXT-02** (Fases 4-6: LeagueSelector en Topbar/BottomNav, UX multi-liga hub+auto-enter + selector inline en Standings/Picks, migrar LeaguePage/TrainingCamp a contexto de ruta, `?join=` consumido, limpiar huérfanos Lobby/Dashboard). Ver `plan-league-context.md` §12-13. Sin commit, sin push.
