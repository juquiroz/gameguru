# gameguru — Resumen diario 2026-08-05 (Mié)

Rama: master. Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb`. Tooling: node v20.20.2, vite 5.4.21 (sin `rg`/`gh`/Docker; usar Grep/Read/Glob).
Contexto previo: ver `opencode/plans/gameguru-day-2026-08-04.md` (PLAN-005 diseño + BUILD-TC-001 Lobby + TC-002 Entrada oficial + TC-003 Event Director, build 154 módulos, nada commiteado).

## Qué se hizo hoy (BUILD-TC-004 — Fixture Generation Event)

### BUILD-TC-004.2 — Estabilización (misma jornada)
- **Migración ejecutada**: `supabase/005.1-training-sessions.sql` aplicada por el usuario en el SQL Editor (tabla creada + índices). Verificado vía REST con anon key:
  - `GET /rest/v1/training_sessions?select=*&limit=1` → **200** `[]` (antes PGRST205).
  - Round-trip en liga real `8a524b4f-…` (`DXPD4D`): INSERT **201** con defaults (`event_type`/`state`), PATCH a estado FG `generating_fixtures` + `fixture_progress` JSONB **204**, READ back OK, DELETE **204**.
  - FK `league_id → leagues` verificada (409 correcto con id inexistente).
- **Hardening defensivo** (pantallas negras / estado vacío):
  - `states.js`: `getTrainingState`/`getDerivedPhase` nunca lanzan ni devuelven `undefined` ante `event` nulo/no-objeto, `start_at` o `now` inválidos; nuevo vocabulario `FIXTURE_GENERATION_STATES` (`waiting/generating_fixtures/saving_matches/completed`) para que `isValidTrainingState` no coaccione estados FG a `created` (exportado vía `training/index.js`).
  - `useTrainingSession`: `load` con `Promise.allSettled` + `try/finally` (nunca se queda en `loading`); `applyPatch` no tira la UI si falla la persistencia (conserva el optimista); logs descriptivos en spawn/generación/carga.
  - `TrainingCampLobby`: **estado vacío explícito** cuando no hay sesión (sin excepciones, admin con CTA "Configurar el primer evento", invitación/código siguen visibles).
  - `trainingSessionService`: `logFallback(op, err)` + logs descriptivos por operación (nube → localStorage).
  - CSS `training.module.css`: `.emptyState/.emptyHint/.sectionEmpty`; i18n es/en `empty*`.
- **Verificación**: harness node 18/18 ✅ (`/tmp/opencode/tc0042-verify.mjs`, cobertura null/bad-input/FG); regresión TC-004 27/27 ✅; `npm run build` ✅ 158 módulos; smoke dev server sin errores de consola.

### Alcance entregado
El **Fixture Generator** se convierte en un **evento** con director propio y motor desacoplado de React. Al **finalizar la sesión de Training Camp** (estado `finished`) el hook crea la sesión `fixture_generation`; el Lobby la muestra con las mismas tarjetas (Header/Status) más un nuevo **Progress** (barra generado→guardado). Ningún componente conoce `FixtureGenerationDirector`.

- **Dominio `src/domains/event/`**:
  - `EventDirector.js`: + `EVENT_TYPES` (`training_camp`/`fixture_generation`), + acciones `START_GENERATION`/`GENERATION_PROGRESS`/`SAVE_COMPLETE`/`COMPLETE_EVENT`, + `type`/`getEventType()`.
  - `FixtureGenerationDirector.js` (nuevo): 4 pasos `waiting → generating_fixtures → saving_matches → completed` (+ `cancelled` virtual); dispatch puro con `fixture_progress {generated, saved, total}`.
  - `services/fixtureCalendar.js` (nuevo, puro): RNG `mulberry32` con seed + rondas **round-robin** (método de la circunferencia: 31×16=496 pareos únicos); ≤16 partidos cubren los 32 equipos una vez, 17–20 doble jornada.
  - `services/FixtureGeneratorService.js` (nuevo, sin React): genera calendario + limpia `tc-<sessionNo>-*` previos (idempotencia) + persiste en `league_games` (`master_game_id: null`, `season 'Sim'`, `week 1`) + `onProgress`.
- **`useTrainingSession`**: elige el director por `event.event_type` (contrato EventDirector); orquesta la transición TC→FG (guard `ref` contra StrictMode) y la generación (guard `ref` contra dobles corridas/ticks).
- **`trainingSessionService`**: `event_type` en `create`, nuevo `createFixtureEvent` (sesión FG con `session_no` auto → pasa a ser la "más reciente"), `normalize` ya no coacciona estados FG a estados TC.
- **UI genérica**: `TrainingCampStatus` (timeline por `steps`, sin `TRAINING_STATES_LIST`, personas FG), `TrainingCampHeader` (tag/badge FG), `TrainingCampLobby` (Progress para FG + acciones admin TC gated), `TrainingCampProgress.jsx` (nuevo, barra).
- **i18n es/en**: keys `fixture*` (pasos, tag, badge, progreso) + personas FG; `readySub`/`engineNote` actualizados (generación al finalizar la sesión).
- **SQL** `supabase/005.1-training-sessions.sql`: columna `event_type` (+ CHECK), estados FG en el CHECK de `state`, CHECK `event_type`. **No ejecutado**.

### Decisiones
- `.js` en lugar de `.ts` para el director (el prompt pedía `.ts`, pero el proyecto es 100% JS — Vite 5 sin toolchain TS); documentado en el header del director.
- Disparo al **finalizar el TC** (instrucción del usuario de este BUILD; el plan original decía `training_started` — anotado en training-camp §8.4). Flujo "preparado": hoy el TC solo llega a `training_started`, así que el evento se activa al terminar la sesión.
- La generación crea una **nueva sesión** (FG) que, por ser la más reciente, el Lobby pinta sin cambios. En localStorage reemplaza el registro de la sesión TC.

## Datos/estado
- Verificación node (bundle esbuild): **27 checks ✅** — transiciones del director, `currentStep`/`lastCompletedStep` (incl. `cancelled` virtual), idempotencia, determinismo de seed, 16→32 equipos una vez, 20 sin duplicar pareos, `game_time` +2min.
- `npm run build` ✅ **158 módulos** (+4 vs TC-003: director, service, calendar, progress).
- Smoke test ✅ dev server + headless chrome sin errores de consola.
- Dev server local del usuario: `http://localhost:5173/gameguru/`.

## PLAN-TC-005 — Game Week & Picks (diseño aprobado 2026-08-05, sin implementar)

Tras TC-004.2 (migración aplicada + hardening), se diseñó el flujo para **jugar la jornada inmediatamente después de Fixture Generation**. Detalle completo en `training-camp.md` §8.5.

- **Flujo**: FG `completed` → evento `game_week` (Jornada activa) → grid de partidos → selección + pendientes (x/y) → confirmación (sheet) → `pick_submissions` + `SUBMIT_PICKS` → `picks_locked` (deadline `start_at + N` **o** todos confirmaron **o** lock admin) → (TC-006) Simulation Engine.
- **Decisiones del usuario (todas recomendaciones aceptadas)**: (1) Game Week = **tercer evento** `game_week` (1 evento = 1 director, patrón TC→FG); (2) bloqueo por **deadline + todos confirmaron + admin**; (3) **ventana de picks por nivel** (Express 5'/Standard 10'/Advanced 15'/Custom editable, extiende `resolveConfig`); (4) **schema completo** `005.2-game-week.sql`: `game_weeks` (WeekState `pending→picks_open→picks_locked→games_in_progress→simulation_running→completed`) + `pick_submissions` (`UNIQUE (game_week_id, user_id)`, `pick_count`, `submitted_at`) + `training_session_id` nullable en `league_games` y `picks` (elimina el parseo `tc-<n>-*`) + CHECK `event_type 'game_week'`.
- **Arquitectura**: `GameWeekDirector` (3er director, `EVENT_ACTIONS` + `SUBMIT_PICKS`/`LOCK_PICKS`/`SIMULATION_START`/`SIMULATION_PROGRESS`/`COMPLETE_EVENT`) + `picksService` (sin React) + `useGameWeekPicks` (expone `WeekState`/`PickStatus` `open→draft→submitted→scored`). `useTrainingSession` gana la rama `game_week` + spawn FG→GW (guard `ref`). UI: `GameWeekView` reusa `GameCard`; deadline TC = `start_at + N` (no `getWeekDeadline`).
- **Frontera**: TC-005 llega hasta `picks_locked` (placeholder "Esperando simulación"); TC-006 implementa `SimulationService→SimulationEngine→RandomGenerator`, resultados vía `leagueGamesApi.setScores`, leaderboard/picks públicos en vivo (exención PRIVACY-001) y `finished`.
- **Backlog TC-005**: SQL 005.2 → `GameWeekDirector` → `picksService`/`useGameWeekPicks` → `FixtureGeneratorService` setea `training_session_id` → spawn en hook → `GameWeekView` + i18n → `resolveConfig` (ventana) → harness node + build + smoke + docs.
- Docs actualizadas: `training-camp.md` (§8.5 TC-005 + §8.6 TC-006 + tabla roadmap), `blueprint.md`, `gameguru.md`. Sin código de dominio ni commit.

## BUILD-TC-005 — Game Week & Picks (implementado 2026-08-05, sin commitear)

Se implementó el diseño §8.5 de la misma jornada (ver `training-camp.md` §8.5.1 para el alcance completo y desviaciones documentadas).

- **Migración `supabase/005.2-game-week.sql`** (idempotente, RLS permisiva): `game_weeks` (WeekState `pending/waiting/picks_open/picks_locked/games_in_progress/simulation_running/completed/cancelled`, `UNIQUE(training_session_id, week)`) + `pick_submissions` (`UNIQUE(game_week_id, user_id)`, `pick_count`, `submitted_at`) + `league_games.training_session_id` + `picks.training_session_id`/`submitted_at` + CHECK `event_type 'game_week'` + `training_sessions.picks_deadline_at`. **Pendiente de ejecutar en el SQL Editor** (hasta entonces el flujo usa localStorage).
- **Dominio `src/domains/game-week/`**: `GameWeekDirector` (puro; steps `waiting→picks_open→picks_locked→completed` + `cancelled`; `OPEN_WEEK`/`LOCK_PICKS` con `reason`/`OPEN_NEXT_WEEK`/`COMPLETE_EVENT`/`CANCEL`/`TICK`), `GameWeekService` (openWeek idempotente con deadline = apertura + ventana del nivel, lockWeek, openNextWeek 1:N-ready, getActiveWeek/listWeeks; fallback localStorage `gameguru.gw.<sessionId>`), `PicksService` (savePick/updatePick/confirmPicks con `pick_submissions` + `allSubmitted`, validateComplete, **getConfirmedPicks = punto de integración TC-006**; `PickStatus open/draft/submitted`), `GameWeekContext`/`useGameWeek` (único puente React), `GameWeekView` + `game-week.module.css` (grid con `GameCard`, contador x/y, banner ventana + countdown, confirmación, estados; i18n `gameWeek.*` es/en).
- **Integración**: `EventDirector` + `EVENT_TYPES.GAME_WEEK` + acciones; `supabase.js` con `picksApi.getForSession/getAllForSession/upsert({onConflict})` + `gameWeeksApi` + `pickSubmissionsApi`; `trainingSessionService.createGameWeekEvent` (+ `createFixtureEvent` propaga `level`); `useTrainingSession` (rama `game_week` en `directorFor`, spawn FG→GW, apertura de jornada, `applyPatch` expuesto); `TrainingCampLobby` conmuta a `GameWeekProvider`+`GameWeekView`; `FixtureGeneratorService` setea `training_session_id`; `resolveConfig` + `pickWindowMinutes` (5/10/15/editable).
- **Verificación**: harness node `tc005-verify.mjs` (esbuild + mock de supabase) **57 checks ✅** (director: transiciones/reasons/TICK/idempotencia/cancelled virtual; service: openWeek idempotente + deadline por nivel + degradación local; picks: ventana cerrada → error, confirm incompleto → missing, allSubmitted, getConfirmedPicks; resolveConfig 5/10/15/editable). Regresión TC-004 (24) y TC-004.2 (18) ✅. `npm run build` ✅ 165 módulos; smoke headless Chrome sin errores.

## Pendiente
1. **Ejecutar `supabase/005.2-game-week.sql` en el SQL Editor** (bloqueante del modo nube del TC-005) → verificación REST/round-trip (mismo procedimiento que TC-004.2 con 005.1) + smoke del flujo completo FG → jornada → picks → confirmación → bloqueo.
2. **Verificación manual BUILD-TC-001→005**: crear TC → picker → intro → config → confirmación → lobby → comenzar → cancelar y el flujo: **finalizar sesión → `fixture_generation` con progreso → `completed` → `game_week`: jornada → picks → confirmación → bloqueo**; desktop + móvil; **capturas** (postergadas por decisión del usuario). Requiere sesión iniciada.
3. ~~Ejecutar `supabase/005.1-training-sessions.sql`~~ → **HECHO en TC-004.2**. Queda verificación manual del flujo completo con sesión iniciada.
4. Ejecutar backfill `supabase/004.1-season-system.sql` (de día 03) y verificar PLAN-004.1.
5. Verificar PRIVACY-001 (sim con admin), PLAN-003 (ScoreEditor) y escenarios BUILD-002.1.
6. Decidir commit (BUILD-001/002/002.1 + PRIVACY-001 + nav + PLAN-003 + BUILD-004.1 + PLAN-005 docs + BUILD-TC-001 + TC-002 + TC-003 + TC-004 + TC-004.2 + TC-005) y deploy.
7. Siguiente BUILD: **TC-006 (Simulation Engine)** → TC-007 (Resultados/UX live) → TC-008 (Graduación) → TC-009 (Edge/realtime + fixtures manuales).
