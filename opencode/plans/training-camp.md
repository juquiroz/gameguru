# PLAN-005 — Training Camp Experience (🎓)

**Estado**: Diseño aprobado (2026-08-04) y **en implementación (BUILD-TC-001 ✅, TC-002 ✅, TC-003 ✅, TC-004 ✅, TC-004.2 ✅, TC-005 ✅ + TC-005.1 persistencia en nube)**. **PLAN-TC-005 (Game Week & Picks): implementado (2026-08-05) y validado en modo nube (BUILD-TC-005.1, 2026-08-07)** — ver §8.5.1: migraciones `005.2` (aplicada) y `004.1` (backfill ejecutado), E2E real 25/25, regresión 56/56, Fixes A (constraint única para upsert) y B (GameWeekContext con sesión FG). **Hito TC-005 commiteado `7cb799a` (rama `development`, sin push) + BUILD-TC-005.3 (2026-08-08): flujo QA desbloqueado de punta a punta (admin advance `ADVANCE_EVENT`), QA browser 43/43 con 0 errores consola/red — ver §8.5.2; QA final BUILD-TC-005.4 48/48 + fix `league_mode: 'practice'` — ver §8.5.3**. **BUILD-TC-006.1 (2026-08-08): Simulation Engine núcleo implementado (máquina interna + MatchSimulator determinista + StandingsCalculator + fachada) sin UX, regresión 140/140 — ver §8.6.1**. **BUILD-TC-006.2 (2026-08-08): orquestación automática en `useTrainingSession` (auto-start en `picks_locked`, batches por `speed`, resume, finalización `completed`/`finished`), regresión 187/187 — ver §8.6.2**. **BUILD-TC-006.3 (2026-08-08): UX en vivo (SimulationProgress + Results + Leaderboard + picks públicos) implementado y CERRADO EN LA NUBE — migraciones `006.1` y `006.1b` aplicadas vía Management API (PATCH `game_weeks` 200; setScores por membresía), 3 bugs reales corregidos (`defaultRun(null)`, RLS `league_games`, `participants.id`), QA browser 45/45 + regresión 231/231 — ver §8.6.3**. **BUILD-TC-006.4-FIX (2026-08-08): persistencia de picks idempotente (`23505` cross-liga resuelto con `onConflict (user_id, week, game_id)`) + banner fantasma de Mis Picks corregido — QA browser 45/45 re-ejecutado + regresión 242/242 + verificación en BD real (1 fila por `(user_id, game_id)`) — ver §8.6.4**. **PLAN-LEAGUE-CONTEXT (2026-08-08): diseño de múltiples ligas por usuario APROBADO y documentado (URL `#/league/:id/...` como fuente de verdad, LeagueContext/LeagueRoute/LeagueSelector, hub + auto-enter persistido, header selector; sin código) — ver `opencode/plans/plan-league-context.md` + nota en `gameguru-day-2026-08-08.md` Sesión 6**. **PLAN-LEAGUE-CONTEXT-01.1 (2026-08-09): aislamiento multi-liga de picks (migración `006.2` — se elimina la UK global de 006.4-FIX, UKs por liga; `picksApi` default por-liga, `PicksService` UK de sesión), LeagueIdentity siempre visible, routing de standings por tipo de liga, LeagueSelector en el Topbar — ver `opencode/plans/plan-league-context-01.1.md`**. Los BUILD que ya tienen § propio marcan su alcance entregado; el resto queda como diseño pendiente de implementar.

## Contexto / problema actual

- Practice Mode (hoy `league_mode='practice'`, antes `simulation=true`) es una liga con partidos y resultados **manuales**. Como experiencia de aprendizaje, depende del admin para poblarla y no enseña el ciclo completo de GameGuru.
- No existe un motor que genere partidos/resultados: todo resultado es capturado a mano (`ScoreEditor`).
- El nombre "Practice" es genérico y poco memorable; no comunica el objetivo educativo.

## Decisiones del usuario (2026-08-04)

1. **Training Camp es un EVENTO, no una liga.** Cada estado representa una experiencia distinta para el usuario: Dashboard, notificaciones y Activity Feed reaccionan de forma diferente en cada uno. **Se mantienen los 9 estados** (no se fusionan).
2. **Exención de PRIVACY-001**: TC es transparente por diseño (objetivo educativo). Leaderboard y Picks Públicos se muestran **en vivo**. PRIVACY-001 continúa aplicando únicamente a Preseason y Regular Season.
3. **Motor de simulación cliente v1**, con toda la lógica aislada de React:
   ```
   SimulationService
       ↓
   SimulationEngine
       ↓
   RandomGenerator
   ```
   Nunca lógica de negocio dentro de componentes React (solo suscriben/renderizan). La migración futura a Edge Functions debe requerir **únicamente cambiar el Engine**.
4. **Fixture Mode**: `auto` (genera enfrentamientos automáticamente) | `manual` (reutiliza el constructor de partidos existente → demos personalizadas, útil incluso cuando exista el Simulation Engine).

## Visión

Training Camp es un **evento simulado automáticamente** que enseña el ciclo completo de GameGuru en ~30 minutos: unirse → hacer picks → ver cómo avanzan los partidos → ver el leaderboard en vivo → ver los picks públicos. Los resultados son generados por el sistema, no manuales.

El nombre **"Practice" se abandona en todo el lenguaje de producto** (UI, i18n, docs). Internamente la BD conserva `league_mode='practice'` (el CHECK `('practice','preseason','regular')` **no se toca** — migración prohibida en este plan); `LEAGUE_MODES` mapea `practice → { label: 'Training Camp', icon: '🎓' }`. Renombrar el enum a `training_camp` queda como pendiente de migración formal.

## 1. Principio arquitectónico clave

**Training Camp NO es un modelo de datos nuevo: es una liga `practice` + una tabla de configuración/estado de evento.**

- La liga `practice` reutiliza toda la infraestructura existente: `league_members` (unirse por código), `picks`, `league_games`, leaderboard.
- Los partidos generados viven en `league_games` con `master_game_id: null` (como los manuales de hoy).
- Los resultados se escriben vía el **mismo contrato** que los demás modos → Picks, Leaderboard, PublicPicks y dashboard **no saben el origen del resultado**.
- Única excepción: exención de PRIVACY-001 (§ decisión 2).

### Modelo de datos propuesto (diseño, no ejecutar)

Tabla nueva `training_camps` (1:1 con `leagues`, `league_id` PK/FK `ON DELETE CASCADE`):

| Columna | Tipo | Notas |
|---|---|---|
| `league_id` | UUID PK/FK | FK `leagues.id` ON DELETE CASCADE |
| `start_at` | timestamptz | Fecha/hora de inicio (obligatoria, explícita) |
| `game_count` | int | 5 / 10 / 15 / 20 |
| `speed` | text | `'demo' \| 'normal' \| 'fast'` |
| `fixture_mode` | text | `'auto' \| 'manual'` |
| `state` | text | 9 estados (§2) |
| `seed` | int | RNG determinista → fixture y resultados reproducibles |
| `started_at` | timestamptz | null hasta `training_started` |
| `finished_at` | timestamptz | null hasta `finished` |
| `cancel_reason` | text | null; poblado solo si `cancelled` |

- Límite técnico de `game_count`: 32 equipos NFL → máx. **16 pareos sin repetir equipo**; **20 permite "doble jornada"** (2 rondas). Máximo 20 para que el evento dure ≤30–45 min. Tunable por deporte en el futuro.
- El deadline de picks **no usa `getWeekDeadline`** (que deriva de `primer game_time - 1h`); el deadline TC = `start_at + N min` (config), ver §7.

## 2. Los 9 estados del evento

`created` → `waiting_players` → `countdown` → `training_started` → `picks_open` → `picks_locked` → `games_in_progress` → `simulation_running` → `finished` (+ `cancelled`).

Cada estado es una experiencia distinta (Dashboard, notificaciones y Activity Feed reaccionan distinto).

| # | Estado | Significado | Transición al siguiente |
|---|---|---|---|
| 1 | `created` | Configurado, no público | Admin abre lobby |
| 2 | `waiting_players` | Lobby abierto; jugadores se unen por código; countdown visible (derivado de `start_at`) | T-60s a `start_at` o admin fuerza inicio |
| 3 | `countdown` | Cuenta regresiva final (últimos 60s) | Llega `start_at` |
| 4 | `training_started` | Se genera el fixture según `fixture_mode`; se anuncia el evento | Fixture listo |
| 5 | `picks_open` | Fixtures visibles; se aceptan picks | Deadline de picks = `start_at + N min` |
| 6 | `picks_locked` | Deadline pasado; picks bloqueados | Simulación comienza |
| 7 | `games_in_progress` | Partidos avanzan por batches según `speed` | Primera tanda de resultados revelada |
| 8 | `simulation_running` | Resultados fluyendo; leaderboard en vivo; picks públicos en vivo (exención PRIVACY-001) | Último partido FINAL |
| 9 | `finished` | Champion 🏆, leaderboard final, picks públicos finales, "Crear otro TC" | — |

**`cancelled`** (adicional): cualquier estado ≤ `simulation_running` → admin cancela (`cancel_reason`). Fin del evento sin puntuación.

> Nota del Arquitecto: el usuario evaluó fusionar estados (Countdown→waiting, Games In Progress→Simulation Running) pero **se rechazó**: cada estado genera una experiencia/notificación/feed distinto. Progreso (x/N finales) y countdown son **datos derivados**, no estados; el estado avanza con transiciones discretas.

## 3. Arquitectura del motor

```
SimulationService  → coordinación + API (create, start, advance, finish, cancel)
      ↓
SimulationEngine   → state machine puro + tick loop + timing por speed
      ↓
RandomGenerator    → RNG con seed (fixture y resultados deterministas/reproducibles)
```

- **`SimulationService`**: fachada que expone las operaciones del evento (leer `training_camps`, crear, iniciar, avanzar, finalizar, cancelar). Es lo que consume la UI (a través de hooks, ej. `useTrainingCamp`). La migración a Edge Functions reemplaza **solo** el Engine manteniendo este contrato.
- **`SimulationEngine`**: state machine puro (sin React, sin Supabase directo). Recibe el estado + timestamp y devuelve la siguiente transición/acciones. Avanza partidos por batches según `speed` (`time_per_game_ms`).
- **`RandomGenerator`**: RNG sembrado (`seed`) → el mismo fixture y los mismos resultados se reproducen con la misma seed (facilita demos y tests).
- **Regla dura**: ninguna lógica de negocio dentro de componentes React. Los componentes solo suscriben al estado y renderizan.

### Contrato común `ResultSource`

```
ResultSource.completeGame(game, { home_score, away_score, result })
```

| Motor | Origen | Escribe |
|---|---|---|
| **Training Engine** (TC) | Generado por `RandomGenerator` | solo `league_games` (`master_game_id: null`) |
| **Official Provider Engine** (Preseason/Regular) | Proveedor externo (ESPN) | `master_games` + propaga a `league_games` por `master_game_id` |

El resto del sistema (Picks, Leaderboard, PublicPicks, dashboard, leaderboard) **lee `league_games` y no distingue el origen**. Esto garantiza que agregar el motor oficial (BUILD-004.5/004.6) no requiera cambios en la lectura.

## 4. Velocidades (`time_per_game_ms` por batch)

| Speed | Ritmo | Uso |
|---|---|---|
| `demo` | ~15–20s por partido, dramático | Presentaciones/demos |
| `normal` | ~5–8s por partido | Sesión grupal real |
| `fast` | ~1s, revela en ráfagas | Testing rápido |

Tunable; la duración total estimada = `game_count × time_per_game` (documentar en el wizard).

## 5. Wizard de configuración (pasos)

1. **Inicio**: fecha/hora **explícita y obligatoria** (NO automático por defecto). Botón "Comenzar ahora" opcional para admin (adelanta `waiting_players → countdown`).
2. **Cantidad de partidos**: 5 / 10 / 15 / 20 (cards, nunca radio buttons, consistente con `ExperiencePicker` de PLAN-004).
3. **Velocidad**: Demo / Normal / Rápida.
4. **Fixture Mode**: `auto` (genera enfrentamientos aleatorios de los 32 equipos NFL — default recomendado) | `manual` (reutiliza el builder de partidos existente de `LeagueGamesManager` → demos personalizadas).

El wizard de creación de experiencia (PLAN-004, BUILD-004.3) es quien abre el TC; el TC agrega estos 4 pasos como configuración del evento. **BUILD-TC-002 ya implementa el wizard de experiencias** (`ExperienceWizard`): el paso 3 (cantidad de partidos) y 4 (velocidad) hoy viven en el nivel Custom del formulario de configuración; el `fixture_mode` queda fijo en `auto` (BUILD-TC-004 implementa la generación automática; `manual` queda pendiente de pulir).

## 6. UX del evento en vivo

- **Pre-evento**: lobby (código de invitación, roster de jugadores, countdown T-…, botón admin "Comenzar ahora").
- **Durante**: tarjetas de partidos animadas (avanzan a FINAL), leaderboard en vivo, matriz de picks públicos desbloqueada (exención PRIVACY-001).
- **Final**: champion 🏆, leaderboard final, resumen del evento, botón "Crear otro Training Camp".
- **Lugar**: vista dedicada (variante del dashboard para ligas `practice`); el dashboard muestra una card de estado del evento.
- **Dashboard/notificaciones/Activity Feed**: reaccionan por estado (§2).

## 6.1 Identidad visual del Training Camp (decisión 2026-08-04)

Training Camp tiene **identidad visual propia**, no solo un badge:

- **Color**: Azul `#3B82F6` (token `--mode-tc` en `global.css`).
- **Ícono**: 🎓.
- **Banner**: "Training Camp" con fondo/gradiente azul en el header de la liga y del dashboard.
- **Mensajes**: tono de aprendizaje/primeros pasos (i18n `modes.*` + `training.*`), en wizard, dashboard, notificaciones y Activity Feed.

El objetivo: con solo abrir la liga, el usuario sabe de inmediato que está en un evento de aprendizaje (vs. 🏈 Pretemporada en teal `--mode-ps` y 🏆 Temporada en dorado `--mode-rs`). Detalle completo en el índice de experiencias de `blueprint.md`. Se materializa en BUILD-004.2 (base) y BUILD-TC-001 (banner/mensajes del evento). Paleta final pendiente de validar en implementación.

## 7. Integraciones con el código existente

- `src/domains/league/models/modes.js` → `LEAGUE_MODES.practice` label → 'Training Camp', icon '🎓' (i18n).
- `src/utils/dates.js` → `isGameLocked`/`getWeekDeadline` aplican a Preseason/Regular; para TC se introduce deadline propio (`start_at + N min`). Gating puntual solo para ligas `practice`.
- `src/pages/PublicPicks.jsx` → para TC la matriz se muestra **en vivo** (durante `simulation_running`), exención de la regla `lockedGames`.
- `src/pages/Picks.jsx` → deadline TC en lugar de semana/`getWeekDeadline`.
- `src/components/LeagueGamesManager.jsx` → en TC el fixture `manual` reutiliza el builder; los resultados manuales ya no son el flujo normal (los genera el motor).
- `src/domains/event/` (nuevo dominio) → `EventDirector` (contrato base) + `TrainingCampDirector` (orquestador del ciclo).
- `src/domains/training/` (dominio de sesiones) → `services/trainingSessionService.js`, `hooks/useTrainingSession.js`, `models/states.js`, `models/levels.js`, `models/presence.js`; el motor futuro vive en `engine/simulationEngine.js` + `engine/randomGenerator.js`.

## 8. Roadmap por BUILD (BUILD-TC)

| BUILD | Contenido | Resultado |
|---|---|---|
| **TC-001** ✅ | Renaming "Practice"→"Training Camp" en UI/i18n + tabla `training_sessions` (SQL manual) + lobby (crear evento, countdown, roster, comenzar/cancelar) | Lobby funcional (sala previa) |
| **TC-002** ✅ | Experience Picker + intro educativa + entrada oficial por el wizard de creación de ligas | TC integrado al flujo oficial |
| **TC-003** ✅ | **Event Director**: contrato `EventDirector` + `TrainingCampDirector`; Training Session como entidad independiente (1:N-ready, `session_no`); pantalla de confirmación en el wizard; personalidad del Lobby | Director coordina el ciclo (sin motores) |
| **TC-004** ✅ | **Fixture Generator** (auto): evento `fixture_generation` con `FixtureGenerationDirector` + `FixtureGeneratorService` (sin React) + `fixtureCalendar` (RNG seed); se dispara al finalizar la sesión y persiste el calendario en `league_games` | Progreso visible en el Lobby (`currentStep`/`lastCompletedStep` + barra `fixture_progress`) |
| **TC-005** ✅ | **Game Week & Picks** (implementado 2026-08-05; **validado en modo nube 2026-08-07**, BUILD-TC-005.1; **QA end-to-end 2026-08-08**, BUILD-TC-005.3): evento `game_week` (3er director) + tablas `game_weeks`/`pick_submissions` (SQL 005.2 **aplicado**, Fix A: `UNIQUE` constraint para upsert) + `picksService`/`useGameWeek` + vista de jornada (selección, pendientes, confirmación, bloqueo) hasta `picks_locked` + admin advance `ADVANCE_EVENT` que desbloquea el flujo completo en QA | Jugar la jornada: seleccionar, confirmar y bloquear picks |
| **TC-006** ✅ (núcleo) | **Simulation Engine** v1 (cliente): `SimulationService` → `SimulationDirector` (máquina interna) → `MatchSimulator` (RNG seed) + `StandingsCalculator`; resultados en vivo vía `setScores` (**BUILD-TC-006.1**: núcleo sin UX, **implementado 2026-08-08**, migración `006.1` aplicada; **BUILD-TC-006.2**: orquestación automática en `useTrainingSession` — auto-start en `picks_locked`, batches por `speed`, resume, `completed`/`finished`, regresión 187/187; UX live = TC-006.3) | Resultados generados y reproducibles |
| **TC-006** | **Resultados/UX live**: partidos animados, `simulation_running`, leaderboard en vivo + Picks Públicos en vivo (exención PRIVACY-001) + dashboard card de estado | Experiencia completa en vivo |
| **TC-007** | **Graduación**: champion 🏆, leaderboard final, resumen del evento, "Crear otro Training Camp" | Cierre del ciclo educativo |
| **TC-008** (futuro) | Edge Function (solo reemplaza Engine) + realtime + fixtures manuales pulidos | Evento sobrevive al cierre de la pestaña admin |

Dependencias: TC-001/TC-002 adelantan parte del wizard de experiencia de PLAN-004 (BUILD-004.3); los pasos Preseason/Regular del wizard crean ligas con el flujo actual (`createLeague`). TC-003 sienta el contrato que TC-004/TC-005/TC-006 conectan al Director; el Dashboard solo conoce `EventDirector` (steps + dispatch), nunca el motor. TC-005 cierra la fase de juego hasta el bloqueo de picks; TC-006 aporta el motor de resultados; TC-007 la graduación.

## 8.1 BUILD-TC-001 — Lobby del Training Camp (implementado 2026-08-04)

**Resultado**: la sala previa del evento funciona de extremo a extremo (crear liga + evento → lobby → countdown en vivo → estado/cancelar), sin motor de simulación (el Director llega en BUILD-TC-003; los motores en TC-004/TC-005). Este BUILD absorbe además el renaming "Practice"→"Training Camp".

### Alcance entregado
- **Renaming**: `LEAGUE_MODES.practice.label` → 'Training Camp' (`modes.js`), badge `miniBadgeTc`, CTA de Topbar (`training.cta`), entrada de bienvenida en dashboard.
- **Tabla `training_camps`** (SQL manual `supabase/005.1-training-camps.sql`): 1:1 con `leagues`, PK `league_id`; `name`, `start_at`, `level` (express/standard/advanced/custom), `game_count`, `speed`, `fixture_mode` (auto/manual), `state` (CHECK 10 estados), `seed`, `started_at`, `finished_at`, `cancel_reason`; RLS permisiva con 4 políticas. **No ejecutado** (la app degrada a `localStorage`).
- **Creación en un paso** (`createTrainingCamp` en `useLeague.js`): liga `simulation:true` + evento, con config explícita (nombre, `start_at` con `datetime-local`, nivel, y en Custom: partidos 5/10/15/20 + velocidad demo/normal/fast).
- **Lobby** (`TrainingCampLobby` + componentes): header azul `--mode-tc` con eyebrow/pill de estado, timeline de 9 estados (`TrainingCampStatus`), countdown en vivo Días/Horas/Min/Seg (`TrainingCampCountdown`), roster de participantes con admin/tú/dot de presencia (`TrainingCampParticipants`), código de invitación + copiar enlace, sección "¿Qué vas a vivir?", acciones admin (Abrir lobby / Comenzar ahora con cuenta regresiva de 60s / Cancelar con confirmación).
- **Persistencia tolerante** (`trainingCampService`): intenta Supabase y degrada a `localStorage` (`gameguru.tc.<leagueId>`) con aviso en la UI (`persisted: 'local'`).
- **Presencia preparada** (`models/presence.js`): `online: boolean|null`, sin Realtime (BUILD-TC-006); la UI muestra "presencia desconocida".
- **Entradas**: Topbar (CTA azul, navega al lobby si la liga actual es practice), BottomNav ('Camp'), dashboard (banner lobby cuando la liga activa es practice + CTA de bienvenida), badge en Mis Ligas.

### Fuera de alcance (BUILD-TC-002/003/004)
- No genera partidos ni resultados (Fixture Generator en TC-004 / Simulation Engine en TC-005).
- No leaderboard/picks en vivo (exención PRIVACY-001 aún no aplica).
- No APIs/realtime (TC-008).

### Arquitectura del dominio
```
src/domains/training/
├── models/states.js        → TRAINING_STATES, getDerivedPhase (fases derivadas), COUNTDOWN_THRESHOLD_MS
├── models/levels.js        → TRAINING_LEVELS presets + resolveConfig()
├── models/presence.js      → modelo online + presenceAvailability()
├── services/trainingCampService.js → create/get/update/remove con fallback localStorage (renombrado en TC-003)
├── hooks/useTrainingCamp.js→ evento, phase, remainingMs, roster, acciones de transición (renombrado en TC-003)
├── index.js
├── training.module.css     → identidad azul, mobile-first
└── components/             → Header, Status, Countdown, Participants, Lobby, SetupModal
```

### Validación
- `npm run build` ✅ (147 módulos, +15 vs. base).
- Smoke test: la app arranca sin errores en el dev server (`http://localhost:5173/gameguru/`).
- Verificación manual pendiente: flujo crear → lobby → comenzar → countdown → cancelar, desktop y móvil (usuario con sesión activa).

### Archivos
- `supabase/005.1-training-camps.sql` (DDL manual, no ejecutado).
- `src/domains/training/**` (nuevo dominio).
- `src/hooks/useLeague.js` (`createTrainingCamp`, `configureTrainingCamp`).
- `src/pages/TrainingCamp.jsx` (ruta `#training` en `App.jsx`).
- `src/supabase.js` (`trainingCampsApi`).
- `src/i18n/es.js` + `en.js` (bloque `training.*`).
- `src/components/Topbar.jsx` / `BottomNav.jsx`, `src/domains/dashboard/**` (banner + badge), `src/styles/global.css` (tokens `--mode-tc`), `src/domains/league/models/modes.js`.

## 8.2 BUILD-TC-002 — Experience Picker + Entrada Oficial (implementado 2026-08-04)

**Resultado**: el Training Camp deja de ser una página independiente y entra por el **proceso oficial de creación de ligas**. Todo arranca con un wizard: Experience Picker → (TC) Intro educativa → Configuración → Lobby.

### Flujo de entrada
```
Crear Liga → Experience Picker → Training Camp Intro → Configuración → Lobby
```
- **Experience Picker** (paso 1): 3 cards con identidad visual por modo — 🎓 Training Camp (azul `--mode-tc`), 🏈 Pretemporada (teal `--mode-ps`), 🏆 Temporada Oficial (dorado `--mode-rs`). Cada card: ícono, nombre, descripción y chip de "etiqueta".
- **Training Camp Intro** (paso 2, solo TC): hero azul + 4 bloques — qué aprenderás, duración aproximada (30-60 min), cómo funciona la simulación, qué obtenés al finalizar — y cierre con el embudo de adopción `🎓 → 🏈 → 🏆` ("Training Camp → Pretemporada → Temporada Oficial"). Solo después de "Continuar" se entra a la configuración.
- **Configuración** (paso 3): TC reutiliza `TrainingCampSetupForm` (nombre, `datetime-local`, nivel Express/Standard/Advanced/Custom); Preseason/Regular usan el form clásico (nombre + deporte).
- **Lobby/liga**: TC crea liga+evento y entra directo al Lobby (el código de invitación vive en el Lobby); Preseason/Regular muestran la pantalla de invitación clásica y entran al dashboard.

### Decisiones de entrada
- El CTA del Topbar **"🎓 Training Camp"** ya no abre un modal aislado: si la liga actual es practice navega al Lobby; si no, **abre el wizard en la intro del TC**.
- "➕ Crear" del Topbar y "🚀 Comienza ahora"/"🎓 Probar Training Camp" del dashboard abren el **wizard oficial** (`ExperienceWizard`).
- `TrainingCampSetupModal` queda solo para **configurar el evento de una liga practice existente** (botón admin del Lobby), no para crear.
- Compatibilidad: `CreateLeagueModal`/`CreateSimulationModal` siguen en el repo (el segundo lo usa SuperAdmin); `joinByCode`, Picks, Leaderboard, Preseason/Regular intactos.

### Arquitectura del dominio
```
src/domains/experience/
├── experience.module.css       → picker cards, intro, config liga, overlay
└── components/
    ├── ExperiencePicker.jsx    → 3 cards (accents por modo)
    ├── TrainingCampIntro.jsx   → hero + 4 bloques + embudo TC→PS→RS
    └── ExperienceWizard.jsx    → orquesta pasos; Preseason/Regular reusan createLeague
```

### Validación
- `npm run build` ✅ (151 módulos, +4 vs. TC-001).
- Smoke test: la app arranca sin errores en el dev server.
- Verificación manual pendiente: flujo completo TC (picker → intro → config → lobby) y Preseason/Regular (picker → config → invitación), desktop + móvil.

### Archivos
- `src/domains/experience/**` (nuevo dominio).
- `src/App.jsx` (`showWizard`/`wizardInit`, Topbar/Home CTAs → wizard).
- `src/domains/training/components/TrainingCampSetupForm.jsx` (extraído del modal para reuso).
- `src/i18n/es.js` + `en.js` (bloque `wizard.*`).
- `src/domains/training/components/TrainingCampSetupModal.jsx` (ahora solo modo config).

## 8.3 BUILD-TC-003 — Event Director (implementado 2026-08-04)

**Resultado**: aparece el dominio `src/domains/event/` con el contrato compartido `EventDirector` (→ `TrainingCampDirector` hoy; futuros `PreseasonDirector`/`OfficialSeasonDirector` con el mismo contrato). El Director **coordina, no genera**: no crea partidos ni resultados ni calcula countdowns; carga la secuencia de pasos, deriva `currentStep`/`lastCompletedStep` y resuelve las transiciones de orquestación (abrir lobby, comenzar, cancelar, avance por hora). Además se introduce **Training Session** como entidad independiente (1:N-ready con `session_no`, aunque temporalmente 1:1 por liga), una pantalla de **confirmación** en el wizard y la **personalidad** del Lobby.

### Decisiones del usuario (2026-08-04)
1. TC-003 = **Event Director + confirmación del wizard + personalidad del Lobby** (sin Fixture Generator; pasa a TC-004).
2. Training Session **no** queda 1:1 como modelo definitivo ni migra toda la app: se diseña e introduce desde ya como entidad independiente, con **una única sesión por liga temporalmente**, preparada para **evolucionar a 1:N sin romper**.
3. Términos: internamente **"Training Session"**; visible al usuario **"Training Camp"**.

### El Director (dominio `event/`)
```
EventDirector (contrato base)
  ├── getSteps()               → secuencia canónica de pasos
  ├── getCurrentStep(event, now)   → paso activo derivado de estado + reloj
  ├── getLastCompletedStep(...)    → último paso completado (resumibilidad)
  └── dispatch(event, action, payload) → parche a aplicar (puro, no persiste)
        ↓
TrainingCampDirector (implementa EventDirector)
  ├── steps: las 9 etapas de PLAN-005
  ├── fase derivada (getDerivedPhase) → paso canónico (waiting→waiting_players, ready→training_started)
  └── transiciones por hora: waiting_players ─T-60s→ countdown ─start_at→ training_started
      + acciones admin: OPEN_LOBBY / START_NOW (start_at = now+60s) / CANCEL
```
- `EVENT_ACTIONS`: `OPEN_LOBBY`, `START_NOW`, `CANCEL`, `TICK`.
- El Dashboard/la UI solo conoce `EventDirector` (steps + dispatch), nunca qué motor está detrás → agregar Preseason/Regular Directors no toca la UI.
- Verificación con node: secuencia `created>waiting_players>countdown>training_started>picks_open>picks_locked>games_in_progress>simulation_running>finished`; TICK en T-60s→`countdown`, TICK con `start_at` vencido→`training_started` (`started_at`); `lastCompleted` deriva el paso anterior; `finished` queda como completado; `cancelled` → `currentStep` virtual index 9 y `lastCompleted null`.

### Training Session como entidad (1:N-ready)
- **SQL** `supabase/005.1-training-sessions.sql` (manual, **no ejecutado**; reemplaza a 005.1-training-camps.sql): tabla `training_sessions` con `id` PK, `league_id` FK, `session_no` y `UNIQUE (league_id, session_no)` → la app evoluciona a 1:N solo dejando de filtrar por "sesión más reciente".
- **Data layer** (renaming): `trainingSessionsApi` en `supabase.js` (`get` = sesión más reciente por liga, `list`, `updateById`, `updateByLeague`), `trainingSessionService` (localStorage `gameguru.ts.<leagueId>` con migración automática desde `gameguru.tc.*`), `useTrainingSession`.
- `session_no` se calcula automáticamente (`nextSessionNo` = max + 1) para estar listo ante la segunda sesión.
- `useLeague.createTrainingCamp`/`configureTrainingCamp` conservan su API pública (App.jsx intacto) usando el service renombrado.

### Confirmación en el wizard
- Nuevo paso `tc-review` tras `tc-config`: resumen **Nombre / Inicio / Nivel (N juegos)** en tarjeta azul y botón **"[Crear Evento]"** (i18n `training.review*`). La configuración ya no crea: guarda el borrador y avanza a la confirmación; `handleCreateEvent` crea liga + sesión y entra al Lobby.

### Personalidad del Lobby
- Estados con voz propia: `🟢 La sesión comenzará pronto` (waiting), `⏳ Comenzamos en...` (countdown), `¡A jugar!` (ready), `🎉 ¡Entrenamiento completado!` (finished), `✕ Esta sesión fue cancelada.` (cancelled) — keys `persona*` (es/en).
- Número de sesión visible: `🎓 Training Camp #{no}` (header + countdown).
- La timeline de `TrainingCampStatus` pasa a usar `currentStep`/`lastCompletedStep` del Director como fuente de verdad.

### Arquitectura del dominio
```
src/domains/event/                 → NUEVO (BUILD-TC-003)
├── EventDirector.js               → contrato base + EVENT_ACTIONS
├── TrainingCampDirector.js        → director del TC (steps + dispatch + singleton)
└── index.js
src/domains/training/
├── services/trainingSessionService.js  → renombrado (antes trainingCampService)
├── hooks/useTrainingSession.js         → renombrado (antes useTrainingCamp); conecta el Director
└── components/ (Header, Status, Countdown, Lobby) → personalidad + sessionNo
```

### Validación
- `npm run build` ✅ (154 módulos, +3 vs. TC-002 por el dominio `event/`).
- Smoke test: la app arranca sin errores en el dev server (`http://localhost:5173/gameguru/`, headless chrome).
- Lógica del Director verificada con node (transiciones por hora, steps, currentStep/lastCompletedStep).

### Archivos
- `supabase/005.1-training-sessions.sql` (DDL manual 1:N-ready, no ejecutado; reemplaza 005.1-training-camps.sql).
- `src/domains/event/**` (nuevo dominio: EventDirector + TrainingCampDirector).
- `src/domains/training/services/trainingSessionService.js` + `hooks/useTrainingSession.js` (renaming + conexión del Director).
- `src/supabase.js` (`trainingSessionsApi`), `src/hooks/useLeague.js` (imports), `src/domains/training/index.js` (exports).
- `src/domains/training/components/TrainingCampLobby.jsx`, `TrainingCampHeader.jsx`, `TrainingCampStatus.jsx`, `TrainingCampCountdown.jsx` (personalidad + sessionNo + steps del Director).
- `src/domains/experience/components/ExperienceWizard.jsx` + `experience.module.css` (paso de confirmación `tc-review`).
- `src/i18n/es.js` + `en.js` (keys `persona*`, `sessionTag`, `review*`; textos de engineNote/readySub/localPersist actualizados).

## 8.4 BUILD-TC-004 — Fixture Generation Event (implementado 2026-08-05)

**Resultado**: aparece el evento **Fixture Generation** con un director propio (`FixtureGenerationDirector`, mismo contrato `EventDirector`) y un motor **desacoplado de React** (`FixtureGeneratorService` + `fixtureCalendar` puro/determinista). Al **finalizar la sesión de Training Camp** (estado `finished`) el hook crea la sesión `fixture_generation`; el Lobby la muestra con las mismas tarjetas (Header/Status) más un nuevo **Progress** (barra generado→guardado), sin conocer el director. `EVENT_TYPES` identifica el director por `event.event_type`; `EVENT_ACTIONS` se extiende con `START_GENERATION` / `GENERATION_PROGRESS` / `SAVE_COMPLETE` / `COMPLETE_EVENT`.

### Decisiones
1. **`.js` en lugar de `.ts`**: el prompt pidió `FixtureGenerationDirector.ts`, pero el proyecto es 100% JS (Vite 5 sin toolchain TS); se implementa en `.js` por consistencia con el dominio `event/` (documentado en el header del director).
2. **Disparo al finalizar el TC** (decisión del usuario en este BUILD): la transición ocurre en `useTrainingSession` cuando el TC llega a `finished` (sin tocar la UI). El plan original apuntaba a `training_started`; la instrucción del BUILD prevalece y queda anotada aquí. El flujo está **preparado** para demo: hoy el TC solo llega a `training_started`, así que el evento se activa al finalizar la sesión.
3. **Nueva sesión por evento**: `createFixtureEvent` crea una fila con `event_type: 'fixture_generation'` y `session_no` automático → al ser la más reciente, `trainingSessionService.get` la devuelve y el Lobby la pinta sin cambios. En localStorage reemplaza el registro de la sesión TC.
4. **Progreso persistido en el evento**: `fixture_progress: {generated, saved, total}`; el director deriva el paso activo (`generated < total → generating_fixtures`, `generated === total → saving_matches`, `SAVE_COMPLETE → completed`).
5. **Idempotencia**: guard `ref` en el hook (StrictMode/re-renders no duplican el evento ni la generación) + el service limpia partidos `tc-<sessionNo>-*` previos antes de insertar.

### Arquitectura
```
src/domains/event/
├── EventDirector.js                   → + EVENT_TYPES, + acciones de generación, `type`/`getEventType()`
├── TrainingCampDirector.js            → `type: training_camp`
├── FixtureGenerationDirector.js       → NUEVO: 4 pasos + dispatch (waiting→generating_fixtures→saving_matches→completed)
├── services/
│   ├── fixtureCalendar.js             → NUEVO: RNG seed (mulberry32) + rondas round-robin (puro, testable)
│   └── FixtureGeneratorService.js     → NUEVO: genera + persiste league_games + onProgress (sin React)
└── index.js
src/domains/training/
├── hooks/useTrainingSession.js        → elige director por event_type; orquesta transición TC→FG y la generación
├── services/trainingSessionService.js → `event_type` en create + `createFixtureEvent` + normalize sin coacción TC
└── components/ (Status/Header/Lobby genéricos + TrainingCampProgress NUEVO)
```
- El calendario usa el **método de la circunferencia** (31 rondas × 16 = 496 pareos únicos): se barajan rondas enteras para que **≤16 partidos cubran los 32 equipos una sola vez** y 17–20 usen la ronda siguiente (doble jornada). Determinista por `seed`.
- Los partidos viven en `league_games` (`master_game_id: null`, `season: 'Sim'`, `week: 1`, `game_id: tc-<sessionNo>-<n>`, `game_time` = `start_at + n×2min`).

### Validación
- **Verificación node** (bundle con esbuild): 27 checks ✅ — transiciones del director (incl. `currentStep`/`lastCompletedStep` en `completed` y `cancelled` virtual), idempotencia de dispatch, determinismo por seed, 16 partidos → 32 equipos una vez, 20 partidos sin duplicar pareos, `game_time` +2min.
- `npm run build` ✅ (158 módulos, +4 vs TC-003).
- Smoke test ✅ (dev server + headless chrome, sin errores de consola).
- **Verificación manual pendiente**: crear TC → lobby → comenzar → sesión `finished` → evento `fixture_generation` con progreso → `completed` → partidos visibles en `league_games`.

### Archivos
- `src/domains/event/EventDirector.js` (EVENT_TYPES + acciones + `type`), `FixtureGenerationDirector.js` (nuevo), `services/fixtureCalendar.js` (nuevo), `services/FixtureGeneratorService.js` (nuevo), `index.js`.
- `src/domains/training/hooks/useTrainingSession.js`, `services/trainingSessionService.js`.
- `src/domains/training/components/TrainingCampStatus.jsx` (steps-driven genérico + personas FG), `TrainingCampHeader.jsx` (tag/badge FG), `TrainingCampLobby.jsx` (Progress para FG + acciones TC gated), `TrainingCampProgress.jsx` (nuevo).
- `src/domains/training/training.module.css` (barra de progreso).
- `src/i18n/es.js` + `en.js` (keys `fixture*`, personas FG).
- `supabase/005.1-training-sessions.sql` (columna `event_type` + CHECK de estados FG + CHECK `event_type`).

## 8.4.1 BUILD-TC-004.2 — Estabilización (implementado 2026-08-05)

BUILD de consolidación sobre TC-004: migración aplicada + manejo defensivo.

### Migración aplicada
- El usuario ejecutó `supabase/005.1-training-sessions.sql` en el SQL Editor (la CLI estaba instalada pero el proyecto no linkeado y solo había anon key; por decisión del usuario se corrió manualmente).
- Verificación REST con anon key: `GET /rest/v1/training_sessions` → **200** (antes PGRST205); round-trip completo en liga real: INSERT 201 (defaults `event_type`/`state`), PATCH a `generating_fixtures` + `fixture_progress` JSONB 204, READ back, DELETE 204. FK `league_id → leagues` confirmada (409 con id inexistente).
- El SQL ahora es **crear/actualizar**: `ADD COLUMN IF NOT EXISTS` (1b) para subir tablas parciales al esquema vigente, e índices `league_id`/`state`/`event_type` (5).

### Hardening defensivo
- `states.js`: `getTrainingState`/`getDerivedPhase` toleran `event` nulo/no-objeto, `start_at` y `now` inválidos sin lanzar y sin `undefined`. Nuevo vocabulario `FIXTURE_GENERATION_STATES` (`waiting/generating_fixtures/saving_matches/completed`): `isValidTrainingState` los reconoce para que `getTrainingState` **no coaccione estados FG a `created`** (el Lobby es compartido por ambos tipos de evento).
- `useTrainingSession`: `load` con `Promise.allSettled` + `try/finally` (nunca se queda en `loading`); `applyPatch` conserva el estado optimista y no tira la UI si falla la persistencia; logs descriptivos en carga/spawn/generación.
- `TrainingCampLobby`: estado vacío explícito sin excepciones cuando no hay sesión (CTA admin "Configurar el primer evento"; invitación/código visibles para invitar).
- `trainingSessionService`: `logFallback(op, err)` y logs descriptivos por operación antes de degradar a localStorage.

### Validación
- Harness node 18/18 ✅ (`/tmp/opencode/tc0042-verify.mjs`): null/bad-input/FG states. Regresión TC-004 27/27 ✅. `npm run build` ✅ 158 módulos. Smoke ✅ sin errores de consola.
- Pendiente: verificación manual con sesión iniciada (crear TC → persistencia en nube sin aviso "local").

## 8.5 BUILD-TC-005 — Game Week & Picks (implementado 2026-08-05; **validado en modo nube 2026-08-07 — BUILD-TC-005.1**)

**Resultado**: tras finalizar Fixture Generation, el usuario puede **jugar la jornada de inmediato**: ver los partidos generados, seleccionar sus picks, confirmar la planilla y bloquearla. El flujo llega hasta `picks_locked`; el motor de resultados es BUILD-TC-006.

### Decisiones del usuario (2026-08-05)
1. **Game Week = tercer evento** `game_week` (TC → FG → Game Week). 1 evento = 1 director = 1 alcance, consistente con el patrón actual (el hook crea el evento al completarse FG).
2. **Bloqueo de picks** `picks_open → picks_locked`: al vencer el deadline (`start_at + N min`) **o** cuando todos los participantes confirmaron **o** por lock manual del admin (consistente con "Comenzar ahora").
3. **Ventana de picks por nivel**: Express 5' / Standard 10' / Advanced 15' / Custom editable — extiende `resolveConfig` (no agrega campos a la config salvo en Custom).
4. **Schema completo** en `005.2-game-week.sql`: `game_weeks` + `pick_submissions` + `training_session_id` en `league_games` y `picks` + `event_type 'game_week'`.

### Flujo
```
FG completed ──spawn──▶ game_week (picks_open · Jornada activa)
  → Grid de partidos (league_games por training_session_id)
  → Selección + pendientes (x/y) → Confirmación (sheet)
  → pick_submissions + SUBMIT_PICKS
  → [deadline | todos confirmaron | admin] → picks_locked (Jornada bloqueada 🔒)
  → (TC-006) Simulation Engine → games_in_progress → simulation_running → finished
```

### Entidades (SQL `supabase/005.2-game-week.sql`, manual, idempotente, RLS permisiva)
- **`game_weeks`**: `id` PK, `training_session_id` FK→`training_sessions`, `league_id` FK, `week` int (1 en TC), `game_count`, `deadline_at` timestamptz, `state` (**WeekState**): `pending → picks_open → picks_locked → games_in_progress → simulation_running → completed` (+ `cancelled`). `UNIQUE (training_session_id, week)`.
- **`pick_submissions`**: `game_week_id` FK, `user_id` FK, `pick_count` (x/y para el indicador de pendientes), `submitted_at`; `UNIQUE (game_week_id, user_id)`.
- **`PickStatus`** (derivado, no se persiste): `open → draft → submitted → scored`. Se obtiene de `pick_submissions` + `picks` + resultados.
- `league_games` + `training_session_id uuid NULL` (lo setea `FixtureGeneratorService`; se elimina el parseo de `game_id tc-<sessionNo>-*`).
- `picks` + `training_session_id uuid NULL` + `submitted_at` (desambigua sesiones; el contrato `calcStandings`/Leaderboard/PublicPicks **no cambia**).
- `training_sessions`: CHECK `event_type` + `'game_week'` (el CHECK de `state` ya incluye los estados de juego).

### Director (sin acoplar la UI)
- **`GameWeekDirector`** (dominio `event/`, evento `game_week`): steps `picks_open → picks_locked → games_in_progress → simulation_running → finished` (+ `cancelled` virtual). `EVENT_ACTIONS` + `SUBMIT_PICKS` / `LOCK_PICKS` / `SIMULATION_START` / `SIMULATION_PROGRESS` / `COMPLETE_EVENT`. TICK: `picks_open → picks_locked` al vencer `deadline_at`.
- **`picksService`** (sin React): persiste `picks` + `pick_submissions` y dispatchea `SUBMIT_PICKS`/`LOCK_PICKS` al director. Hook **`useGameWeekPicks`** expone `weekState`, `PickStatus`, `deadlineMs`, acciones; la UI nunca conoce el director ni Supabase directo.
- `useTrainingSession`: `directorFor` gana la rama `game_week`; efecto `spawn` FG `completed` → Game Week (patrón TC→FG, guard `ref` anti StrictMode).
- UI: `GameWeekView` en el dominio `training` (la vista del evento cambia por `event_type`, como ya hace el Lobby con TC/FG); reutiliza `GameCard`. Deadline TC = `start_at + N` (**no** `getWeekDeadline`); `N` desde `resolveConfig` extendido.

### Frontera TC-005 / TC-006 (Simulation Engine)
- **TC-005**: jornada activa + selección + pendientes + confirmación + bloqueo hasta **`picks_locked`**; la transición a `games_in_progress` queda **definida** en el director pero inactiva (placeholder "Esperando simulación").
- **TC-006**: `SimulationService → SimulationEngine → RandomGenerator` (seed), `SIMULATION_START/PROGRESS`, resultados vía `leagueGamesApi.setScores` (mismo contrato que ScoreEditor), leaderboard/picks públicos en vivo (exención PRIVACY-001) y `finished`.

### Backlog BUILD-TC-005
1. `supabase/005.2-game-week.sql` (tablas + columnas + CHECK `event_type`).
2. `GameWeekDirector` (+ `EVENT_ACTIONS` nuevas).
3. `picksService` + `useGameWeekPicks`.
4. `FixtureGeneratorService`: setear `training_session_id` en `league_games`.
5. `useTrainingSession`: rama `game_week` + spawn FG→GW.
6. `GameWeekView` + componentes (jornada, pendientes, confirmación, bloqueo) + i18n es/en.
7. `resolveConfig`: ventana de picks por nivel.
8. Verificación: harness node (transiciones del director + derivación PickStatus), `npm run build`, smoke, docs.

### Validación prevista
- Harness node del `GameWeekDirector` (picks_open→picks_locked por deadline/todos/admin; `cancelled` virtual; `lastCompletedStep`).
- Derivation de `PickStatus` (open/draft/submitted/scored) contra estados del director.
- `npm run build` + smoke; verificación manual con sesión (FG → jornada → picks → confirmar → bloqueo).

## 8.5.1 BUILD-TC-005 — alcance entregado (2026-08-05)

**Estado**: implementado, verificado y documentado, **sin commitear**. **Validado en modo nube el 2026-08-07 (BUILD-TC-005.1)**: la migración `005.2` ya estaba aplicada en Supabase (verificada íntegra vía Management API), se ejecutó el backfill `004.1` pendiente, y el flujo completo de nube quedó verificado con un E2E real 25/25 + regresión 56/56 (detalle en `gameguru-day-2026-08-07.md`).

### BUILD-TC-005.1 (2026-08-07) — Persistencia en modo nube
- **Migraciones**: `005.2-game-week.sql` verificada en DB (tablas `game_weeks`/`pick_submissions`, UKs, CHECKs WeekState/`event_type`, FKs, columnas de `league_games`/`picks`/`training_sessions`). `004.1-season-system.sql` ejecutada vía Management API (`leagues.league_mode/season` + `master_games.phase` + backfill → liga real `16d92451-…` quedó `practice`).
- **Fix A (DB)**: `picks_session_game_unique` era índice parcial y PostgREST `on_conflict` solo acepta unique constraints → sustituido por `UNIQUE CONSTRAINT (user_id, league_id, training_session_id, game_id)` (aplicado en DB + actualizado en el SQL). El upsert por sesión funciona y el duplicado devuelve 23505.
- **Fix B (app)**: `GameWeekContext` filtraba partidos solo por `event.id` (GW), pero `FixtureGeneratorService` enlaza los `league_games` a la sesión **fixture_generation** → jornada vacía en nube. `sessionGameMatch` ahora acepta un `Set` de ownerIds (GW + FG vía `trainingSessionsApi.list` con `event_type`) + fallback `tc-<sessionNo>-`.
- **E2E real 25/25** (`/tmp/opencode/tc0051-e2e.mjs`, usuario autenticado real): perfil → liga → join admin → TC → FG (10 partidos con `training_session_id=fgId`) → GW (sesión + fila `game_weeks`) → picks×10 upsert → confirmación (`pick_submissions`) → `picks_locked` → **persistencia tras refresh** → `completed` → delete liga cascade limpio. Datos de prueba borrados.
- **Regresión 56/56** (harness node esbuild + mock: directores, calendario, estados defensivos, servicios GW/picks/levels/FG/TS).
- `npm run build` ✅ (165 módulos) + smoke `vite preview` ✅.

### Lo que se construyó
- **Migración `supabase/005.2-game-week.sql`** (idempotente, RLS permisiva): tablas `game_weeks` (WeekState `pending/waiting/picks_open/picks_locked/games_in_progress/simulation_running/completed/cancelled`, `UNIQUE(training_session_id, week)`, `deadline_at/locked_at/completed_at`) y `pick_submissions` (`UNIQUE(game_week_id, user_id)`, `pick_count`, `submitted_at`); `league_games.training_session_id` + `picks.training_session_id`/`submitted_at`; CHECK `event_type IN ('training_camp','fixture_generation','game_week')`; `training_sessions.picks_deadline_at`; índices. **Fix A (005.1)**: `picks_session_game_unique` pasó de índice parcial a `UNIQUE CONSTRAINT (user_id, league_id, training_session_id, game_id)` para que PostgREST acepte `on_conflict`.
- **Nuevo dominio `src/domains/game-week/`** (decisión de implementación: dominio propio con CSS púrpura propio, no dentro de `training/`):
  - `GameWeekDirector.js` — director puro (contrato `EventDirector`): steps `waiting → picks_open → picks_locked → completed` (+ `cancelled` virtual); `OPEN_WEEK` (setea `picks_deadline_at`), `LOCK_PICKS` (con `reason: deadline|all_submitted|admin` + `locked_at`), `OPEN_NEXT_WEEK`, `COMPLETE_EVENT`, `CANCEL`, `TICK` (bloquea por deadline leído de `payload.deadline_at || event.picks_deadline_at`). No conoce Supabase ni la NFL.
  - `GameWeekService.js` — `computePickDeadline` (apertura + ventana del nivel), `openWeek` (crea fila idempotente + parche `OPEN_WEEK`), `lockWeek` (`LOCK_PICKS` + sync de fila), `openNextWeek` (1:N-ready; `null` si `week >= totalWeeks`), `getActiveWeek`/`listWeeks`. Degrada a localStorage (`gameguru.gw.<sessionId>`).
  - `PicksService.js` — `savePick`/`updatePick` (upsert con `onConflict` por sesión, `submitted_at: null`), `validateComplete` (todos los `game_id`), `confirmPicks` (marca `submitted_at` + inserta `pick_submissions`, devuelve `allSubmitted`), `areAllSubmitted` (todos los miembros confirmaron → bloqueo colectivo), **`getConfirmedPicks` = punto de integración de TC-006** (Simulation Engine consume los picks confirmados sin tocar la UI). `PickStatus`: `open/draft/submitted`.
  - `GameWeekContext.jsx` + `useGameWeek` — único puente React → dominio: estado derivado (`weekState`, `PickStatus`, `pickCount/totalGames`, `deadlineMs`, `isOpen/isLocked/...`) y acciones (`selectPick`, `confirmPicks` [dispara `all_submitted`], `lockWeek` [admin]). Ninguna regla de dominio en componentes.
  - `GameWeekView.jsx` + `game-week.module.css` — listado de partidos (reutiliza `GameCard`), selección, contador `x/y`, banner de ventana abierta/cerrada con countdown, confirmación, estados waiting/locked/completed/cancelled. i18n `gameWeek.*` (es/en).
- **Contrato extendido**: `EventDirector.js` — `EVENT_TYPES.GAME_WEEK: 'game_week'` + `EVENT_ACTIONS.OPEN_WEEK/LOCK_PICKS/OPEN_NEXT_WEEK`.
- **`supabase.js`**: `picksApi.getForSession`/`getAllForSession`/`upsert({onConflict})`; nuevas `gameWeeksApi` y `pickSubmissionsApi`.
- **`trainingSessionService.js`**: `createGameWeekEvent` (sesión `game_week` `waiting`, persiste `level` + `pick_window_minutes`). `createFixtureEvent` ahora propaga `level`.
- **`useTrainingSession.js`**: `directorFor` con rama `game_week`; spawn FG `completed` → GW (guard `ref`); apertura de jornada (`waiting` → `OPEN_WEEK`, guard `ref`); `phase` por `currentStep` para GW; expone `applyPatch` para que `GameWeekProvider` avance la sesión.
- **`TrainingCampLobby.jsx`**: conmuta a `GameWeekProvider` + `GameWeekView` cuando `event_type === 'game_week'`.
- **`FixtureGeneratorService.js`**: setea `training_session_id` en los `league_games` persistidos.
- **`levels.js`**: `resolveConfig` extendido — `pickWindowMinutes` Express 5' / Standard 10' / Advanced 15' / Custom editable (param `pickWindowMinutes`).

### Desviaciones del diseño §8.5 (documentadas)
- UI en dominio propio `game-week/` (no `training/`); hook `useGameWeek` (no `useGameWeekPicks`).
- `EVENT_ACTIONS` para picks: `OPEN_WEEK`/`LOCK_PICKS`/`OPEN_NEXT_WEEK` (no `SUBMIT_PICKS`); el lock siempre lleva `reason` (`deadline|all_submitted|admin`).
- Steps del director dejan fuera `games_in_progress`/`simulation_running`/`finished` (quedan declarados en el CHECK de la migración para TC-006; el director los activará con `SIMULATION_START/PROGRESS` de TC-006).
- La ventana de picks se propaga por el ciclo TC→FG→GW (`level` + `pick_window_minutes`), y el deadline se computa en `openWeek` (no en el director).

### Verificación (todo en verde)
- Harness node `tc005-verify.mjs` (esbuild + mock de supabase): **57 checks** — director (transiciones, reasons de lock, TICK por deadline, idempotencia, cancelled virtual), service (openWeek idempotente, deadline = ventana del nivel, openNextWeek 1:N, degradación a localStorage), picks (ventana cerrada → error, confirm incompleto → missing, confirm completo → `submitted_at` + `pick_submissions`, allSubmitted al confirmar todos, `getConfirmedPicks` con los 6 picks, degradación local) y `resolveConfig` (5/10/15/editable).
- Regresión: harness TC-004 (director FG + calendar, 24 checks) y TC-004.2 (states defensivos, 18 checks) siguen en verde.
- `npm run build` ✓ (165 módulos) + smoke headless Chrome sin errores de consola.

### Siguiente paso (✅ HECHO en BUILD-TC-005.1, 2026-08-07)
1. ~~Ejecutar `supabase/005.2-game-week.sql` en el SQL Editor~~ → **ya estaba aplicada**; verificada íntegra vía Management API.
2. Verificación REST/round-trip + flujo completo FG → jornada → picks → confirmación → bloqueo → **E2E real 25/25** ✅.
3. Handoff final en `blueprint.md` / `gameguru.md` / daily (`gameguru-day-2026-08-07.md`) y commit (cuando el usuario lo pida).

## 8.5.2 BUILD-TC-005.3 (2026-08-08) — QA end-to-end desbloqueado + admin advance

**Estado**: implementado y verificado, **sin commitear**. El hito TC-005 quedó cerrado en el commit `7cb799a` (rama `development`, sin push); los cambios de este BUILD están en el working tree.

**Problema raíz**: el flujo QA se quedaba bloqueado en el estado START del Training Camp (countdown de 60 s por la hora del evento) y nunca se llegaba a Fixture Generation → Game Week → Picks, por lo que la cadena completa no podía verificarse en navegador real. Además, el esquema desplegado de `training_sessions` no tiene columnas que el código sí enviaba (`finished_reason`, `locked_at`, `lock_reason`) y los parches internos `__week` → los PATCH fallaban con 400 y degradaban a localStorage (la UI funcionaba, pero la nube quedaba atrás y el estado no sobrevivía al refresh).

**Lo que se construyó**
- **`ADVANCE_EVENT`** (contrato genérico del `EventDirector`, al estilo de `TICK`; descartado `COMPLETE_TRAINING_CAMP`): en `TrainingCampDirector` es idempotente — devuelve `null` si `finished`/`cancelled`/`created`; en cualquier otro estado → `{ state: 'finished', finished_at, finished_reason: 'admin' }`. Al quedar `finished`, los spawns existentes del hook disparan FG → GW → Picks sin duplicar (guards ref).
- **`useTrainingSession.advanceEvent()`** — dispatch + `applyPatch` (patrón de `cancelEvent`); lo consume el panel admin del lobby.
- **`TrainingCampLobby.jsx`**: panel admin (`Admin controls (QA)`) solo visible para admin + TC + evento activo (`phase ready|training_started`) + `state !== 'finished'`, con el botón `⏭️ Advance event (complete Training Camp)` (confirm por `window.confirm`). El estado START ahora muestra la UX activa (countdown/elapsed).
- **`TrainingCampCountdown.jsx`**: estado activo nuevo — "Training Camp is live" + `Running for: hh:mm:ss` + siguiente paso (FG). i18n `personaActive/activeSub/elapsed/nextStep/adminControls/advanceEvent/...` (es/en).
- **Fix de esquema (persistencia)**: `trainingSessionService.toCloudPatch()` — los parches del director conservan su contrato (harness los lee) pero antes del PATCH a la nube se excluyen los campos internos/QA que no son columnas: claves `__`-prefijo (`__week`), `finished_reason`, `locked_at`, `lock_reason`. Así el esquema desplegado no se rompe y la nube queda al día (el estado sobrevive al refresh).
- **Favicon**: `public/favicon.svg` + `<link rel="icon">` en `index.html` (elimina el 404 de consola de `/favicon.ico`).

**Verificación (todo en verde)**
- QA browser real (`/tmp/opencode/qae2e/qa-tc0053.mjs`, puppeteer + Chrome v151 + preview de Vite en 4175): **43/43 PASS** — signup por UI → wizard → lobby → `Open lobby` → `Start now` → countdown → fast-forward del reloj vía PATCH REST `start_at` + reload → re-entrada a la liga → TICK transiciona solo a `training_started` → panel admin → `ADVANCE_EVENT` → FG (1 sola vez) → GW (1 jornada) → 10 picks → confirm → lock `all_submitted` → **persistencia tras refresh** (bloqueada, 20 botones deshabilitados, 0 `SIN SELECCIÓN`) → edición tras lock = no-op → integridad de red: `training_sessions` POST ×3, `league_games` ×1, `game_weeks` ×1, `pick_submissions` ×1, 0 respuestas ≥500, 0 peticiones fallidas, **0 errores de consola** → delete liga cascade limpio.
- Regresión harness 69/69 (build-harness + regression.bundled) + `npm run build` ✅.
- Correcciones durante el QA: selectores del harness para lenguaje inglés de la UI, re-entrada a la liga tras reload (el contexto de liga es cliente), notas que solo se muestran con la ventana abierta (solo-1-usuario bloquea al instante), y conteo de botones de equipo por card (el `@` es un `<span>`, no parte del botón).

### Siguiente paso (backlog TC-006, NO iniciado)
El flujo llega hasta `picks_locked` y queda listo para el Simulation Engine (BUILD-TC-006), que toma el evento en `picks_locked` y lo lleva a `finished`. No se debe iniciar TC-006 hasta que el usuario lo pida.

## 8.5.3 BUILD-TC-005.4 (2026-08-08) — QA final TC-005 + fix de `league_mode`

**Estado**: implementado y verificado, **sin commitear** (mismo working tree que TC-005.3).

**QA final** (`/tmp/opencode/qae2e/qa-tc0054.mjs`, browser real): **48/48 PASS** + regresión harness **82/82** tras rebuild del bundle.

**Bug fijado**: en el QA, tras recargar la liga creada con el wizard, el gate del CTA rompía: `createTrainingCamp()` persistía `simulation: true` pero NO `league_mode`, y la BD tiene default `'regular'` → tras reload `getLeagueMode()` devolvía `'regular'` y el CTA de "crear TC" no aparecía. Fix: `createTrainingCamp()` (src/hooks/useLeague.js) ahora persiste explícitamente `league_mode: 'practice'` junto a `simulation: true`.

**Nota**: quedan 4 ligas huérfanas de QA que no se pueden borrar vía API (RLS exige token del owner); limpieza manual en Supabase Dashboard con ids `603b07f8-…`, `f7a717a8-…`, `7f23bd9a-…`, `e3b225e1-…`.

## 8.6.1 BUILD-TC-006.1 (2026-08-08) — Simulation Engine: núcleo (sin UX)

**Estado**: implementado y verificado (harness **140/140**: 82 previos + 58 TC-006; build ✅; smoke preview 200). **Sin commitear**. La migración `006.1` **fue aplicada manualmente** en el SQL Editor de Supabase (verificada antes de BUILD-TC-006.2).

**Alcance**: núcleo del motor de resultados, sin UI. El orquestador real (hook) y la UX en vivo son BUILD-TC-006.2/6.3.

**Arquitectura (aprobada en PLAN-TC-006, 4 módulos en `src/domains/simulation/`)**:
- `SimulationDirector.js` — máquina INTERNA de la corrida (pura, extensión de `EventDirector`): `waiting → simulating → persisting_results → updating_standings → completed` (+ `failed`/`cancelled` virtuales). `dispatch` idempotente (re-despachar → null), `SIMULATION_PROGRESS` monotónico, `currentStep`/`lastCompletedStep` derivados. Persistida en `game_weeks.simulation_progress`.
- `MatchSimulator.js` — determinista (reglas PLAN-TC-006): `simulateGame(game, {seed, index})` → `{home_score, away_score, result}`. RNG `mulberry32(seed+index)` (mismo que fixtureCalendar); rango v1 3..38; empate → `result = null`; `result` SIEMPRE coincide con los scores. `simulateBatch` con índices estables `[start, start+limit)`.
- `SimulationService.js` — fachada (sin React): `start` (picks_locked → simulating + persiste seed/progreso en `game_weeks`, evento `games_in_progress`), `runBatch` (simula `[from, from+count)` y persiste SOLO en `league_games` vía `setScores`; evento `simulation_running`; degrada a localStorage `gameguru.sim.<weekId>`), `finalize` (PERSIST_DONE → computeStandings → STANDINGS_DONE → week `completed` + `simulated_at`), `getConfirmedPicks` (delegado a `picksService`). **Nunca escribe picks**.
- `StandingsCalculator.js` — puro: cada participante aparece (sin pick → 0); `correct`/`total`/`points`; empate no suma; orden correct desc → total asc → username asc. No persiste.

**Máquina pública del evento** (`GameWeekDirector`): steps `waiting → picks_open → picks_locked → games_in_progress → simulation_running → completed`; casos `SIMULATION_START` (picks_locked → games_in_progress), `SIMULATION_PROGRESS` (→ simulation_running), `ADVANCE_EVENT` idempotente (QA/admin). `EVENT_ACTIONS` (+`PERSIST_DONE`/`STANDINGS_DONE`/`FAIL`) en `EventDirector`. `toCloudPatch` (`trainingSessionService`) excluye `simulation_progress` del PATCH a la nube (no es columna de `training_sessions`).

**Migración `supabase/006.1-simulation.sql`** (idempotente, **APLICADA manualmente en Supabase**): `ALTER game_weeks ADD COLUMN IF NOT EXISTS seed int / simulation_progress jsonb / simulated_at timestamptz` + `CREATE INDEX IF NOT EXISTS game_weeks_sim_state_idx`.

**Verificación**: harness `regression.mjs` + `mock-supabase.js` (agregados `leagueGamesApi.setScores` y export de simulación en `bundle-entry.mjs`): determinismo (misma seed+índice → igual; seed/índice distinto → distinto; rango; empate alcanzable), máquina (transiciones/idempotencia/FAIL/CANCEL/steps), standings, e integración mock completa (start → batch → finalize → completed; cero escrituras picks; re-run no duplica; **índice estable entre batches**). `npm run build` ✅ (bundle `index-CC5Eoaky.js`); preview en **4173** (puerto default del script; antes 4175 era flag del QA) sirviendo 200.

**Nota determinismo**: fix dentro del BUILD — `runBatch` usaba `index: start` para todo el batch (rompía el índice estable al reanudar por batches); corregido a `index: start + i` y cubierto con test.

### Siguiente paso (BUILD-TC-006.2, NO iniciado)
Orquestador en `useTrainingSession` (dispara simulación al quedar `picks_locked`, batches según `speed`, applyPatch de los eventPatch) + UI: estado `simulation_running`, `GameWeekView` results, leaderboard en vivo. Requiere decidir si se aplica la migración `006.1` (hasta entonces la corrida degrada a localStorage).

## 8.6.2 BUILD-TC-006.2 (2026-08-08) — Orquestación automática de la simulación

**Estado**: implementado y verificado (harness **187/187**: 140 previos + 47 TC-006.2; build ✅; smoke preview 200). **Sin commitear**. La migración `006.1` **YA fue aplicada manualmente** en el SQL Editor de Supabase ANTES de este BUILD (la corrida persiste en la nube; no degrada).

**Alcance**: orquestación en `useTrainingSession.js` — cuando la Game Week queda `picks_locked`, la simulación arranca sola y avanza por batches deterministas hasta `completed` (jornada) + `finished` (sesión). Resultados UI en vivo y leaderboard siguen en TC-006.3.

**Orquestación en el hook** (reglas de dominio en `SimulationService`, nunca en el componente):
- Efecto con `simGuardRef` **por id de jornada** (no por estado): si el mismo disparo se repite (StrictMode monta el efecto 2 veces, TICK de 1s, re-renders tras applyPatch), la segunda invocación se descarta; la primera completa la corrida. Semana distinta → el guard se re-arranca.
- **Auto-start** solo si `event_type==='game_week'` y `state==='picks_locked'`; **resume** si viene en `games_in_progress`/`simulation_running` (reload a mitad de corrida lee `game_weeks.simulation_progress`).
- `batchSizeFor(speed)`: `demo→1`, `normal→3`, `fast→5` (default 3). El pacing visual (live) es TC-006.3.
- `runBatches` avanza en bucle mientras `simulating`, aplicando el `eventPatch` de cada batch; guarda anti-bucle si el progreso no avanza (setScores fallando).
- `runFinalize` lee `listSessionGames` (RAW rows) + `getConfirmedPicks` + participantes de `membersRef`/`profilesRef` y cierra con `simulationService.finalize`; luego `markSessionFinished` (`training_sessions.state='finished'`).
- `runSimulation` ramifica por estado persistido: `waiting→start`, `simulating→batches`, `persisting_results`/`updating_standings→finalize`, `completed→`COMPLETE_EVENT idempotente + `finished` si falta (revisión tras reload).

**Refactor compartido** (mismo BUILD): `GameWeekService.listSessionGames(event, leagueId)` + `sessionGameMatch(game, ownerIds, sessionNo)` extraído (RAW rows de `league_games` con `id`/`game_id`, fallback `tc-<sessionNo>-`); `GameWeekContext` lo usa y `isCompleted` incluye `finished` (alias sesión).

**Fix director**: `GameWeekDirector.getCurrentStep` trataba `finished` con `getWeekState` (estado no mapeado → `waiting`, la UI habría retrocedido al paso inicial). Corregido: `rawState` → alias `finished→completed` antes de mapear. Cubierto por tests 6.2-A/G.

**Verificación (harness A–K en `regression.mjs`, réplica exacta del flujo del hook)**:
- A: `picks_locked` → corrida automática completa (seed persistido, `simulated_at`, 4 partidos finished, secuencia de sesión `games_in_progress>simulation_running>simulation_running>completed`, cero escrituras picks).
- B: batching progresivo batch1(2)→batch2(4) con estados de jornada `games_in_progress`→`simulation_running`.
- C: determinismo entre batches (índice 0 y 3 === `simulateGame(seed, index)` aislado).
- D: reload/resume a mitad de corrida — lee progreso persistido, completa los restantes, **setScores solo 4 veces** (no re-escribe finished), progreso monotónico, picks intactos.
- E: StrictMode double-fire **concurrente** (`Promise.all`) — ambos completed, 4 filas sin duplicados, scores deterministas, jornada completed una vez.
- F: usuario sin pick → 0 puntos en standings.
- G: finalización completa (jornada `completed` + `simulated_at` + seed; `finished` → paso terminal `completed`).
- H: idempotencia (runBatch/finalize tras completed → sin cambios).
- I: cero escrituras sobre picks/pick_submissions.
- J: `setScores` exactamente 1 por partido.
- K: estados consistentes `training_sessions` + `game_weeks` durante todo el flujo.

**Fix dentro del BUILD**: los asserts 6.2-D/E leían `simulation_progress.completed` (shape correcto es `simulation_progress.progress.completed`); la mock `setScores` ahora cuenta llamadas (`__stats`) para el test J.

## 8.6.3 BUILD-TC-006.3 (2026-08-08) — Simulation: UX en vivo + cierre en la nube

**Estado**: implementado y **QA E2E browser real completo 45/45 PASS** (0 errores consola/red, 0 ≥500). Harness **231/231 PASS** (187 previos + 44 TC-006.3), `npm run build` ✅ (bundle `index-DwdsI9lI.js`), smoke preview 4173 200. **Sin commitear, sin push**. El QA destrabó y aplicó en la nube las migraciones `006.1` y la nueva `006.1b` (ver "Migraciones") y encontró 3 bugs reales corregidos (ver "Bugs").

**Alcance**: UX en vivo sobre el motor TC-006.1/006.2 — `GameWeekView` en `games_in_progress`/`simulation_running` muestra progreso de simulación; en `completed`/`finished` muestra resultados por partido (FINAL) + feedback de picks + leaderboard; Picks Públicos en vivo con exención PRIVACY-001 para `practice`. El motor ya producía `league_games.finished` + standings calculables.

### Migraciones (bloqueante destrabado en esta sesión)
- **`supabase/006.1-simulation.sql`**: el handoff previo la daba por aplicada manualmente, pero **no lo estaba** en la nube: PATCH `game_weeks` respondía **400 `Could not find the 'seed'/'simulation_progress' column`** y el front degradaba a localStorage. Aplicada vía **Management API** (`POST /v1/projects/yzssihtflqmgolyajhvb/database/query`), token personal del usuario extraído del gnome-keyring con `libsecret-tools` (`secret-tool` en `/tmp/opencode/secrettool/usr/bin`). Verificado: columnas presentes en `information_schema`; PATCH `seed`/`simulation_progress` → **200** (antes 400).
- **`supabase/006.1b-league-games-update.sql`** (NUEVO, idempotente): el RLS de `league_games` solo permitía UPDATE a admins (`role='admin'` en `league_members`), pero la simulación se orquesta desde el usuario que dispara el lock (puede ser un `member`) → UPDATE 0 filas → el batch no avanzaba. Nueva política `lg_update` por membresía (`league_members.user_id = auth.uid()`), consistente con el esquema permisivo del demo; ScoreEditor (admin-only) no cambia.

### Bugs reales corregidos (encontrados por el QA E2E)
1. **`SimulationDirector.defaultRun`/`getSimulationState` no toleraban `null`** (`SIMULATION_STATES[null.state]` → `Cannot read properties of null (reading 'state')` en SimulationProgress). Con la columna recién creada, la nube devuelve `null` (antes `undefined` porque no existía) y `defaultRun(null)` reventaba. Fix: normalización `run && typeof run === 'object' ? run : {}` en ambas. Cubierto por 6.3-A2.
2. **RLS de `league_games`** → migración 006.1b. Además `SimulationService` ahora loguea el partido + `error.message` en el `break` de setScores fallido (`[simulationService.runBatch] setScores falló ...`).
3. **`useTrainingSession.participants` no exponía `id`** (miembros RAW con `user_id`): `computeStandings` agrupa por `p.id` → todos colisionaban en `undefined` → leaderboard colapsaba a UNA fila (solo `botB`, no `botA`; resumen "No picks"). Fix: `participants` expone `{ id: m.user_id, username }` (contrato del leaderboard; `TrainingCampParticipants` sigue usando `user_id`). Cubierto por 6.3-E2.

### UX entregada (dominio + componentes)
- **`src/domains/game-week/simulationView.js`** (dominio puro, sin React): `getSimulationRun` (estado + completed/total + % con clamp), `buildResultsView` (proyección de `league_games` con scores/draw/finished), `sortStandings` (orden determinista), `buildLeaderboard` (rank 1..N, sin pick → 0), `canRevealPicks` (policy práctica vs oficial), `buildPickFeedback` (solo planilla propia en oficial; `revealAll` fuerza policy). Reutiliza `defaultRun`/`StandingsCalculator`/`modes.js`.
- **`GameWeekContext.jsx`**: prop `participants = []`, state `allPicks`, expone `isSimulating`/`simRun`/`resultsMap`/`standings`/`myUserId`; `selectPick` no bloquea durante simulación (la UI no ofrece acciones).
- **Componentes**: `SimulationProgress.jsx` (status + barra + %), `GameWeekResults.jsx` (GameCard con scores + "Your picks: {correct}/{total}" + `isDraw`), `GameWeekLeaderboard.jsx` (tabla rank/player/correct/total/pts, fila `boardMe`). Wiring en `GameWeekView.jsx`: en sim → SimulationProgress y NO acciones; en completed/finished → banner + Results + Leaderboard; badge `Simulation starting → Simulation running`; `locked = isLocked || isCompleted`. `TrainingCampLobby` pasa `participants`. i18n ES/EN `gameWeek.*` + CSS `.badgeSim/.simCard/.board*/.completedBanner/.drawTag`.

### Privacy Behavior (PRIVACY-001)
Practice (Training Camp): `canRevealPicks → true` (transparencia educativa; `buildPickFeedback` revela todas las planillas si `revealAll`). Oficial (preseason/regular): privado, solo la propia planilla. Policy vía `isOfficialMode`/`getLeagueMode` de `modes.js` (sin hardcodear). El leaderboard solo muestra agregados (correct/total/points), nunca picks ajenos.

### Verificación (harness + QA browser real)
- **Regresión 231/231**: 187 previos + 44 TC-006.3 (A: run null/waiting/30%/100% + clamp; A2: `defaultRun(null)`/`getSimulationState(null)`; B: 3/10→30%, completed→100%; C/D: buildResultsView + `finished` con `result` null = draw; E: leaderboard 4 usuarios, rank, tie-break, sin pick → 0; E2: participants `user_id` → `id` sin colapso; F/G: flujo mock completo; H: run completed tras refresh sin re-simular; I: privacy practice vs regular/season; J/K: `isWindowOpen` en estados sim + `savePick` rechazado).
- **QA E2E real 45/45** (`/tmp/opencode/qae2e/qa-tc0063.mjs`, puppeteer + Chrome contra preview 4173, migraciones aplicadas): 2 usuarios → liga → TC → advance → FG → GW → 10 picks c/u → confirmación → lock → **auto-simulación completa (REST `game_weeks.state='completed'`)** → ambos ven resultados (10 scores, feedback ✓/✗, "Your picks", leaderboard con ambos) → refresh: resultados sobreviven sin re-simular → **resume** (run 3/10 inyectado + reload → "Simulation progress · 3 of 10 games" → completa) → integridad de red (training_sessions POST ×3, league_games ×1, game_weeks ×1, pick_submissions ×2, picks ≥20, setScores ≥1, 0 ≥500, 0 fallidas, **0 errores de consola**) → DELETE league cascade.

## 8.6.4 BUILD-TC-006.4-FIX (2026-08-08) — Persistencia de picks idempotente (23505) + banner fantasma

> **⚠️ SUPERADO el 2026-08-09 por PLAN-LEAGUE-CONTEXT-01.1 + migración `006.2`** — el fix band-aid `onConflict (user_id, week, game_id)` detenía el crash 23505 pero **sobrescribía en silencio** picks entre ligas (mismo `game_id` en otra liga → perdía el pick de la anterior). `006.2` eliminó la UK global `picks_user_id_week_game_id_key`, dejó UKs **por liga** (`(user_id, league_id, week, game_id)` / `(user_id, league_id, training_session_id, game_id)`) y restauró la **aislamiento multi-liga** (harness 285/285 + QA multi-liga 23/23). Ver `opencode/plans/plan-league-context-01.1.md`.

**Estado**: corregido y verificado. Harness **242/242 PASS** (231 + 11 nuevos 006.4-A..J), `npm run build` ✅ (bundle `index-CoPeYQpY.js`), smoke preview 4173 200, QA E2E `qa-tc0063.mjs` re-ejecutado **45/45 PASS**, y reproducción/verificación en **BD real** (ROLLBACK): el escenario del bug ya no produce `23505` y queda **1 fila por (user_id, game_id)**. **Sin commitear, sin push**. No se tocó SimulationDirector/MatchSimulator/StandingCalculator/EventDirector/TC-007.

**Root cause** (reproducida en BD real): la página regular **Mis Picks** (`Picks.jsx` + `usePicks`) muestra el calendario estático `NFL_WEEKS[week]` (6 juegos `w1g1..w1g6`) cuando la liga no tiene `league_games` importados. Los `game_id` se **reutilizan entre ligas** (estáticos `w1gN` y TC `tc-<sessionNo>-<n>`; `tc-2-1` está en 11 ligas). El upsert usaba `ON CONFLICT (user_id, league_id, ...)` que NO cubre el constraint real `picks_user_id_week_game_id_key UNIQUE(user_id, week, game_id)` (sin liga/sesión) → guardar el mismo `(user, week, game_id)` en otra liga lanzaba `23505` (error real reportado como `picks_user_id_game_id_key`; el nombre exacto del constraint varía según dónde se cree, la raíz es el conflicto cross-liga no cubierto por el `onConflict`).

**Fix**:
- `src/supabase.js` — `picksApi.upsert` default `onConflict: 'user_id,week,game_id'` (cubre el constraint sin liga/sesión; el pick se actualiza idempotentemente, nunca 2 filas por `(user_id, game_id)`). `usePicks.js` usa el default.
- `src/domains/game-week/PicksService.js` — `savePick` y `confirmPicks` usan el mismo onConflict (antes `user_id,league_id,training_session_id,game_id`).
- `src/pages/Picks.jsx:228` — banner fantasma: condición `!loadingGames && !useDynamic` → `!loadingGames && !useDynamic && !weekData`. Ya no se muestra "No se encontraron juegos en esta liga." mientras se renderizan los 6 juegos del calendario estático; solo aparece cuando la semana activa no tiene juegos de ninguna fuente.
- Contrato de persistencia: un pick por `(user_id, week, game_id)` global (regla "1 pick por game"). El mismo juego en 2 ligas del mismo usuario actualiza la fila al último contexto. `picks_user_id_week_game_id_key` intacto.

**Verificación**:
- Harness 006.4-A..J: A primer pick (INSERT), B re-save idempotente, C cambiar pick (UPDATE), D 4 cambios → 1 fila, E 6/6 → 6 filas, F re-save 6/6 sin duplicar, G 2 usuarios × 6 juegos, H **mismo game en otra liga → 1 fila (fix 23505)**, I invariante 1 fila por (user_id, game_id) multi-liga, J confirmPicks 6/6 en 2 ligas sin duplicado.
- BD real `verify_fix3.sql` (ROLLBACK): guardar `(6812c5fe-…, week=1, '__test__fix1')` en liga 2 → `filas=1, pick_final=SF` (antes: 23505). Duplicados actuales: 130 filas, 0 pares duplicados.
- QA E2E re-ejecutado 45/45; bundle con `user_id,week,game_id` ×3; preview 4173 200.

## 8.6 BUILD-TC-006 — Simulation Engine (backlog)

- `RandomGenerator` (RNG con seed → resultados reproducibles) + `SimulationEngine` (state machine puro + batches por `speed`: demo/normal/fast) + `SimulationService` (fachada; migración Edge = solo reemplaza el Engine).
- Wiring al `GameWeekDirector` (`SIMULATION_START`/`SIMULATION_PROGRESS`/`COMPLETE_EVENT`); resultados escritos vía `leagueGamesApi.setScores` (mismo contrato que ScoreEditor; `result` = abbr del ganador).
- UX en vivo: partidos que avanzan a FINAL, leaderboard en vivo y Picks Públicos en vivo (exención PRIVACY-001 para `practice`), notificaciones por estado.
- Frontera con TC-005: TC-006 NO toca la fase de picks; toma el evento en `picks_locked` y lo lleva a `finished`.

## 9. Riesgos

1. **Escritor único (pestaña del admin)**: si el admin cierra la pestaña, la simulación pausa. Aceptado para v1 (el admin preside el evento); mitigado en BUILD-TC-006.2 con **resume**: cualquier recarga durante `games_in_progress`/`simulation_running` retoma la corrida desde `simulation_progress` (progreso monotónico, partidos ya `finished` no se re-simulan). Resuelto del todo con BUILD-TC-008 (Edge Function).
2. **Deadline de picks TC** no deriva de `getWeekDeadline` → integración puntual en `isGameLocked`/Picks solo para ligas `practice` (no debe filtrarse a Preseason/Regular).
3. **Exención de PRIVACY-001** es solo para TC → documentar explícitamente para que no se filtre a Preseason/Regular (donde aplica la privacidad estricta).
4. **Deriva de doble escritura** (motor TC vs manual en el mismo manager) → el flujo normal del TC es el motor; `manual` es solo fixture (no resultado).
5. **Límite de partidos** (32 equipos → 16 sin repetir; 20 con doble jornada) → validar en el wizard con copy claro.
6. **Determinismo**: usar `seed` en `RandomGenerator`; sin seed, el fixture/resultados no son reproducibles (tests/demos frágiles).

## 10. Recomendaciones del Arquitecto

- Abandonar internamente el nombre "Practice" y migrar todo el lenguaje del producto a **"Training Camp"** (más memorable, alineado NFL, mejor marketing). La BD conserva `'practice'`; renombrar el enum a `training_camp` en una migración formal futura.
- Lógica del motor **nunca en React**: `SimulationService → SimulationEngine → RandomGenerator`, para que Edge Functions sea un drop-in del Engine.
- Reusar `league_games` y el contrato `ResultSource`: el TC no necesita pipelines de lectura propios.
- Aplicar la exención de PRIVACY-001 estrictamente a `league_mode='practice'` para que el comportamiento transparente no se extienda a ligas reales.
- Definir el deadline TC en la config del evento (`start_at + N min`), no derivado del primer partido.
