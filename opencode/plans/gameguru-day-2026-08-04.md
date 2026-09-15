# gameguru — Resumen diario 2026-08-04 (Mar)

Rama: master. Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb`. Tooling: node v20.20.2, vite 5.4.21 (sin `rg`/`gh`/Docker; usar Grep/Read/Glob).
Contexto previo: ver `opencode/plans/gameguru-day-2026-08-03.md` (PRIVACY-001, PLAN-003, PLAN-004 diseño, BUILD-004.1, build 130 módulos, nada commiteado).

## Qué se hizo hoy (PLAN-005 diseño + BUILD-TC-001 Lobby + BUILD-TC-002 Entrada oficial + BUILD-TC-003 Event Director)

### PLAN-005 — Training Camp Experience (diseño aprobado)
Documento completo `opencode/plans/training-camp.md`. Decisiones del usuario:
1. **9 estados** (sin fusionar): `created → waiting_players → countdown → training_started → picks_open → picks_locked → games_in_progress → simulation_running → finished` (+ `cancelled`). Cada estado es una experiencia distinta para Dashboard/notificaciones/Activity Feed.
2. **Exención de PRIVACY-001 solo en TC**: leaderboard y picks públicos en vivo (objetivo educativo). Preseason/Regular conservan la privacidad.
3. **Motor cliente v1** con lógica aislada de React: `SimulationService → SimulationEngine → RandomGenerator`; Edge Functions futuras solo reemplazan el Engine.
4. **Fixture Mode**: `auto` (genera enfrentamientos) | `manual` (reutiliza el constructor de partidos).
5. **Identidad visual por experiencia**: 🎓 TC azul `#3B82F6` (`--mode-tc`) · 🏈 Preseason teal (`--mode-ps`) · 🏆 Regular dorado (`--mode-rs`).
- Docs: `training-camp.md` (completo + §6.1 identidad), `blueprint.md` (sección PLAN-005), `gameguru.md`, referencias `preseason.md`/`regular-season.md`.

### BUILD-TC-001 — Lobby del Training Camp (implementado, sin commitear)
Alcance: crear liga `practice` + evento en un paso, lobby con countdown/roster/timeline, persistencia con fallback a localStorage. **Sin motor, sin fixtures, sin APIs** (TC-002/003).
- **DDL manual** `supabase/005.1-training-camps.sql` (tabla `training_camps` 1:1 con `leagues`, CHECK estados/nivel, RLS permisiva). **No ejecutado**.
- **Dominio** `src/domains/training/`: `models/states.js` (9 estados + `getDerivedPhase` + T-60s), `models/levels.js` (Express/Standard/Advanced/Custom + `resolveConfig`), `models/presence.js` (online `boolean|null`, sin Realtime), `services/trainingCampService.js` (Supabase → fallback `localStorage`), `hooks/useTrainingCamp.js` (tick 1s, transiciones openLobby/startNow/cancelEvent), `training.module.css` (identidad azul, mobile-first).
- **Componentes**: `TrainingCampHeader`, `TrainingCampStatus` (timeline), `TrainingCampCountdown` (Días/Horas/Min/Seg en vivo), `TrainingCampParticipants` (roster admin/tú/presencia), `TrainingCampLobby`, `TrainingCampSetupModal` (nombre + `datetime-local` + nivel + custom partidos/velocidad).
- **Wiring**: `useLeague.createTrainingCamp`/`configureTrainingCamp`, página `TrainingCamp.jsx` (ruta `#training`), `trainingCampsApi` en `supabase.js`, i18n es/en (bloque `training.*`), tokens `--mode-tc/ps/rs` en `global.css`, label 'Practice'→'Training Camp' en `modes.js`, CTA azul en Topbar + nav 'Camp' en BottomNav (solo ligas practice) + banner lobby y CTA bienvenida en dashboard + badge TC en Mis Ligas.
- Renaming de producto: "Practice" → "Training Camp" (BD conserva `'practice'`).

### BUILD-TC-002 — Experience Picker + Entrada Oficial (implementado, sin commitear)
Alcance: integrar el TC al flujo oficial de creación; nunca más como página aislada.
- **Flujo**: `Crear Liga → Experience Picker → (TC) Intro educativa → Configuración → Lobby`.
- **Experience Picker** (`src/domains/experience/`): 3 cards con identidad por modo (🎓 azul / 🏈 teal / 🏆 dorado).
- **TrainingCampIntro**: hero azul + 4 bloques (qué aprenderás, duración 30-60 min, cómo funciona la simulación, qué obtenés al finalizar) + cierre con el embudo de adopción **TC → Preseason → Regular**.
- **ExperienceWizard**: orquesta pasos; TC reusa `TrainingCampSetupForm` (extraído del modal); Preseason/Regular reusan `createLeague` + pantalla de invitación clásica.
- **Entradas**: Topbar "➕ Crear" y CTAs del dashboard abren el wizard; "🎓 Training Camp" abre el wizard en la intro (o navega al Lobby si la liga actual ya es practice). `TrainingCampSetupModal` queda solo para configurar eventos de ligas existentes. Compatibilidad preservada (`CreateLeagueModal`/`CreateSimulationModal`/join/picks/board intactos).
- i18n es/en: bloque `wizard.*` nuevo.

### BUILD-TC-003 — Event Director (implementado, sin commitear)
Alcance: el Director coordina el ciclo del evento (sin generarlo) + Training Session como entidad independiente (1:N-ready) + confirmación en el wizard + personalidad del Lobby.
- **Dominio `src/domains/event/`**: `EventDirector` (contrato: `getSteps`, `getCurrentStep`, `getLastCompletedStep`, `dispatch` + `EVENT_ACTIONS`) y `TrainingCampDirector` (9 etapas, fase derivada → paso, transiciones por hora `waiting→countdown→training_started` y acciones admin). La UI solo conoce el contrato, nunca el motor.
- **Training Session 1:N-ready**: SQL `supabase/005.1-training-sessions.sql` (manual, no ejecutado; reemplaza 005.1-training-camps.sql) con `id` PK + `session_no` + `UNIQUE (league_id, session_no)`. Data layer renombrado: `trainingSessionsApi` (supabase.js), `trainingSessionService` (LS `gameguru.ts.*` con migración desde `gameguru.tc.*`), `useTrainingSession`. `useLeague` conserva su API pública.
- **Confirmación en el wizard**: nuevo paso `tc-review` (Nombre / Inicio / Nivel (N juegos) → [Crear Evento]).
- **Personalidad del Lobby**: `🟢 La sesión comenzará pronto`, `⏳ Comenzamos en...`, `🎉 ¡Entrenamiento completado!`; sesión visible `🎓 Training Camp #{no}`; timeline alimentada por `currentStep`/`lastCompletedStep` del Director.
- i18n es/en: keys `persona*`, `sessionTag`, `review*`; textos engineNote/readySub/localPersist actualizados al nuevo roadmap.
- Verificación: Director probado con node (transiciones y steps correctos).

## Datos/estado
- `npm run build` ✅ **154 módulos** (BUILD-TC-003; +3 vs. TC-002 por el dominio `event/`). Build previo TC-002 ✅ 151 módulos; TC-001 ✅ 147.
- Smoke test: app arranca sin errores en dev server (`http://localhost:5173/gameguru/`).
- Dev server local del usuario: `http://localhost:5173/gameguru/`.

## Pendiente
1. **Verificación manual BUILD-TC-001/002/003**: flujo crear → picker → intro → config → **confirmación** → lobby → comenzar (countdown 60s) → cancelar; desktop + móvil; **capturas** (postergadas por decisión del usuario). Requiere sesión iniciada.
2. **Ejecutar** `supabase/005.1-training-sessions.sql` (cuando se autorice) → verificar que la sesión persiste en nube (sin aviso "local").
3. Ejecutar backfill `supabase/004.1-season-system.sql` (de día 03) y verificar PLAN-004.1.
4. Verificar PRIVACY-001 (sim con admin), PLAN-003 (ScoreEditor) y escenarios BUILD-002.1.
5. Decidir commit (BUILD-001/002/002.1 + PRIVACY-001 + nav + PLAN-003 + BUILD-004.1 + PLAN-005 docs + BUILD-TC-001 + BUILD-TC-002 + BUILD-TC-003) y deploy.
6. Siguiente BUILD: TC-004 (Fixture Generator) → TC-005 (Simulation Engine) → TC-006 (Resultados/UX live) → TC-007 (Graduación).
