# GameGuru — Blueprint de cambios

## Experiencias oficiales (referencias)

GameGuru ofrece 3 experiencias, cada una con su documento de referencia oficial:

| Experiencia | Modo BD | Documento |
|---|---|---|
| 🎓 Training Camp | `practice` | [`opencode/plans/training-camp.md`](training-camp.md) — evento simulado automáticamente (PLAN-005) |
| 🏈 Pretemporada | `preseason` | [`opencode/plans/preseason.md`](preseason.md) — liga exclusiva de calendario oficial |
| 🏆 Temporada Oficial | `regular` | [`opencode/plans/regular-season.md`](regular-season.md) — la experiencia completa |

- "Liga" en la UI; "experiencia" solo dentro del wizard.
- **PRIVACY-001** (picks privados hasta el cierre) aplica a Pretemporada y Temporada; **Training Camp está exento** (objetivo educativo, transparencia en vivo).
- Roadmaps independientes: **BUILD-TC-\*** (Training Camp), **BUILD-PS-\*** (Pretemporada), **BUILD-RS-\*** (Temporada).

### Identidad visual por experiencia (decisión 2026-08-04)

Cada experiencia tiene **identidad visual propia**, no solo un badge. El usuario debe saber en qué experiencia está **con solo abrir una liga**.

| Experiencia | Color | Token CSS | Ícono | Banner | Tono de mensajes |
|---|---|---|---|---|---|
| 🎓 Training Camp | Azul `#3B82F6` | `--mode-tc` | 🎓 | "Training Camp" | Aprendizaje, primeros pasos, bienvenida |
| 🏈 Preseason | Teal `#14B8A6` | `--mode-ps` | 🏈 | "Pretemporada" | Puesta a punto, calendario oficial |
| 🏆 Temporada Oficial | Dorado `#F5A623` (accent del producto) | `--mode-rs` | 🏆 | "Temporada Oficial" | La experiencia completa |

Cada modo aplica: **color distintivo** (tokens `--mode-*` en `global.css`), **ícono propio**, **banner específico** en el header de la liga/dashboard (fondo/gradiente del color del modo), y **mensajes adaptados** (i18n `modes.*`) en wizard, dashboard, notificaciones y Activity Feed.

**Pendiente de refinamiento visual** (paleta final a validar en implementación). Se materializa en BUILD-004.2 (badges + color/ícono/banner en dashboard/summary) y se extiende en BUILD-TC-001 (banner y mensajes del evento Training Camp).

## Eliminación del modo "Juego por juego"

### Archivos modificados

#### `src/components/CreateLeagueModal.jsx`
- Eliminado estado `deadlineMode`
- Eliminado parámetro `deadlineMode` del llamado a `onCreateLeague`
- Eliminado bloque UI "Modo de cierre" (selector semanal vs juego por juego)

#### `src/hooks/useLeague.js`
- `createLeague`: eliminado parámetro `deadlineMode`, hardcodeado `deadline_mode: 'weekly'`
- `createSimulationLeague`: cambiado `deadline_mode: 'game_by_game'` → `'weekly'`

#### `src/pages/Picks.jsx`
- Eliminada variable `deadlineMode`
- Eliminada función `gameDeadline`
- `isGameLocked` simplificado: solo verifica `g.finished || isWeekLocked`
- Eliminadas variables de conteo específicas de game_by_game (`lockedGames`, `unlockedGames`, etc.)
- `handleSubmit` simplificado, sin `partial`
- Eliminados badges y lock-notices condicionales de game_by_game

#### `src/hooks/usePicks.js`
- `submitPicks`: eliminado parámetro `partial`, siempre requiere todos los picks

#### `src/pages/PublicPicks.jsx`
- Cambiado de bloqueo por-juego a bloqueo semanal (1h antes del primer partido de la semana)
- Nuevas funciones: `getWeekDeadline()`, `isGameLocked(game, weekGames)`
- `weeksWithLocked` ahora usa `weekList.filter()` en lugar de Set

---

## Auto-selección de última semana disponible

### Archivo modificado

#### `src/pages/Picks.jsx`
- `activeWeek` inicializado con lazy initializer desde `NFL_WEEKS` (última semana disponible)
- Nuevo `useEffect` que sincroniza `activeWeek` a la última semana disponible cuando cargan datos dinámicos desde Supabase

---

## Bloqueo por tiempo real (no por envío)

### Archivo modificado

#### `src/pages/Picks.jsx`
- `isGameLocked` ya no usa `submitted`. Ahora computa `getWeekDeadline(weekGames)` que encuentra el primer partido de la semana y resta 1 hora
- Nueva variable `isWeekLocked`: `weekData?.finished || (weekDeadline ? new Date() >= weekDeadline : false)`
- Submit bar visible hasta `isWeekLocked` (no hasta `weekData.finished`)
- Botón de submit ya no se deshabilita por `submitted`, permitiendo re-guardar picks
- Nuevo lock-notice: "Hora límite alcanzada — los picks están bloqueados"

---

## Picks Públicos: solo desde dentro de páginas (no nav)

### Archivos modificados

#### `src/components/Topbar.jsx`
- Eliminado `{ id: 'publicpicks', label: 'P. Públicos' }` del nav

#### `src/components/BottomNav.jsx`
- Eliminado `{ id: 'publicpicks', label: 'P. Públicos', icon: '👁️' }` del nav

#### `src/pages/Picks.jsx`
- Agregado botón "👁️ Ver Picks Públicos de esta semana" cuando `isWeekLocked === true`
- Recibe `onNavigate` via props

#### `src/pages/Leaderboard.jsx`
- Agregadas funciones `getWeekDeadline()` e `isWeekLocked()` (misma lógica que Picks)
- Nuevo estado `lockedWeeks` calculado en `loadStandings`
- Botón "👁️ Ver Picks Públicos" visible cuando la semana activa está en `lockedWeeks`

---

## Inputs de score más grandes

### Archivo modificado

#### `src/components/LeagueGamesManager.module.css`
- `.scoreInput`: width `1.8rem` → `3.2rem`, padding aumentado, font-size `0.75rem` → `1.05rem`
- `.scoreForm`: gap `2px` → `6px`
- Nuevo `.scoreForm .vs` con font-size `1.1rem` y font-weight `700`
- `.saveScoreBtn` / `.cancelScoreBtn`: padding y font-size aumentados
- Agregados estados `:focus` (borde accent) y `:hover` (opacidad)
- Eliminado bloque `@media (min-width: 480px)` para score inputs

---

## Bugs corregidos

### `PublicPicks.jsx` — Temporal Dead Zone
- `weeksWithLocked` usaba `weekList` antes de su declaración `const`
- Fix: reordenar `weekList` y `weeksWithGames` antes de `weeksWithLocked`

---

## BUILD-001 — Preparación de arquitectura del nuevo Dashboard

Refactor arquitectónico sin cambios visuales ni funcionales. Base para PLAN-001.

### Nuevos archivos
- `src/utils/dates.js` — `getWeekDeadline`, `isWeekLocked`, `isGameLocked`, `localTZOffset`
- `src/utils/standings.js` — `calcStandings`
- `src/domains/sports/` — esqueleto desacoplado (Provider → Adapter → Repository → Service) con stubs sin integración real:
  - `models/index.js` (`normalizeScoreboard`, `normalizeNews`)
  - `providers/espn.js` (`espnProvider` stub)
  - `adapters/index.js` (`mapProviderGame` stub)
  - `repositories/sportsRepository.js` (interfaz: `getScoreboard`, `getNews`, `getTeamStandings`)
  - `services/sportsService.js` (fachada)
  - `index.js` (barrel)
- `src/domains/dashboard/` — dominio dashboard:
  - `hooks/useLeagueData.js` (fetch `league_games` + loading + refresh)
  - `hooks/useDashboardData.js` (composer futuro, aún no conectado a UI)
  - `components/NewUserHome.jsx`, `components/LeaguesOverview.jsx`, `components/LeagueDashboard.jsx` (JSX movido desde `Home.jsx`, usan `pages/Home.module.css`)
  - `index.js` (barrel)

### Archivos modificados
- `src/pages/Home.jsx` → compositor delgado (3 sub-componentes movidos a `domains/dashboard/components/`)
- `src/pages/Leaderboard.jsx` → importa `isWeekLocked` de `utils/dates` y `calcStandings` de `utils/standings` (eliminados helpers inline)
- `src/pages/PublicPicks.jsx` → importa `isGameLocked` de `utils/dates`
- `src/pages/Picks.jsx` → usa `isWeekLocked`/`isGameLocked` de `utils/dates`; `weekLocked` reemplaza la variable inline
- `src/hooks/useLeague.js` → usa `localTZOffset` de `utils/dates` (eliminado helper local)
- `src/components/LeagueGamesManager.jsx` → usa `localTZOffset` de `utils/dates`
- `gameguru.md` → nueva sección "Arquitectura orientada a dominios" + estrategia de migración

### Notas y riesgos
- **Picks.jsx tenía cambios sin commitear** (resaltado del ganador en el export de auditoría); se preservaron intactos en el refactor.
- Semántica de `isWeekLocked`: cada llamador sigue pasando su propio array de juegos (Picks/PublicPicks filtran `active`; Leaderboard no). El util es una función pura, por lo que el comportamiento previo se mantiene por llamador. Pendiente de unificar (excluir juegos inactivos del deadline en todos lados).
- Sin lint configurado en el proyecto; la verificación es `npm run build`.
- La capa `sports` es solo esqueleto: cualquier llamada devuelve `null` hasta la Fase 2 de PLAN-001.

---

## BUILD-002 — MVP del nuevo Home Dashboard (Fase 1 de PLAN-001)

Dashboard 100% con datos de Supabase (sin APIs externas). Mobile First. Cierra la Fase 1 de la estrategia de migración.

### Nuevos archivos
- `src/domains/dashboard/dashboard.module.css` — CSS module propio de los módulos del dashboard (tokens reutilizados de `global.css`)
- `src/domains/dashboard/components/`:
  - `DashboardHeader.jsx` — saludo con username (perfil), "Estás en {n} ligas", badge de semana
  - `PendingActionCard.jsx` — CTA "Te faltan {n} picks" / "Picks completos 🎉" / bloqueado
  - `CountdownCard.jsx` — cuenta regresiva al deadline (`Faltan 2 h 18 min`), refresca cada 30s, `useNow` interno
  - `GamesCarousel.jsx` — carrusel horizontal con `TeamLogo` + `GameTime` + estado (FINAL/Cerrado/Abierto)
  - `LeaguesSummary.jsx` — "Mis ligas" compacto: ícono, nombre, código, miembros, badges Admin/Sim/Actual; toca para cambiar de liga
  - `QuickStats.jsx` — 4 tarjetas: posición, aciertos, pendientes, racha
  - `MiniLeaderboard.jsx` — Top 3 con medallas 🥇🥈🥉 + botón "Ver clasificación completa"
  - `UpcomingGamesList.jsx` — próximos partidos no finalizados

### Archivos modificados
- `src/domains/dashboard/hooks/useDashboardData.js` → reescrito como **DashboardState**: composer que desacopla la UI de las fuentes de datos. Deriva:
  - perfil (`profilesApi.get`), semana actual (primera con deadline abierto), `weekGames`, `deadline` (`getWeekDeadline`), `locked` (`isWeekLocked`)
  - picks del usuario + standings de la semana (`picksApi` + `calcStandings` + `profilesApi.getMany`)
  - racha (semanas consecutivas hacia atrás con ≥1 acierto, vía `getAllForLeague`)
  - conteo de miembros por liga (`leaguesApi.getMembers`)
  - `dayGames` (hoy), `upcomingGames` (futuros no finalizados)
- `src/domains/dashboard/hooks/useLeagueData.js` → `loadingGames` inicial `true` (evita flash de estado vacío)
- `src/domains/dashboard/components/LeagueDashboard.jsx` → reescrito: compone los 8 módulos; conserva invite-box + CTAs de admin al pie (solo admin); estados loading y empty ("Aún no hay actividad")
- `src/pages/Home.jsx` → pasa `myLeagues` y `onEnterLeague` a `LeagueDashboard` (para Mis ligas compacto)
- `src/pages/Home.module.css` → nuevo `.simTag` (badge de simulación reutilizable)
- `src/i18n/es.js` / `en.js` → nueva sección `dashboard.*` (38 claves, con vars `{name}`, `{n}`, `{week}`, `{time}`)

### Verificación
- `npm run build` ✅ (127 módulos, sin errores; warning chunk >500 kB pre-existente).

### Notas y riesgos
- **`game_time` legacy**: los módulos que requieren fecha parseable (`CountdownCard`, "Juegos del día", `UpcomingGamesList`) quedan vacíos con el calendario maestro actual (`Dom 1:00 PM`). El carrusel cae a "Partidos de la Semana {week}" para no quedar vacío. Se resuelve en Fase 2 con horarios ISO reales.
- **Racha**: solo cuenta semanas con resultados; si una semana finalizada quedó sin aciertos, se corta.
- **Top 3** usa standings parciales de la semana (juegos con resultado ya ingresados).
- Pendiente de decisión (fuera de BUILD-002): modo de deploy y limpieza del `.env` commiteado.

---

## BUILD-002.1 — Unificar Home y Dashboard (Experiencia Fantasy First)

Elimina la separación conceptual entre `NewUserHome`, `LeaguesOverview` y `LeagueDashboard`. **Home = Dashboard**: el dashboard siempre existe y solo cambian las tarjetas según el estado del usuario. Nunca cambia completamente de pantalla.

### Filosofía
- Un único `<HomeDashboard />` renderiza módulos según el **DashboardState** centralizado en `useDashboardData`.
- Cada módulo decide internamente si mostrarse (flags `showWelcome`, `showLeagueSummary`, `showPendingAction`, `showLeaderboard`, `showCountdown`).
- Tres estados:
  1. **Sin ligas** → Header (badge "Temporada 2026") + `HeroCard` + `GamesCarousel` (juegos de la semana desde `master_games`) + `HowItWorks` + `UpcomingGamesList` + CTA "Comienza ahora".
  2. **Con ligas, ninguna activa** → usa la **primera liga como contexto** (`contextLeague`): Header + `LeaguesSummary` + `PendingActionCard` + `GamesCarousel` + `QuickStats` + `MiniLeaderboard` + `UpcomingGamesList`.
  3. **Liga activa** → dashboard completo de BUILD-002 (agrega `CountdownCard`, Mis ligas con badge "Actual", invite-box + CTAs de admin al pie).

### Nuevos archivos
- `src/domains/dashboard/components/HomeDashboard.jsx` — compositor único de los 3 estados
- `src/domains/dashboard/components/HeroCard.jsx` — bienvenida (reutiliza claves `home.*`)
- `src/domains/dashboard/components/HowItWorks.jsx` — 3 tarjetas (reutiliza claves `home.feature*`)

### Archivos modificados
- `src/domains/dashboard/hooks/useDashboardData.js` → reescrito: `contextLeague = currentLeague || leagues[0] || null`; agrega fetch de `master_games` cuando no hay contexto de liga; expone flags de estado + `hasWeekGames`
- `src/domains/dashboard/components/LeaguesSummary.jsx` → agrega `user` + `onDeleteLeague` (delete para admin de liga no-actual, preserva funcionalidad de `LeaguesOverview`)
- `src/domains/dashboard/components/DashboardHeader.jsx` → props `badge`/`sub` (override para el estado de bienvenida)
- `src/domains/dashboard/dashboard.module.css` → estilos `.heroCard`, `.features`, `.leagueMiniDelete`
- `src/utils/dates.js` → nuevo `getCurrentWeek(games)` (primera semana con deadline abierto)
- `src/pages/Home.jsx` → thin: solo loading + `<HomeDashboard {...props} />` (eliminada la ramificación de 3 vistas)
- `src/i18n/es.js` / `en.js` → claves `dashboard.welcomeSub`, `dashboard.howItWorks`, `dashboard.startNow`

### Verificación
- `npm run build` ✅ (127 módulos, sin errores).
- Pendiente de verificación manual por parte del usuario: 3 escenarios (usuario nuevo / con ligas / con liga activa).

### Notas
- `NewUserHome`, `LeaguesOverview` y `LeagueDashboard` quedan como componentes legacy exportados (no los usa Home); su contenido se reutiliza vía `HeroCard`, `HowItWorks` y `LeaguesSummary`.
- El calendario maestro usa `DateUtc` ISO, por lo que countdown/juegos de hoy/próximos funcionan con fechas reales.

---

## PRIVACY-001 — Picks privados hasta el cierre

**Principio**: los picks individuales son privados hasta que la semana se bloquea. El dashboard solo muestra métricas agregadas/anónimas; el progreso semanal usa porcentajes/contadores, nunca identidades. Los admins incentivan con recordatorios, no con vigilancia.

### Auditoría previa (conforme sin cambios)
- `PublicPicks` muestra solo `lockedGames`; `Leaderboard` solo con juegos finalizados; export auditoría gated con `weekLocked`; `LeagueGamesManager`/`LeaguePage`/`InviteModal` sin info de picks.

### Nuevos archivos
- `src/domains/dashboard/components/CopyReminder.jsx` — botón admin que copia un recordatorio localizado (liga, semana, hora de cierre). Sin identidades ni progreso.

### Archivos modificados
- `src/domains/dashboard/hooks/useDashboardData.js`:
  - `lastLockedWeek` = semana más reciente con `isWeekLocked` (deadline vencido o finalizada). Los standings/posiciones se calculan solo de esa semana → nunca se agregan picks pre-cierre.
  - `participation` = `{ submitted, total }` anónimo (distinct `user_id` de la semana abierta ÷ miembros), solo si `isContextAdmin` y semana abierta.
  - `getForWeek` (picks propios) sin cambios.
- `src/domains/dashboard/components/LeagueDashboard.jsx` → renderiza `.participationBar` (admin) y `CopyReminder` en los accesos rápidos (solo `!locked`); pasa `week={lastLockedWeek}` a `MiniLeaderboard`.
- `src/domains/dashboard/components/MiniLeaderboard.jsx` → prop opcional `week` para título "Top — Semana {week}".
- `src/domains/dashboard/dashboard.module.css` → `.participationBar`.
- `src/i18n/es.js` / `en.js` → `dashboard.copyReminder`, `reminderCopied`, `reminderText`, `adminParticipation`, `top3Week`.

### Decisiones (elegidas por el usuario)
- Recordatorio: solo admin, en el dashboard.
- MiniLeaderboard: muestra la **última semana bloqueada** (antes quedaba vacío con la semana abierta).
- Contador anónimo de participación para admin: **sí** (porcentaje/contador sin nombres).

### Verificación
- `npm run build` ✅ (127 módulos).
- Manual: sim con admin → contador "n de total" + recordatorio; MiniLeaderboard con la semana cerrada; sin datos individuales pre-cierre.

---

## PLAN-003 — Rediseño UX de captura de resultados

Diseño + implementación de la captura de scores en `LeagueGamesManager`. Detalle completo en `opencode/plans/PLAN-003.md`.

### Decisión (elegida por el usuario)
- **Opción A: fila expandida** — al editar, la fila se expande con columnas Visitante/Local y barra Guardar/Cancelar full-width.
- i18n solo en el editor (`manager.*`).

### Nuevos archivos
- `src/components/ScoreEditor.jsx` + `ScoreEditor.module.css` — editor universal y deporte-agnóstico (NFL/MLB/NBA): estado interno de inputs, autofocus, Enter/Esc, barra de acciones full-width.

### Archivos modificados
- `src/components/LeagueGamesManager.jsx` → eliminados estado `homeScore`/`awayScore` y `handleOpenResult`; `handleSetScores(game, awayValue, homeValue)` cambia de firma (persistencia, validación y mensajes idénticos); render condicional `editing` con `editMeta` + `ScoreEditor`.
- `src/components/LeagueGamesManager.module.css` → nuevos `.gameRow.editing` y `.editMeta`; eliminados `.scoreForm`, `.scoreInput`, `.saveScoreBtn`, `.cancelScoreBtn`.
- `src/i18n/es.js` / `en.js` → sección `manager.*` (`away`, `home`, `save`, `cancel`).

### Verificación
- `npm run build` ✅ (130 módulos, warning chunk >500 kB pre-existente).
- Manual pendiente: guardar nuevo / editar existente (pre-fill) / cancelar / toggle, en móvil.

---

## PLAN-004 — Sistema de Temporadas (Practice / Preseason / Regular)

**Diseño aprobado, SIN implementar** (solo arquitectura y documentación; no se tocó código, BD ni componentes). Detalle completo en `opencode/plans/PLAN-004.md`.

### Decisión (elegida por el usuario)
- `league_mode` ('practice'|'preseason'|'regular') + `season` en `leagues`; `phase` ('preseason'|'regular'|'postseason') en `master_games`.
- **Contingencia sin doble fuente de verdad**: captura manual en oficiales SOLO con provider offline + aviso ⚠; con provider online → "Editar resultado" deshabilitado.
- "Liga" en UI; "experiencia" solo en el wizard.
- Práctica: switch `Equipos NFL / Personalizado`.
- Backfill SQL manual (no migración formal).

### Entregables del plan
Modelo de datos, wireframes del wizard (3 pasos con cards), matriz de comportamiento por modo, flujo provider (Provider→Adapter→Repository→Service con `syncSeason`), estrategia de migración, UX (`ExperiencePicker` + badges de modo), roadmap BUILD-004.1→004.8, riesgos y recomendaciones.

---

## PLAN-004.1 — Persistencia del Sistema de Temporadas (BUILD-004.1)

Modelo de datos + dominio listos para soportar las 3 experiencias. Sin cambios visuales; sin tocar componentes de UI.

### Campos nuevos
- `leagues.league_mode` (text, CHECK `practice|preseason|regular`, default `'regular'`).
- `leagues.season` (text, default `'2026'`).
- `master_games.phase` (text, CHECK `preseason|regular|postseason`, default `'regular'`).

### Decisión: `league_mode` (vs `experience_mode` / `season_mode`)
`league_mode` es un enum estable de la liga (extensible a múltiples deportes/años). `experience_mode` es concepto UX (no un dato). `season_mode` implica que cambia por temporada; la decisión es de la liga.

### Script de migración
`supabase/004.1-season-system.sql` — DDL (`ADD COLUMN IF NOT EXISTS`) + check constraints + índices + backfill idempotente (`simulation=true→practice`, `false→regular`). **Manual**: ejecutar en SQL Editor de Supabase, no forma parte del deploy de la app.

### Dominio
- `src/domains/league/models/modes.js` — `LEAGUE_MODES`, `getLeagueMode(league)` (con fallback a `simulation`), `getLeagueSeason(league)`.
- `src/domains/league/models/seasons.js` — `SEASONS`, `providerAvailable(sport, season, phase)`.
- `src/domains/league/services/leagueService.js` — `hydrateLeague(league)`.
- `src/hooks/useLeague.js` — `fetchMyLeagues` ya hidrata con `hydrateLeague` (aditivo, sin cambiar comportamiento).

### Compatibilidad
Funciona ANTES del script (fallback a `simulation`) y DESPUÉS (lee `league_mode`). No se tocaron Dashboard, LeagueGamesManager ni CreateLeagueModal.

---

## PLAN-005 — Training Camp Experience (🎓)

**Diseño aprobado, en implementación (BUILD-TC-001 Lobby ✅ + BUILD-TC-002 Experience Picker/Entrada oficial ✅ + BUILD-TC-003 Event Director ✅ + BUILD-TC-004 Fixture Generation ✅ + BUILD-TC-004.2 Estabilización/migración ✅ + BUILD-TC-005 Game Week & Picks ✅ + BUILD-TC-005.1 Persistencia modo nube ✅ + BUILD-TC-005.3 QA end-to-end desbloqueado ✅; hito TC-005 commiteado `7cb799a`, cambios TC-005.3 sin commitear).** Detalle completo en `opencode/plans/training-camp.md`.

### Decisiones (elegidas por el usuario)
- **Training Camp es un EVENTO, no una liga**: se mantienen los **9 estados** (`created → waiting_players → countdown → training_started → picks_open → picks_locked → games_in_progress → simulation_running → finished` + `cancelled`); cada estado es una experiencia distinta para Dashboard, notificaciones y Activity Feed.
- **Exención de PRIVACY-001 solo en TC**: leaderboard y picks públicos en vivo (objetivo educativo). Preseason/Regular conservan la privacidad estricta.
- **Event Director** (TC-003): el director **coordina, no genera** — contrato `EventDirector` + `TrainingCampDirector`; la UI solo conoce el contrato.
- **Fixture Generation** (TC-004): evento `fixture_generation` con `FixtureGenerationDirector` + `FixtureGeneratorService` (sin React) + `fixtureCalendar` (RNG seed, rondas round-robin); se dispara al finalizar la sesión TC y persiste en `league_games` con progreso visible (`currentStep`/`lastCompletedStep` + barra `fixture_progress`).
- **Game Week & Picks** (TC-005, implementado 2026-08-05; **validado en modo nube 2026-08-07**, BUILD-TC-005.1; **QA end-to-end 2026-08-08**, BUILD-TC-005.3): evento `game_week` (3er director) + tablas `game_weeks`/`pick_submissions` (**SQL 005.2 aplicado**; Fix A: `UNIQUE` constraint para upsert) + `picksService`/`useGameWeek` + vista de jornada (selección, pendientes, confirmación, bloqueo hasta `picks_locked`). Ventana de picks por nivel (`resolveConfig`); deadline = `start_at + N`, bloqueo por deadline/todos confirmaron/admin. Fix B: `GameWeekContext` carga la sesión FG (`trainingSessionsApi.list` con `event_type`) para enlazar los partidos generados. **BUILD-TC-005.3**: acción admin `ADVANCE_EVENT` (idempotente) que completa el TC al instante y dispara FG → GW → Picks, panel admin en el lobby, UX activa del estado START ("Training Camp is live" + elapsed), saneamiento de parches a la nube (`toCloudPatch` excluye campos internos/QA sin columna: `__`-prefijo, `finished_reason`, `locked_at`, `lock_reason`) y favicon. QA browser real 43/43 con 0 errores consola/red.
- **Simulation Engine v1 — núcleo** (TC-006.1, implementado 2026-08-08, sin UX): lógica aislada de React en `src/domains/simulation/` → `SimulationDirector` (máquina INTERNA de la corrida: `waiting → simulating → persisting_results → updating_standings → completed`, persistida en `game_weeks.simulation_progress`) → `MatchSimulator` (RNG `mulberry32(seed+index)`, mismo contrato que fixtureCalendar, resultados reproducibles) → `StandingsCalculator` (standings por usuario, puro) orquestados por `SimulationService` (fachada sin React: `start`/`runBatch`/`finalize`, escribe SOLO en `league_games` vía `setScores`, nunca en picks, degrada a localStorage `gameguru.sim.<weekId>`). Edge Functions futuras solo reemplazan el motor; la máquina pública del evento vive en `GameWeekDirector` (`picks_locked → games_in_progress → simulation_running → completed`). Migración `supabase/006.1-simulation.sql` (idempotente; **aplicada en la nube en TC-006.3** vía Management API). Regresión 140/140 + build ✅.
- **Simulation Engine v1 — orquestación** (TC-006.2, implementado 2026-08-08): `useTrainingSession` dispara la corrida automáticamente al quedar la jornada `picks_locked` y la lleva a `completed` (jornada) + `finished` (sesión). Guard `simGuardRef` por id de jornada (StrictMode/ticks no duplican), resume tras reload leyendo `simulation_progress`, batches deterministas por `speed` (`demo→1/normal→3/fast→5`), `runFinalize` con `listSessionGames` + `getConfirmedPicks` + `membersRef`/`profilesRef` → standings + `finished`. Refactor compartido: `GameWeekService.listSessionGames`/`sessionGameMatch` (RAW rows) y `GameWeekContext.isCompleted` incluye `finished`. Fix `GameWeekDirector.getCurrentStep` (alias `finished→completed`, evitaba retroceder a `waiting`). Regresión **187/187** + build ✅.
- **Simulation Engine v1 — UX en vivo + cierre en la nube** (TC-006.3, implementado 2026-08-08): UX sobre el motor — `GameWeekView` en `games_in_progress`/`simulation_running` muestra `SimulationProgress` (status + barra + %) y en `completed`/`finished` muestra `GameWeekResults` (scores FINAL, "Your picks: correct/total", draw) + `GameWeekLeaderboard` (rank/player/correct/total/pts) + banner; dominio puro en `src/domains/game-week/simulationView.js` (`getSimulationRun`/`buildResultsView`/`sortStandings`/`buildLeaderboard`/`canRevealPicks`/`buildPickFeedback`); `GameWeekContext` expone `isSimulating`/`simRun`/`resultsMap`/`standings`/`allPicks`; picks públicos en vivo con exención PRIVACY-001 para `practice` (policy vía `modes.js`, sin hardcodear). **Cierre en la nube**: migración `006.1` APLICADA vía Management API (token de gnome-keyring; PATCH `game_weeks` → 200, antes 400 por columnas ausentes) + NUEVA `supabase/006.1b-league-games-update.sql` (política `lg_update`: UPDATE de `league_games` por membresía, no solo admin — la simulación se orquesta desde el miembro que dispara el lock). Fixes de bugs reales: `SimulationDirector` null-safe (`defaultRun(null)`/`getSimulationState(null)` → waiting) y `useTrainingSession.participants` expone `id` (`user_id` → no colapsa el leaderboard). QA browser real **45/45** (0 errores consola/red, resume 3/10, sin re-simulación, integridad de red) + regresión **231/231** + build ✅ (bundle `index-DwdsI9lI.js`).
- **Fixture Mode** (TC-004): `auto` (genera enfrentamientos) | `manual` (reutiliza el constructor de partidos).
- **Training Session** como entidad independiente 1:N-ready (`session_no`), temporalmente 1:1 por liga; internamente "Training Session", visible "Training Camp".
- El nombre "Practice" se abandona en el lenguaje de producto; la BD conserva `'practice'` (sin migración).

### Entregables del plan
Modelo de datos (`training_sessions` 1:N-ready con `leagues`: `session_no`, `start_at`, `game_count` 5/10/15/20, `speed` demo/normal/fast, `fixture_mode`, `state`, `seed`), contrato común `ResultSource` (Training vs Official Provider Engine), wizard del evento (con pantalla de confirmación), Event Director con `currentStep`/`lastCompletedStep`, UX en vivo (lobby, countdown, partidos animados, champion), roadmaps **BUILD-TC-001→008**, riesgos y recomendaciones.

---

## PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario

**Diseño aprobado 2026-08-08; BUILD-LEAGUE-CONTEXT-01 (Fases 1-3) implementado y verificado 2026-08-09.** Detalle completo en `opencode/plans/plan-league-context.md`.

### Decisión (elegida por el usuario)
- **URL hash `#/league/:leagueId/:view` como fuente de verdad** del contexto de liga (compatible GH Pages, sin react-router). `localStorage['gameguru.activeLeagueId']` es solo sugerencia/LAST KNOWN; la URL explícita manda siempre.
- RLS verificada en BD (Management API): `leagues` SELECT público + `league_members` SELECT total → la app distingue "liga inexistente" (NOT_FOUND) de "no sos miembro" (DENIED) sin revelar datos ajenos.

### Fases implementadas (BUILD-LEAGUE-CONTEXT-01)
- **Fase 1** — mini-router hash: `src/router/hashRouter.js` (`parseHash`/`buildHash`/`normalizeHash`), `src/router/routes.js` (helpers `league*Route`, `LEGACY_VIEW_MAP`, `LEGACY_REDIRECTABLE`, `resolveForView`, `navigate`), `src/router/useHashRoute.js` (hook `hashchange` StrictMode-safe).
- **Fase 2** — `src/league/activeLeagueStorage.js` (solo sugerencia), `src/league/context/leagueResolution.js` (puro: `computeRouteState` con estados LOADING/NOT_FOUND/DENIED/READY, `getActiveLeagueId`, `buildContextValue`), `src/league/context/LeagueContext.jsx` (Provider + `useLeagueContext`; resolución myLeagues fast path → `leaguesApi.getById` + `membersApi.getMembership` async para NOT_FOUND/DENIED; guard de UUID y de cancelación StrictMode). `leaguesApi.getById` + `membersApi.getMembership` en `src/supabase.js`.
- **Fase 3** — `src/league/LeagueRoute.jsx` (guard 4 estados READY/DENIED/NOT_FOUND/LOADING). `src/App.jsx` refactorizado en `AppInner` (auth + `useLeague`) + `AppShell` (dentro del Provider): rutas `#/league/:id[/page]` renderizan las páginas legacy con `league` de la URL y `key={leagueId}` (props intactas, sin migrarlas); redirects legacy SOLO para `LEGACY_REDIRECTABLE`; hub `#dashboard` → `Home`.

### Ajustes de alcance (detectados por QA)
- **`#training` excluido del auto-redirect** (`LEGACY_REDIRECTABLE` = picks/board/publicpicks/league): el lobby del Training Camp usa `currentLeague` + `lobbyVersion` + modal `initialName=currentLeague?.name` y remontarlo vía LeagueRoute rompía el resume de corrida inyectada (detectado por el E2E). Su migración es Fase 6.
- Hub por ruta: `#dashboard` renderiza `Home` (todas las ligas); las páginas legacy siguen con `activePage` cuando la ruta no es de liga.

### Verificación
- Harness **278/278** (36 tests nuevos LC-A..J: URL>persistencia, guard READY/DENIED/NOT_FOUND/LOADING, refresh round-trip, navegación A→B/B→A, persistencia al entrar, hub passthrough, redirects legacy + `training` excluido).
- QA E2E `qa-tc0063.mjs` **45/45** (TC/Game Week/Picks/Simulation intactos tras el refactor de App.jsx).
- QA nuevo `qa-league-smoke.mjs` **18/18** (rutas de liga reales: READY/refresh/picks/standings/NOT_FOUND/DENIED sin datos/redirect `#board`/hub/0 errores consola-red).
- `npm run build` ✅ (bundle `index-BHwUKh9w.js`).

### Pendiente (BUILD-LEAGUE-CONTEXT-02 en adelante)
Fases 4-8: LeagueSelector en Topbar/BottomNav, UX multi-liga (hub+auto-enter, selector inline en Standings/Picks, `?join=` consumido), migración LeaguePage/TrainingCamp a contexto de ruta y limpieza de huérfanos, rutas preseason/season, decisión de data model de picks. Sin commit, sin push.

---

## Estado actual (2026-08-04)

BUILD-001 ✅, BUILD-002 ✅, BUILD-002.1 ✅, PRIVACY-001 ✅, fix de navegación (nav siempre visible) ✅ y PLAN-003 (ScoreEditor) ✅ (código + docs + build). PLAN-004 (Sistema de Temporadas) en diseño ✅; BUILD-004.1 (modelo persistente + dominio) ✅. **PLAN-005 (Training Camp Experience): diseño ✅ + BUILD-TC-001 (Lobby) ✅ + BUILD-TC-002 (Experience Picker + entrada oficial) ✅ + BUILD-TC-003 (Event Director) ✅ + BUILD-TC-004 (Fixture Generation) ✅ + BUILD-TC-004.2 (Estabilización: migración aplicada + hardening defensivo) ✅ + BUILD-TC-005 (Game Week & Picks) ✅** — renaming "Practice"→"Training Camp", tabla `training_sessions` 1:N-ready (**SQL manual 005.1 EJECUTADO en TC-004.2**: `GET /rest/v1/training_sessions` 200 con anon key), dominio `src/domains/training/` (service/hook renombrados a sesiones), dominio `src/domains/event/` (EventDirector + TrainingCampDirector + FixtureGenerationDirector + FixtureGeneratorService), lobby con countdown/roster/estado + personalidad + estado vacío defensivo, persistencia con fallback a localStorage + logs descriptivos de Supabase. Evento fixture_generation al finalizar la sesión TC (progreso en el Lobby con currentStep/lastCompletedStep). **BUILD-TC-005 (Game Week & Picks) implementado (2026-08-05)**: dominio `src/domains/game-week/` (GameWeekDirector + GameWeekService + PicksService + GameWeekContext/useGameWeek + GameWeekView), contrato extendido (`EVENT_TYPES.GAME_WEEK` + `OPEN_WEEK`/`LOCK_PICKS`/`OPEN_NEXT_WEEK`), `gameWeeksApi`/`pickSubmissionsApi`/`picksApi` por sesión, spawn FG→GW + apertura de jornada en `useTrainingSession`, `FixtureGeneratorService` setea `training_session_id`, ventana de picks por nivel en `resolveConfig`, flujo jornada→picks→confirmación→bloqueo (deadline/todos confirmaron/admin) hasta `picks_locked`, `getConfirmedPicks` como punto de integración de TC-006. **BUILD-TC-005.1 (Persistencia en modo nube, 2026-08-07)**: migración `005.2` **ya aplicada** y verificada íntegra vía Management API; backfill `004.1` ejecutado (`leagues.league_mode/season` + `master_games.phase`); **Fix A** `picks_session_game_unique` (índice parcial → `UNIQUE CONSTRAINT` para que PostgREST acepte `on_conflict`); **Fix B** `GameWeekContext` enlaza los partidos de la sesión FG; E2E real 25/25 (perfil → liga → TC → FG → GW → picks → confirmación → lock → persistencia tras refresh → completed → delete cascade) + regresión 56/56 + `npm run build` + smoke. Verificado: harness node (57 checks) + regresión TC-004 (24) + TC-004.2 (18) + `npm run build` + smoke. **Hito TC-005 commiteado `7cb799a` (rama `development`, sin push). BUILD-TC-005.3 (QA end-to-end, 2026-08-08)**: `ADVANCE_EVENT` (admin advance idempotente) + panel admin + UX activa del START + saneamiento `toCloudPatch` (excluye `__week`/`finished_reason`/`locked_at`/`lock_reason` → 0 PATCH 400 en nube) + favicon; QA browser real 43/43 (`/tmp/opencode/qae2e/qa-tc0053.mjs`) con 0 errores consola/red y sin duplicados (TC/FG/GW ×1). **BUILD-TC-005.4 (2026-08-08)**: QA final 48/48 (`qa-tc0054.mjs`) + regresión 82/82 + fix `createTrainingCamp()` persistiendo `league_mode: 'practice'` (la BD default `'regular'` rompía el gate del CTA tras reload). **BUILD-TC-006.1 (2026-08-08): Simulation Engine núcleo sin UX** — dominio `src/domains/simulation/` (SimulationDirector + MatchSimulator determinista + StandingsCalculator + SimulationService fachada + index), máquina pública ampliada en `GameWeekDirector` (`games_in_progress`/`simulation_running` + `SIMULATION_START`/`SIMULATION_PROGRESS`/`ADVANCE_EVENT`), `EVENT_ACTIONS` + `PERSIST_DONE`/`STANDINGS_DONE`/`FAIL`, `toCloudPatch` excluye `simulation_progress` (no es columna de training_sessions); migración `supabase/006.1-simulation.sql` idempotente **aplicada en TC-006.3**; regresión harness 140/140 + `npm run build` ✅ (bundle `index-CC5Eoaky.js`, preview 4173). **BUILD-TC-006.2 (2026-08-08): orquestación automática en `useTrainingSession`** — auto-start en `picks_locked`, batches deterministas por `speed`, resume tras reload (`simulation_progress`), guard anti-duplicados (StrictMode), finalización `completed`/`finished`; refactor `GameWeekService.listSessionGames`/`sessionGameMatch` + `isCompleted` alias `finished` + fix `getCurrentStep`; regresión harness 187/187 + build ✅. **BUILD-TC-006.3 (2026-08-08): UX en vivo + cierre en la nube** — `GameWeekView` con SimulationProgress (simulación en vivo) + GameWeekResults (scores FINAL + "Your picks: correct/total") + GameWeekLeaderboard + picks públicos (exención PRIVACY-001 practice); dominio `simulationView.js`; migración `006.1` **APLICADA vía Management API** (PATCH `game_weeks` → 200) + nueva `006.1b-league-games-update.sql` (UPDATE por membresía); fixes `defaultRun(null)` null-safe y `participants.id`; QA browser 45/45 + regresión 231/231 + build ✅.
Pendiente de verificación manual: los 3 escenarios de BUILD-002.1 (usuario nuevo / con ligas sin activa / liga activa), PRIVACY-001 (contador + recordatorio en sim), PLAN-003 (guardar/editar/cancelar/toggle) y el flujo BUILD-TC-001/002/003/004/005 en navegador con sesión (crear → picker → intro → config → confirmación → lobby → countdown → cancelar → finalizar → fixture_generation con progreso → completed → game_week: jornada → picks → confirmación → bloqueo; desktop + móvil; capturas) — el flujo de datos ya quedó verificado en modo nube con el E2E real 25/25.
Nada está commiteado aún (BUILD-001/002/002.1 + PRIVACY-001 + nav + PLAN-003 + BUILD-004.1 + PLAN-005 docs + BUILD-TC-001 + BUILD-TC-002 + BUILD-TC-003 + BUILD-TC-004 + BUILD-TC-004.2 + BUILD-TC-005 + TC-005.1 + TC-005.3). El hito TC-005 quedó cerrado en el commit `7cb799a` (rama `development`, **sin push**); BUILD-TC-005.3 queda sin commitear. Resúmenes diarios en `gameguru-day-2026-08-01.md`, `gameguru-day-2026-08-03.md`, `gameguru-day-2026-08-04.md`, `gameguru-day-2026-08-05.md`, `gameguru-day-2026-08-07.md` y `gameguru-day-2026-08-08.md`.
Próximas decisiones: commit, modo de deploy, limpieza del `.env`; luego BUILD-004.2 (badges de modo), verificación manual en navegador del flujo Game Week en modo nube y, posteriormente, implementar BUILD-TC-006 (Simulation Engine).


