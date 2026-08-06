# PLAN-005 — Training Camp Experience (🎓)

**Estado**: Diseño aprobado (2026-08-04) y **en implementación (BUILD-TC-001 ✅, TC-002 ✅, TC-003 ✅; sin commitear)**. Los BUILD que ya tienen § propio marcan su alcance entregado; el resto queda como diseño pendiente de implementar.

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

El wizard de creación de experiencia (PLAN-004, BUILD-004.3) es quien abre el TC; el TC agrega estos 4 pasos como configuración del evento. **BUILD-TC-002 ya implementa el wizard de experiencias** (`ExperienceWizard`): el paso 3 (cantidad de partidos) y 4 (velocidad) hoy viven en el nivel Custom del formulario de configuración; el `fixture_mode` queda fijo en `auto` hasta BUILD-TC-004 (Fixture Generator).

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
| **TC-004** | **Fixture Generator** (auto/manual): al llegar `training_started` genera los enfrentamientos en `league_games` | Fixture listo en `picks_open` |
| **TC-005** | **Simulation Engine** v1 (cliente): `SimulationService` → `SimulationEngine` → `RandomGenerator` (seed) | Resultados generados y reproducibles |
| **TC-006** | **Resultados/UX live**: partidos animados, `simulation_running`, leaderboard en vivo + Picks Públicos en vivo (exención PRIVACY-001) + dashboard card de estado | Experiencia completa en vivo |
| **TC-007** | **Graduación**: champion 🏆, leaderboard final, resumen del evento, "Crear otro Training Camp" | Cierre del ciclo educativo |
| **TC-008** (futuro) | Edge Function (solo reemplaza Engine) + realtime + fixtures manuales pulidos | Evento sobrevive al cierre de la pestaña admin |

Dependencias: TC-001/TC-002 adelantan parte del wizard de experiencia de PLAN-004 (BUILD-004.3); los pasos Preseason/Regular del wizard crean ligas con el flujo actual (`createLeague`). TC-003 sienta el contrato que TC-004/TC-005 conectan al Director; el Dashboard solo conoce `EventDirector` (steps + dispatch), nunca el motor.

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

## 9. Riesgos

1. **Escritor único (pestaña del admin)**: si el admin cierra la pestaña, la simulación pausa. Aceptado para v1 (el admin preside el evento); resuelto con BUILD-TC-006.
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
