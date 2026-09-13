# Graph Report - gameguru  (2026-09-12)

## Corpus Check
- 249 files · ~183,800 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1707 nodes · 3183 edges · 108 communities (90 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d3e69d9e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- leagues.js
- useLanguage
- reconciliation/index.js
- useTrainingCamp.js
- useTrainingSession.js
- league/index.js
- navigate
- package.json
- App.jsx
- event/index.js
- supabase.js
- game-week/index.js
- gameguru — Resumen diario 2026-08-13 (Jue)
- gameguru — Resumen diario 2026-08-08 (Sáb)
- BUILD-AUTO-SYNC-002: Security & Scheduler Hardening
- reconcile/index.ts
- SUP-004 Deployment & QA Report
- sports/index.js
- results-sync/index.ts
- FixtureGeneratorService.js
- GameWeekService.js
- BUILD-AUTO-SYNC-002.1: Fix Supabase Vault Compatibility
- SUP-004 Requirements
- BUILD SUP-004.1 — Provider Reconciliation Admin UI
- Auto-Results Sync - Deployment Guide
- normalize.test.js
- sportsService.js
- espn.js
- PLAN-SUP-003 — Platform User Management (diseño, READ-ONLY)
- BUILD-SUP-004 — Provider Game Reconciliation
- BUILD-010 — Adaptive NFL Results Sync + API Budget
- SuperAdmin / Plataforma — SUP-000 + SUP-001 + SUP-002 + SUP-003 (implementado 2026-08-13)
- platform/index.js
- GameGuru — Blueprint Completo
- routes.js
- Preseason Experience (🏈)
- PLAN-005 — Training Camp Experience (🎓)
- Sesión 9 — 🏈 Preseason (BUILD-PS-001→004, MVP)
- BUILD-SUP-004.2: Navigation Fix - Handoff
- PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario
- BUILD-AUTH-NICK-001: Email/Google auth + nickname por liga + revelar nombres - Handoff
- BUILD-PRIVACY-EMAIL-001: El correo nunca aparece en pantallas de otros jugadores - Handoff
- PlatformLeagues.jsx
- gameguru — Resumen diario 2026-08-03 (Lun)
- QA-SUP-004.1 — Provider Reconciliation Dry Run
- PLAN-004 — Sistema de Temporadas (Practice / Preseason / Regular)
- GameGuru — Blueprint de cambios
- Instructions for User
- trainingSessionService.js
- Flujos clave
- gameguru — Resumen diario 2026-08-01 (Sáb)
- gameguru — Resumen diario 2026-08-05 (Mié)
- BUILD-PURGE-RESET-001: Purga total de usuarios y contenido (conservando el superadmin) - Handoff
- PLAN-003 — Rediseño UX de captura de resultados
- PLAN-LEAGUE-CONTEXT-01.1 — Aislamiento multi-liga de picks + identidad + routing de standings
- Handoff
- TrainingCampLobby.jsx
- levels.js
- Auto Results Sync — BUILD-AUTO-SYNC-001 (MVP NFL)
- BUILD-SUP-004.2: Navigation Fix
- Qué se hizo hoy (PLAN-005 diseño + BUILD-TC-001 Lobby + BUILD-TC-002 Entrada oficial + BUILD-TC-003 Event Director)
- QA-SUP-004.2 — Diagnostic: Reconciliation Navigation Issue
- 8.3 BUILD-TC-003 — Event Director (implementado 2026-08-04)
- sessionService.js
- Qué se hizo hoy (BUILD-TC-005.1 — Persistencia Supabase + flujo Game Week en modo nube)
- 8.5 BUILD-TC-005 — Game Week & Picks (implementado 2026-08-05; **validado en modo nube 2026-08-07 — BUILD-TC-005.1**)
- Base de datos (Supabase)
- NFL Data
- Archivos modificados
- Sesión 8 — PLAN-LEAGUE-CONTEXT-01.1 (corrección del aislamiento multi-liga)
- Arquitectura orientada a dominios (Feature First)
- PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario
- BUILD-002.1 — Unificar Home y Dashboard (Experiencia Fantasy First)
- PRIVACY-001 — Picks privados hasta el cierre
- Archivos modificados
- PLAN-004.1 — Persistencia del Sistema de Temporadas (BUILD-004.1)
- 8.1 BUILD-TC-001 — Lobby del Training Camp (implementado 2026-08-04)
- 8.2 BUILD-TC-002 — Experience Picker + Entrada Oficial (implementado 2026-08-04)
- 8.5.1 BUILD-TC-005 — alcance entregado (2026-08-05)
- 8.6.3 BUILD-TC-006.3 (2026-08-08) — Simulation: UX en vivo + cierre en la nube
- Hooks API
- BUILD-002 — MVP del nuevo Home Dashboard (Fase 1 de PLAN-001)
- PLAN-003 — Rediseño UX de captura de resultados
- 8.4 BUILD-TC-004 — Fixture Generation Event (implementado 2026-08-05)
- BUILD-001 — Preparación de arquitectura del nuevo Dashboard
- 8.4.1 BUILD-TC-004.2 — Estabilización (implementado 2026-08-05)
- Routing (hash-based)
- Archivo modificado
- Archivo modificado
- PLAN-004 — Sistema de Temporadas (Practice / Preseason / Regular)
- Expected Behavior (Theoretical)
- Recommendations
- Problems
- 🧭 Navegación multi-liga — Fix UX (2026-08-14)
- Critical Diagnostic
- Edge Function Validation
- Frontend UI Review
- 3. Arquitectura del motor
- 8.6.1 BUILD-TC-006.1 (2026-08-08) — Simulation Engine: núcleo (sin UX)

## God Nodes (most connected - your core abstractions)
1. `useLanguage()` - 90 edges
2. `GameGuru — Blueprint Completo` - 31 edges
3. `PLAN-005 — Training Camp Experience (🎓)` - 29 edges
4. `PLAN-SUP-003 — Platform User Management (diseño, READ-ONLY)` - 26 edges
5. `canManageLeague()` - 24 edges
6. `navigate()` - 21 edges
7. `getLeagueMode()` - 20 edges
8. `useTrainingCamp()` - 19 edges
9. `GameGuru — Blueprint de cambios` - 18 edges
10. `EventDirector` - 17 edges

## Surprising Connections (you probably didn't know these)
- `AppInner()` --calls--> `useLeague()`  [EXTRACTED]
  src/App.jsx → src/hooks/useLeague.js
- `AppInner()` --calls--> `useLanguage()`  [EXTRACTED]
  src/App.jsx → src/i18n/context.jsx
- `AppShell()` --calls--> `useLanguage()`  [EXTRACTED]
  src/App.jsx → src/i18n/context.jsx
- `AppShell()` --calls--> `useLeagueContext()`  [EXTRACTED]
  src/App.jsx → src/league/context/LeagueContext.jsx
- `AppShell()` --calls--> `navigate()`  [EXTRACTED]
  src/App.jsx → src/router/routes.js

## Import Cycles
- None detected.

## Communities (108 total, 9 thin omitted)

### Community 0 - "leagues.js"
Cohesion: 0.15
Nodes (29): getLeagueMode(), isOfficialMode(), isValidMode(), LEAGUE_MODES, DEFAULT_TIMEZONE, applyLeagueFilters(), buildOwnerMap(), buildStandingsForLeague() (+21 more)

### Community 1 - "useLanguage"
Cohesion: 0.06
Nodes (50): InviteModal(), LanguageSwitch(), ProfileMenu(), Topbar(), SPORTS, translateAuthError(), CopyReminder(), CountdownCard() (+42 more)

### Community 2 - "reconciliation/index.js"
Cohesion: 0.10
Nodes (44): AUDIT_ACTIONS, buildAmbiguousPayload(), buildAutoMapPayload(), buildManualOverridePayload(), buildManualRevertPayload(), buildRollbackAppliedPayload(), buildRollbackConflictPayload(), buildSkippedPayload() (+36 more)

### Community 3 - "useTrainingCamp.js"
Cohesion: 0.08
Nodes (57): resolveGame(), activeWeekOf(), AUTO_GAME_SPACING_MINUTES, AUTO_GAMES_PER_WEEK, AUTO_PICK_DEADLINE_MINUTES, AUTO_WEEK_GAP_DAYS, buildCalendar(), buildWeekStarts() (+49 more)

### Community 4 - "useTrainingSession.js"
Cohesion: 0.21
Nodes (16): mapPhase(), TrainingCampParticipants(), useTrainingSession(), resolveConfig(), decorateParticipants(), isPresenceAvailable(), ONLINE_SOURCE, presenceAvailability() (+8 more)

### Community 5 - "league/index.js"
Cohesion: 0.05
Nodes (55): TEAM_LIST, GameTime(), LeagueGamesManager(), ScoreEditor(), TeamLogo(), DIVISIONS, genInviteCode(), INTER_CONF (+47 more)

### Community 6 - "navigate"
Cohesion: 0.20
Nodes (17): clearActiveLeagueId(), hasStorage(), loadActiveLeagueId(), saveActiveLeagueId(), LeagueContext, LeagueProvider(), useLeagueContext(), buildContextValue() (+9 more)

### Community 7 - "package.json"
Cohesion: 0.07
Nodes (27): gh-pages, dependencies, react, react-dom, @supabase/supabase-js, devDependencies, gh-pages, @types/react (+19 more)

### Community 8 - "App.jsx"
Cohesion: 0.12
Nodes (18): App(), AppInner(), BottomNav(), NAV_ITEMS, CreateSimulationModal(), PlatformDenied(), formatLastSync(), SyncStatus() (+10 more)

### Community 9 - "event/index.js"
Cohesion: 0.12
Nodes (12): EVENT_ACTIONS, EVENT_TYPES, EventDirector, FIXTURE_STATES, FixtureGenerationDirector, getFixtureState(), STEPS, PHASE_TO_STEP (+4 more)

### Community 10 - "supabase.js"
Cohesion: 0.06
Nodes (52): LeaderboardTable(), LeagueIdentity(), PublicPicksMatrix(), tdStyle, thStyle, useDashboardData(), useLeagueData(), useLeagueIdentity() (+44 more)

### Community 11 - "game-week/index.js"
Cohesion: 0.08
Nodes (42): GameCard(), calendarHelpers, GameWeekContext, GameWeekProvider(), normGame(), useGameWeek(), GameWeekLeaderboard(), GameWeekResults() (+34 more)

### Community 12 - "gameguru — Resumen diario 2026-08-13 (Jue)"
Cohesion: 0.05
Nodes (40): API, Cambios, Completado, Contexto, Contexto, Contexto, Dominio, Estado actual del proyecto (fin de sesión 14-ago) (+32 more)

### Community 13 - "gameguru — Resumen diario 2026-08-08 (Sáb)"
Cohesion: 0.05
Nodes (39): Archivos tocados, Archivos tocados, Arquitectura propuesta, Bugs reales encontrados por el QA E2E y corregidos, Cambios de código (sin commitear), Contexto y decisión de diseño (RLS verificada en BD), Diagnóstico, Estado (+31 more)

### Community 14 - "BUILD-AUTO-SYNC-002: Security & Scheduler Hardening"
Cohesion: 0.05
Nodes (37): 1. Authorization Fix (CRITICAL), 2. Cron Security, 3. Concurrency Protection, 4. Test Coverage, ✅ Authorization Model, Build, BUILD-AUTO-SYNC-002: Security & Scheduler Hardening, ✅ Code Complete (+29 more)

### Community 15 - "reconcile/index.ts"
Cohesion: 0.24
Nodes (14): executeApply(), executeDryRun(), executeRollback(), fetchGamesByDate(), isManualOverride(), matchGame(), normalize(), parseGameTime() (+6 more)

### Community 16 - "SUP-004 Deployment & QA Report"
Cohesion: 0.06
Nodes (35): 8 Action Types, Appendix: Audit Action Types (Complete List), Audit Security, Audit System, Authentication & Authorization, Backfill Status, Before/After State, Build Status (+27 more)

### Community 17 - "sports/index.js"
Cohesion: 0.33
Nodes (6): createApiSportsNflAdapter(), SEASON_TYPE_MAPPING, STATUS_MAPPING, TEAM_MAPPING, SPORTS_PROVIDER_STATUS, SportsDataProvider

### Community 18 - "results-sync/index.ts"
Cohesion: 0.23
Nodes (9): classifyWindow(), fetchGames(), fetchGamesByDate(), normalize(), schedulerDecision(), SEASON_TYPE_MAP, STATUS_MAP, TEAM_MAP (+1 more)

### Community 20 - "GameWeekService.js"
Cohesion: 0.18
Nodes (5): GameWeekDirector, getWeekState(), lsKey(), readLocalWeeks(), writeLocalWeeks()

### Community 21 - "BUILD-AUTO-SYNC-002.1: Fix Supabase Vault Compatibility"
Cohesion: 0.06
Nodes (34): 009.0, 009.0 Fix, 009.1, 009.1 Fix, 1. Fixed Extension Name Check (Line 39), 2. Removed Hardcoded CRON_SECRET, 3. Made Cron Job Idempotent, Build (+26 more)

### Community 22 - "SUP-004 Requirements"
Cohesion: 0.06
Nodes (33): 10. Rollback Plan, 1. BUILD-010 is Technically Correct but Blocked by Upstream, 1. Provider Assignment Strategy, 1. Root Cause: Why `master_games.provider` is NULL, 2. Current Flow: How master_games are Created, 2. Reconciliation Logic, 2. SUP-004 Must Execute Before Continuing QA, 3. BUILD-010 Does NOT Need Conceptual Adaptation (+25 more)

### Community 23 - "BUILD SUP-004.1 — Provider Reconciliation Admin UI"
Cohesion: 0.06
Nodes (32): Apply Status, Authentication Flow, Authorization, Build Status, BUILD SUP-004.1 — Provider Reconciliation Admin UI, Componentes implementados:, Coverage, DAL vs ARI (Regular Week 8) (+24 more)

### Community 24 - "Auto-Results Sync - Deployment Guide"
Cohesion: 0.06
Nodes (31): 1. API-Sports Credentials, 1. Disable Cron Job, 2. Cron Secret, 2. Delete Edge Function, 3. Required Extensions, 3. Revert Database Changes (if needed), Auto-Results Sync - Deployment Guide, Concurrency Protection (+23 more)

### Community 25 - "normalize.test.js"
Cohesion: 0.40
Nodes (3): SEASON_TYPE_MAP, STATUS_MAP, TEAM_MAP

### Community 37 - "PLAN-SUP-003 — Platform User Management (diseño, READ-ONLY)"
Cohesion: 0.06
Nodes (30): 10. League Relationship, 11. Platform Overview (`#/platform`), 12. Performance, 13. Auth data (cómo se consulta de forma segura), 14. Authorization, 15. Read-only (confirmación de alcance), 16. Responsive, 17. Empty / Loading / Error (+22 more)

### Community 38 - "BUILD-SUP-004 — Provider Game Reconciliation"
Cohesion: 0.07
Nodes (29): Acceptance Criteria, Authorization, Backfill Status, BUILD-010 Integration, BUILD-SUP-004 — Provider Game Reconciliation, Componentes implementados:, Coverage, Database (+21 more)

### Community 39 - "BUILD-010 — Adaptive NFL Results Sync + API Budget"
Cohesion: 0.07
Nodes (26): 1. Migración 010.0, 2. Scheduler Adaptativo, 3. API-Sports Batch by Date, 4. Budget Atómico, 5. Reconciliation, 6. Frontend Budget Display, Acceptance Criteria, API Consumption (+18 more)

### Community 40 - "SuperAdmin / Plataforma — SUP-000 + SUP-001 + SUP-002 + SUP-003 (implementado 2026-08-13)"
Cohesion: 0.07
Nodes (26): API (`src/supabase.js`, `platformApi`), API (`src/supabase.js`, `platformApi`), Aprendizajes QA (script `/tmp/opencode/qae2e/qa-platform-leagues.mjs`), BUILD-SCORE-001 (2026-08-13) — impacto en plataforma, Contexto y regla crítica, Decisión clave — FKs reales de la BD viva (check `check-fks.mjs`), Dominio (lógica pura, `src/domains/platform/models/leagues.js`), Dominio (lógica pura, `src/domains/platform/models/users.js`) (+18 more)

### Community 41 - "platform/index.js"
Cohesion: 0.19
Nodes (23): canReadPlatform(), isPlatformAdmin(), isValidPlatformRole(), normalizePlatformRole(), PLATFORM_ROLE_RANK, PLATFORM_ROLES, PLATFORM_ROLES_LIST, applyUserFilters() (+15 more)

### Community 42 - "GameGuru — Blueprint Completo"
Cohesion: 0.08
Nodes (24): 🎯 Acciones de semana en My Picks — BUILD-UX (2026-08-12), 🎯 Actualizaciones parciales de marcador — BUILD-SCORE-001 (2026-08-13), Archivos legacy / no utilizados, Bugs conocidos y notas, Captura de resultados — PLAN-003 (ScoreEditor universal), Contexto de liga por URL — PLAN-LEAGUE-CONTEXT (Fases 1-3 implementadas, BUILD-LEAGUE-CONTEXT-01 2026-08-09), Convenciones de código, Design Tokens (`global.css`) (+16 more)

### Community 43 - "routes.js"
Cohesion: 0.13
Nodes (16): AppShell(), buildHash(), LEAGUE_PAGES, LEGACY, LEGACY_PAGES, normalizeHash(), PAGES, parseHash() (+8 more)

### Community 44 - "Preseason Experience (🏈)"
Cohesion: 0.09
Nodes (18): Backlog post-Preseason, BUILD-SCORE-001 (2026-08-13) — Actualizaciones parciales de marcador, Comportamiento, Freeze (2026-08-12) — Go-Live Readiness Audit, Integración con proveedores, Modelo de datos (PLAN-004, BUILD-004.1), Preseason Experience (🏈), Riesgos (+10 more)

### Community 45 - "PLAN-005 — Training Camp Experience (🎓)"
Cohesion: 0.10
Nodes (21): 10. Recomendaciones del Arquitecto, 1. Principio arquitectónico clave, 2. Los 9 estados del evento, 4. Velocidades (`time_per_game_ms` por batch), 5. Wizard de configuración (pasos), 6.1 Identidad visual del Training Camp (decisión 2026-08-04), 6. UX del evento en vivo, 7. Integraciones con el código existente (+13 more)

### Community 46 - "Sesión 9 — 🏈 Preseason (BUILD-PS-001→004, MVP)"
Cohesion: 0.10
Nodes (19): Cambios, Cambios (solo layout), Contexto, Contexto, Contexto y alcance MVP (decisión del usuario), gameguru — Resumen diario 2026-08-12 (Mié), Pendientes, Pendientes (mañana) (+11 more)

### Community 47 - "BUILD-SUP-004.2: Navigation Fix - Handoff"
Cohesion: 0.12
Nodes (16): Archivo Modificado, Archivos de Documentación, Build, BUILD-SUP-004.2: Navigation Fix - Handoff, Cambios Realizados, Código en Bundle, Deployment, Estado Final (+8 more)

### Community 48 - "PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario"
Cohesion: 0.12
Nodes (16): 10. Compatibilidad con Training Camp / Game Week / Simulation, 11. Impacto sobre Picks / Standings + bug `picks_user_id_game_id_key`, 12. Plan de implementación por fases, 13. Tests, 14. Riesgos, 15. Preguntas resueltas / pendientes, 1. Summary, 2. Hallazgo QA actual (+8 more)

### Community 49 - "BUILD-AUTH-NICK-001: Email/Google auth + nickname por liga + revelar nombres - Handoff"
Cohesion: 0.12
Nodes (15): Archivos y áreas modificadas, BUILD-AUTH-NICK-001: Email/Google auth + nickname por liga + revelar nombres - Handoff, Datos (migración — NO APLICADA aún), Decisiones pendientes, Dominio puro (lógica testeada), Estado Final, Infraestructura de datos cliente, Nivel de Riesgo (+7 more)

### Community 50 - "BUILD-PRIVACY-EMAIL-001: El correo nunca aparece en pantallas de otros jugadores - Handoff"
Cohesion: 0.12
Nodes (15): Archivos y áreas modificadas, BUILD-PRIVACY-EMAIL-001: El correo nunca aparece en pantallas de otros jugadores - Handoff, Datos (migración — sigue NO APLICADA; actualizada con el hardening), Decisiones pendientes, Dominio puro (lógica testeada), Estado Final, Infraestructura de datos cliente, Nivel de Riesgo (+7 more)

### Community 51 - "PlatformLeagues.jsx"
Cohesion: 0.20
Nodes (14): buildFilterOptions(), DEFAULT_PAGE_SIZE, ownerName(), buildUserFilterOptions(), DEFAULT_PAGE_SIZE, USER_NO_FILTER, PlatformLeagues(), fmt() (+6 more)

### Community 52 - "gameguru — Resumen diario 2026-08-03 (Lun)"
Cohesion: 0.13
Nodes (14): Auditoría (resultado: la app ya era mayormente conforme), BUILD-004.1 — Persistencia del Sistema de Temporadas (IMPLEMENTADO), Cambios implementados, Datos/estado, Decisiones del usuario, Estado de git, Fix navegación (bugs previos), gameguru — Resumen diario 2026-08-03 (Lun) (+6 more)

### Community 53 - "QA-SUP-004.1 — Provider Reconciliation Dry Run"
Cohesion: 0.13
Nodes (14): APPLY Status, Audit Validation, Code Review, Database Validation, Edge Function Logic, Executive Summary, Frontend Deployment, QA-SUP-004.1 — Provider Reconciliation Dry Run (+6 more)

### Community 54 - "PLAN-004 — Sistema de Temporadas (Practice / Preseason / Regular)"
Cohesion: 0.15
Nodes (12): 1. Modelo de datos recomendado, 2. Wizard de creación ("elegir una experiencia"), 3. Comportamiento por modo, 4. Integración con proveedores (arquitectura existente), 5. Compatibilidad / migración segura, 6. UX, 7. Roadmap por BUILD, 8. Riesgos (+4 more)

### Community 55 - "GameGuru — Blueprint de cambios"
Cohesion: 0.17
Nodes (12): Archivo modificado, Bugs corregidos, Decisiones (elegidas por el usuario), Entregables del plan, Estado actual (2026-08-04), Experiencias oficiales (referencias), GameGuru — Blueprint de cambios, Identidad visual por experiencia (decisión 2026-08-04) (+4 more)

### Community 56 - "Instructions for User"
Cohesion: 0.17
Nodes (12): Instructions for User, Step 10: Verify Audit, Step 11: Report Results, Step 1: Deploy Frontend, Step 2: Access GameGuru, Step 3: Login as platform_superadmin, Step 4: Navigate to Reconciliation, Step 5: Execute Dry Run (Preseason) (+4 more)

### Community 57 - "trainingSessionService.js"
Cohesion: 0.27
Nodes (6): INTERNAL_FIELDS, lsKey(), lsKeyLegacy(), readLocal(), trainingSessionService, writeLocal()

### Community 58 - "Flujos clave"
Cohesion: 0.20
Nodes (10): Admin de liga (LeaguePage + LeagueGamesManager), Crear liga real, Crear liga simulación (solo superadmin), Flujos clave, Leaderboard, Login / Registro, Picks, Picks Públicos (+2 more)

### Community 59 - "gameguru — Resumen diario 2026-08-01 (Sáb)"
Cohesion: 0.20
Nodes (9): BUILD-001 ✅ — Base compartida, BUILD-002.1 ✅ — Unificar Home y Dashboard ("Home = Dashboard"), BUILD-002 ✅ — Dashboard completo (experiencia fantasy), Datos confirmados (no re-investigar), Estado de git, gameguru — Resumen diario 2026-08-01 (Sáb), Pendiente para mañana, Qué se hizo hoy (BUILD-001 + BUILD-002 + BUILD-002.1) (+1 more)

### Community 60 - "gameguru — Resumen diario 2026-08-05 (Mié)"
Cohesion: 0.20
Nodes (9): Alcance entregado, BUILD-TC-004.2 — Estabilización (misma jornada), BUILD-TC-005 — Game Week & Picks (implementado 2026-08-05, sin commitear), Datos/estado, Decisiones, gameguru — Resumen diario 2026-08-05 (Mié), Pendiente, PLAN-TC-005 — Game Week & Picks (diseño aprobado 2026-08-05, sin implementar) (+1 more)

### Community 61 - "BUILD-PURGE-RESET-001: Purga total de usuarios y contenido (conservando el superadmin) - Handoff"
Cohesion: 0.20
Nodes (9): Archivo creado, BUILD-PURGE-RESET-001: Purga total de usuarios y contenido (conservando el superadmin) - Handoff, Decisiones del PO (PLAN aprobado 2026-09-01), Estado Final, Nivel de Riesgo, Próximo paso recomendado (orden estricto), Resumen, Riesgos residuales (+1 more)

### Community 62 - "PLAN-003 — Rediseño UX de captura de resultados"
Cohesion: 0.20
Nodes (9): Alternativas evaluadas, Archivos modificados, Decisión de diseño, Implementación, Nuevos archivos, PLAN-003 — Rediseño UX de captura de resultados, Problema original, Sin cambios (+1 more)

### Community 63 - "PLAN-LEAGUE-CONTEXT-01.1 — Aislamiento multi-liga de picks + identidad + routing de standings"
Cohesion: 0.20
Nodes (9): 1. Resumen, 2. Hallazgo QA (fuente de verdad), 3. Decisiones (preguntadas y resueltas), 4. Cambios de esquema — `supabase/006.2-picks-unique.sql`, 5. Cambios de código, 6.1 Fix QA: race en `usePicks` (encontrado al estabilizar el QA multi-liga), 6. Verificación, 7. Pendientes (fuera de este BUILD) (+1 more)

### Community 64 - "Handoff"
Cohesion: 0.20
Nodes (10): Apply, Database, Deployment, Dry Run, Files, Handoff, Next Step, Security (+2 more)

### Community 65 - "TrainingCampLobby.jsx"
Cohesion: 0.33
Nodes (7): fmtStart(), TrainingCampHeader(), PREMISE, TrainingCampLobby(), STEP_LABEL_KEYS, TrainingCampStatus(), getTrainingLevel()

### Community 66 - "levels.js"
Cohesion: 0.31
Nodes (7): levelLabelKey(), roundUp(), TrainingCampSetupForm(), GAME_COUNT_OPTIONS, TRAINING_LEVELS, TRAINING_LEVELS_LIST, TRAINING_SPEEDS

### Community 67 - "Auto Results Sync — BUILD-AUTO-SYNC-001 (MVP NFL)"
Cohesion: 0.22
Nodes (8): Architecture, Auto Results Sync — BUILD-AUTO-SYNC-001 (MVP NFL), Deployment Checklist, Files Changed, Handoff, Simulation Protection, Summary, Tests

### Community 68 - "BUILD-SUP-004.2: Navigation Fix"
Cohesion: 0.22
Nodes (8): Build, BUILD-SUP-004.2: Navigation Fix, Deployment, Fix, Navigation, Next Step, Tests, Verification Checklist

### Community 69 - "Qué se hizo hoy (PLAN-005 diseño + BUILD-TC-001 Lobby + BUILD-TC-002 Entrada oficial + BUILD-TC-003 Event Director)"
Cohesion: 0.22
Nodes (8): BUILD-TC-001 — Lobby del Training Camp (implementado, sin commitear), BUILD-TC-002 — Experience Picker + Entrada Oficial (implementado, sin commitear), BUILD-TC-003 — Event Director (implementado, sin commitear), Datos/estado, gameguru — Resumen diario 2026-08-04 (Mar), Pendiente, PLAN-005 — Training Camp Experience (diseño aprobado), Qué se hizo hoy (PLAN-005 diseño + BUILD-TC-001 Lobby + BUILD-TC-002 Entrada oficial + BUILD-TC-003 Event Director)

### Community 70 - "QA-SUP-004.2 — Diagnostic: Reconciliation Navigation Issue"
Cohesion: 0.22
Nodes (8): Browser Validation Steps, Deployment Status, Files to Modify, QA-SUP-004.2 — Diagnostic: Reconciliation Navigation Issue, Questions, Root Cause Identified, Solution, Testing

### Community 71 - "8.3 BUILD-TC-003 — Event Director (implementado 2026-08-04)"
Cohesion: 0.22
Nodes (9): 8.3 BUILD-TC-003 — Event Director (implementado 2026-08-04), Archivos, Arquitectura del dominio, Confirmación en el wizard, Decisiones del usuario (2026-08-04), El Director (dominio `event/`), Personalidad del Lobby, Training Session como entidad (1:N-ready) (+1 more)

### Community 72 - "sessionService.js"
Cohesion: 0.31
Nodes (6): lsKey(), normalize(), readLocal(), trainingCampSessionService, writeLocal(), trainingSessionsApi

### Community 73 - "Qué se hizo hoy (BUILD-TC-005.1 — Persistencia Supabase + flujo Game Week en modo nube)"
Cohesion: 0.25
Nodes (7): Estado, Fix A (DB) — upsert de picks, Fix B (app) — GameWeekContext con sesión FG, gameguru — Resumen diario 2026-08-07 (Vie), Migraciones, Qué se hizo hoy (BUILD-TC-005.1 — Persistencia Supabase + flujo Game Week en modo nube), Verificación

### Community 74 - "8.5 BUILD-TC-005 — Game Week & Picks (implementado 2026-08-05; **validado en modo nube 2026-08-07 — BUILD-TC-005.1**)"
Cohesion: 0.25
Nodes (8): 8.5 BUILD-TC-005 — Game Week & Picks (implementado 2026-08-05; **validado en modo nube 2026-08-07 — BUILD-TC-005.1**), Backlog BUILD-TC-005, Decisiones del usuario (2026-08-05), Director (sin acoplar la UI), Entidades (SQL `supabase/005.2-game-week.sql`, manual, idempotente, RLS permisiva), Flujo, Frontera TC-005 / TC-006 (Simulation Engine), Validación prevista

### Community 75 - "Base de datos (Supabase)"
Cohesion: 0.29
Nodes (7): Base de datos (Supabase), `league_games`, `league_members`, `leagues`, `master_games`, `picks`, `profiles`

### Community 76 - "NFL Data"
Cohesion: 0.29
Nodes (7): `generateNFLSchedule(season)`, `genInviteCode()`, NFL Data, `NFL_TEAMS`, `NFL_WEEKS` (mock estático, solo semanas 1-2), `SPORTS`, `translateAuthError(msg)`

### Community 77 - "Archivos modificados"
Cohesion: 0.29
Nodes (7): Archivos modificados, Eliminación del modo "Juego por juego", `src/components/CreateLeagueModal.jsx`, `src/hooks/useLeague.js`, `src/hooks/usePicks.js`, `src/pages/Picks.jsx`, `src/pages/PublicPicks.jsx`

### Community 78 - "Sesión 8 — PLAN-LEAGUE-CONTEXT-01.1 (corrección del aislamiento multi-liga)"
Cohesion: 0.29
Nodes (6): Cambios, gameguru — Resumen diario 2026-08-09 (Dom), Hallazgo de fondo (QA-MULTI-LEAGUE-DIAGNOSTIC), Pendientes, QA, Sesión 8 — PLAN-LEAGUE-CONTEXT-01.1 (corrección del aislamiento multi-liga)

### Community 79 - "Arquitectura orientada a dominios (Feature First)"
Cohesion: 0.33
Nodes (6): Arquitectura orientada a dominios (Feature First), Estrategia de migración (PLAN-001), `src/domains/dashboard/` — Home / dashboard, `src/domains/sports/` — datos deportivos externos (en preparación), `src/router/` + `src/league/` — contexto de liga por URL (BUILD-LEAGUE-CONTEXT-01, Fases 1-3), `src/utils/` — lógica transversal compartida

### Community 80 - "PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario"
Cohesion: 0.33
Nodes (6): Ajustes de alcance (detectados por QA), Decisión (elegida por el usuario), Fases implementadas (BUILD-LEAGUE-CONTEXT-01), Pendiente (BUILD-LEAGUE-CONTEXT-02 en adelante), PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario, Verificación

### Community 81 - "BUILD-002.1 — Unificar Home y Dashboard (Experiencia Fantasy First)"
Cohesion: 0.33
Nodes (6): Archivos modificados, BUILD-002.1 — Unificar Home y Dashboard (Experiencia Fantasy First), Filosofía, Notas, Nuevos archivos, Verificación

### Community 82 - "PRIVACY-001 — Picks privados hasta el cierre"
Cohesion: 0.33
Nodes (6): Archivos modificados, Auditoría previa (conforme sin cambios), Decisiones (elegidas por el usuario), Nuevos archivos, PRIVACY-001 — Picks privados hasta el cierre, Verificación

### Community 83 - "Archivos modificados"
Cohesion: 0.33
Nodes (6): Archivos modificados, Picks Públicos: solo desde dentro de páginas (no nav), `src/components/BottomNav.jsx`, `src/components/Topbar.jsx`, `src/pages/Leaderboard.jsx`, `src/pages/Picks.jsx`

### Community 84 - "PLAN-004.1 — Persistencia del Sistema de Temporadas (BUILD-004.1)"
Cohesion: 0.33
Nodes (6): Campos nuevos, Compatibilidad, Decisión: `league_mode` (vs `experience_mode` / `season_mode`), Dominio, PLAN-004.1 — Persistencia del Sistema de Temporadas (BUILD-004.1), Script de migración

### Community 85 - "8.1 BUILD-TC-001 — Lobby del Training Camp (implementado 2026-08-04)"
Cohesion: 0.33
Nodes (6): 8.1 BUILD-TC-001 — Lobby del Training Camp (implementado 2026-08-04), Alcance entregado, Archivos, Arquitectura del dominio, Fuera de alcance (BUILD-TC-002/003/004), Validación

### Community 86 - "8.2 BUILD-TC-002 — Experience Picker + Entrada Oficial (implementado 2026-08-04)"
Cohesion: 0.33
Nodes (6): 8.2 BUILD-TC-002 — Experience Picker + Entrada Oficial (implementado 2026-08-04), Archivos, Arquitectura del dominio, Decisiones de entrada, Flujo de entrada, Validación

### Community 87 - "8.5.1 BUILD-TC-005 — alcance entregado (2026-08-05)"
Cohesion: 0.33
Nodes (6): 8.5.1 BUILD-TC-005 — alcance entregado (2026-08-05), BUILD-TC-005.1 (2026-08-07) — Persistencia en modo nube, Desviaciones del diseño §8.5 (documentadas), Lo que se construyó, Siguiente paso (✅ HECHO en BUILD-TC-005.1, 2026-08-07), Verificación (todo en verde)

### Community 88 - "8.6.3 BUILD-TC-006.3 (2026-08-08) — Simulation: UX en vivo + cierre en la nube"
Cohesion: 0.33
Nodes (6): 8.6.3 BUILD-TC-006.3 (2026-08-08) — Simulation: UX en vivo + cierre en la nube, Bugs reales corregidos (encontrados por el QA E2E), Migraciones (bloqueante destrabado en esta sesión), Privacy Behavior (PRIVACY-001), UX entregada (dominio + componentes), Verificación (harness + QA browser real)

### Community 89 - "Hooks API"
Cohesion: 0.40
Nodes (5): Hooks API, `useAuth()`, `useLeague(user)`, `usePicks(user, league, week)`, `useSuperAdmin(user)`

### Community 90 - "BUILD-002 — MVP del nuevo Home Dashboard (Fase 1 de PLAN-001)"
Cohesion: 0.40
Nodes (5): Archivos modificados, BUILD-002 — MVP del nuevo Home Dashboard (Fase 1 de PLAN-001), Notas y riesgos, Nuevos archivos, Verificación

### Community 91 - "PLAN-003 — Rediseño UX de captura de resultados"
Cohesion: 0.40
Nodes (5): Archivos modificados, Decisión (elegida por el usuario), Nuevos archivos, PLAN-003 — Rediseño UX de captura de resultados, Verificación

### Community 92 - "8.4 BUILD-TC-004 — Fixture Generation Event (implementado 2026-08-05)"
Cohesion: 0.40
Nodes (5): 8.4 BUILD-TC-004 — Fixture Generation Event (implementado 2026-08-05), Archivos, Arquitectura, Decisiones, Validación

### Community 93 - "BUILD-001 — Preparación de arquitectura del nuevo Dashboard"
Cohesion: 0.50
Nodes (4): Archivos modificados, BUILD-001 — Preparación de arquitectura del nuevo Dashboard, Notas y riesgos, Nuevos archivos

### Community 94 - "8.4.1 BUILD-TC-004.2 — Estabilización (implementado 2026-08-05)"
Cohesion: 0.50
Nodes (4): 8.4.1 BUILD-TC-004.2 — Estabilización (implementado 2026-08-05), Hardening defensivo, Migración aplicada, Validación

### Community 95 - "Routing (hash-based)"
Cohesion: 0.67
Nodes (3): Routing (hash-based), Rutas legacy, Rutas nuevas (`src/router/hashRouter.js` + `routes.js`)

### Community 96 - "Archivo modificado"
Cohesion: 0.67
Nodes (3): Archivo modificado, Auto-selección de última semana disponible, `src/pages/Picks.jsx`

### Community 97 - "Archivo modificado"
Cohesion: 0.67
Nodes (3): Archivo modificado, Bloqueo por tiempo real (no por envío), `src/pages/Picks.jsx`

### Community 98 - "PLAN-004 — Sistema de Temporadas (Practice / Preseason / Regular)"
Cohesion: 0.67
Nodes (3): Decisión (elegida por el usuario), Entregables del plan, PLAN-004 — Sistema de Temporadas (Practice / Preseason / Regular)

### Community 99 - "Expected Behavior (Theoretical)"
Cohesion: 0.67
Nodes (3): DAL vs ARI (Regular Week 8, 2026-11-01), Expected Behavior (Theoretical), TEN vs SEA (Preseason Week 3, 2026-08-24)

### Community 100 - "Recommendations"
Cohesion: 0.67
Nodes (3): If Dry Run Fails, Immediate Actions, Recommendations

### Community 101 - "Problems"
Cohesion: 0.67
Nodes (3): Problem 1: Frontend Not Deployed, Problem 2: Cannot Execute Dry Run, Problems

## Knowledge Gaps
- **757 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+752 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 862 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useLanguage()` connect `useLanguage` to `TrainingCampLobby.jsx`, `levels.js`, `useTrainingCamp.js`, `useTrainingSession.js`, `league/index.js`, `App.jsx`, `supabase.js`, `game-week/index.js`, `routes.js`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `GameGuru — Blueprint de cambios` connect `GameGuru — Blueprint de cambios` to `Archivo modificado`, `Archivo modificado`, `PLAN-004 — Sistema de Temporadas (Practice / Preseason / Regular)`, `Preseason Experience (🏈)`, `Archivos modificados`, `PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario`, `BUILD-002.1 — Unificar Home y Dashboard (Experiencia Fantasy First)`, `PRIVACY-001 — Picks privados hasta el cierre`, `Archivos modificados`, `PLAN-004.1 — Persistencia del Sistema de Temporadas (BUILD-004.1)`, `BUILD-002 — MVP del nuevo Home Dashboard (Fase 1 de PLAN-001)`, `PLAN-003 — Rediseño UX de captura de resultados`, `BUILD-001 — Preparación de arquitectura del nuevo Dashboard`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `PLAN-005 — Training Camp Experience (🎓)` connect `PLAN-005 — Training Camp Experience (🎓)` to `8.3 BUILD-TC-003 — Event Director (implementado 2026-08-04)`, `3. Arquitectura del motor`, `8.5 BUILD-TC-005 — Game Week & Picks (implementado 2026-08-05; **validado en modo nube 2026-08-07 — BUILD-TC-005.1**)`, `Preseason Experience (🏈)`, `8.6.1 BUILD-TC-006.1 (2026-08-08) — Simulation Engine: núcleo (sin UX)`, `8.1 BUILD-TC-001 — Lobby del Training Camp (implementado 2026-08-04)`, `8.2 BUILD-TC-002 — Experience Picker + Entrada Oficial (implementado 2026-08-04)`, `8.5.1 BUILD-TC-005 — alcance entregado (2026-08-05)`, `8.6.3 BUILD-TC-006.3 (2026-08-08) — Simulation: UX en vivo + cierre en la nube`, `8.4 BUILD-TC-004 — Fixture Generation Event (implementado 2026-08-05)`, `8.4.1 BUILD-TC-004.2 — Estabilización (implementado 2026-08-05)`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _757 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `leagues.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14616755793226383 - nodes in this community are weakly interconnected._
- **Should `useLanguage` be split into smaller, more focused modules?**
  _Cohesion score 0.06435498089920658 - nodes in this community are weakly interconnected._
- **Should `reconciliation/index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09525899912203688 - nodes in this community are weakly interconnected._