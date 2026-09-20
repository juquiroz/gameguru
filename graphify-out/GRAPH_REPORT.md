# Graph Report - gameguru  (2026-09-20)

## Corpus Check
- 271 files · ~197,315 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 30 file(s) not represented in the graph (top: .css 28, (none) 1, .toml 1)

## Summary
- 1988 nodes · 4411 edges · 131 communities (102 shown, 29 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 771 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b532734e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- leagues.js
- useLanguage
- reconciliation/index.js
- useTrainingCamp.js
- nflData.js
- useLeague.js
- navigate
- package.json
- BottomNav.jsx
- EventDirector
- supabase.js
- game-week/index.js
- gameguru — Resumen diario 2026-08-13 (Jue)
- gameguru — Resumen diario 2026-08-08 (Sáb)
- BUILD-AUTO-SYNC-002: Security & Scheduler Hardening
- reconcile/index.ts
- SUP-004 Deployment & QA Report
- sports/index.js
- App.jsx
- LeagueContext.jsx
- HANDOFF — Incidente: "Apply borró resultados" (producción)
- BUILD-AUTO-SYNC-002.1: Fix Supabase Vault Compatibility
- SUP-004 Requirements
- BUILD SUP-004.1 — Provider Reconciliation Admin UI
- Auto-Results Sync - Deployment Guide
- modes.js
- sportsService.js
- espn-nfl.ts
- TeamLogo.jsx
- ScoreEditor
- public.game_weeks
- standings.test.js
- 012.0-auth-nickname-reveal.sql
- 010.0-adaptive-sync.sql
- results-sync/index.ts
- public.pick_snapshots
- apiSportsNfl.js
- PLAN-SUP-003 — Platform User Management (diseño, READ-ONLY)
- BUILD-SUP-004 — Provider Game Reconciliation
- BUILD-010 — Adaptive NFL Results Sync + API Budget
- SuperAdmin / Plataforma — SUP-000 + SUP-001 + SUP-002 + SUP-003 (implementado 2026-08-13)
- users.js
- GameGuru — Blueprint Completo
- routes.js
- Preseason Experience (🏈)
- PLAN-005 — Training Camp Experience (🎓)
- Sesión 9 — 🏈 Preseason (BUILD-PS-001→004, MVP)
- BUILD-SUP-004.2: Navigation Fix - Handoff
- PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario
- 009.0-auto-results-sync.sql
- 007.0-platform-roles.sql
- PlatformOverview.jsx
- gameguru — Resumen diario 2026-08-03 (Lun)
- QA-SUP-004.1 — Provider Reconciliation Dry Run
- Picks
- GameGuru — Blueprint de cambios
- Instructions for User
- PicksService.js
- Flujos clave
- gameguru — Resumen diario 2026-08-01 (Sáb)
- public.training_sessions
- BUILD-PURGE-RESET-001: Purga total de usuarios y contenido (conservando el superadmin) - Handoff
- PLAN-003 — Rediseño UX de captura de resultados
- 007.2-admin-audit-log.sql
- Handoff
- TrainingCampLobby.jsx
- public.admn_verify_freq
- Auto Results Sync — BUILD-AUTO-SYNC-001 (MVP NFL)
- Topbar.jsx
- Qué se hizo hoy (PLAN-005 diseño + BUILD-TC-001 Lobby + BUILD-TC-002 Entrada oficial + BUILD-TC-003 Event Director)
- QA-SUP-004.2 — Diagnostic: Reconciliation Navigation Issue
- 004.1-season-system.sql
- league/index.js
- Qué se hizo hoy (BUILD-TC-005.1 — Persistencia Supabase + flujo Game Week en modo nube)
- useTrainingSession
- Base de datos (Supabase)
- NFL Data
- 008.0-profiles-created-at.sql
- public.league_can_manage_members
- Cambios
- PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario
- canManageLeague
- 006.2-picks-unique.sql
- 011.0-provider-reconciliation.sql
- 020.0-espn-frequency-budget.sql
- 20260913210000_espn_frequency_budget.sql
- master_games_results_idx
- public.league_roster_open
- SimulationService.js
- Hooks API
- CountdownCard
- PLAN-003 — Rediseño UX de captura de resultados
- game_weeks_sim_state_idx
- getWeekDeadline
- training_sessions_auto_idx
- idx_master_games_game_time
- idx_master_games_game_time
- public.league_games
- Expected Behavior (Theoretical)
- Recommendations
- Problems
- public.league_members
- Critical Diagnostic
- Edge Function Validation
- Frontend UI Review
- public.leagues
- PLAN-021 — Migrar resultados automáticos de API-Sports (free, sin 2026) a scraper ESPN NFL
- weekService.js
- HANDOFF — Mejora de frecuencia de actualización de resultados NFL
- useTrainingSession.js
- HANDOFF-PLAN-021 — Migración a ESPN (resultados NFL temporada 2026)
- event/index.js
- usePicks
- Regular Season Experience (🏆)
- public.profiles
- platform/index.js
- ExperienceWizard.jsx
- HANDOFF — Fix de scores fantasma en semanas abiertas (ESP$N scheduled → 0-0)
- HANDOFF — Panel admin para `platform_admin`: ligas + participantes por role y pestaña "API"
- leagues
- public.leagues
- public.profiles

## God Nodes (most connected - your core abstractions)
1. `useLanguage()` - 93 edges
2. `react` - 54 edges
3. `EventDirector` - 33 edges
4. `navigate()` - 32 edges
5. `GameGuru — Blueprint Completo` - 31 edges
6. `useTrainingSession()` - 30 edges
7. `PLAN-005 — Training Camp Experience (🎓)` - 30 edges
8. `canManageLeague()` - 28 edges
9. `PLAN-SUP-003 — Platform User Management (diseño, READ-ONLY)` - 27 edges
10. `LeagueGamesManager()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Síntoma y causa raíz` --references--> `GameCard()`  [INFERRED]
  docs/handoffs/2026-09-14-scores-fantasma-semanas-abiertas.md → src/components/GameCard.jsx
- `Problema original` --references--> `LeagueGamesManager()`  [INFERRED]
  opencode/plans/PLAN-003.md → src/components/LeagueGamesManager.jsx
- `1. Resumen` --references--> `LeagueIdentity()`  [INFERRED]
  opencode/plans/plan-league-context-01.1.md → src/components/LeagueIdentity.jsx
- `Admin de liga (LeaguePage + LeagueGamesManager)` --references--> `ScoreEditor()`  [INFERRED]
  gameguru.md → src/components/ScoreEditor.jsx
- `Archivos modificados` --references--> `ScoreEditor()`  [INFERRED]
  opencode/plans/blueprint.md → src/components/ScoreEditor.jsx

## Import Cycles
- None detected.

## Communities (131 total, 29 thin omitted)

### Community 0 - "leagues.js"
Cohesion: 0.25
Nodes (23): Contexto, 🛡️ Platform League Management — SUP-002 (2026-08-13, read-only), Qué se hizo, 16. Responsive, Dominio (lógica pura, `src/domains/platform/models/leagues.js`), applyLeagueFilters(), buildFilterOptions(), buildOwnerMap() (+15 more)

### Community 1 - "useLanguage"
Cohesion: 0.16
Nodes (16): Stack, DashboardHeader(), MEDALS, PendingActionCard(), QuickStats(), src_domains_dashboard_dashboard_module, TrainingCampIntro(), TrainingCampProgress() (+8 more)

### Community 2 - "reconciliation/index.js"
Cohesion: 0.06
Nodes (57): Files / áreas cambiadas, ref_node_assert, ref_node_test, AUDIT_ACTIONS, buildAmbiguousPayload(), buildAutoMapPayload(), buildManualOverridePayload(), buildManualRevertPayload() (+49 more)

### Community 3 - "useTrainingCamp.js"
Cohesion: 0.05
Nodes (74): 3. Arquitectura del motor, Contrato común `ResultSource`, NFL_TEAMS, resolveGame(), src_domains_training_camp_autoresults_stableindexofweek, activeWeekOf(), AUTO_GAME_SPACING_MINUTES, AUTO_GAMES_PER_WEEK (+66 more)

### Community 4 - "nflData.js"
Cohesion: 0.15
Nodes (11): LeaderboardTable(), DIVISIONS, INTER_CONF, INTRA_CONF, NFL_WEEKS, TEAM_LOGOS, translateAuthError(), Auth() (+3 more)

### Community 5 - "useLeague.js"
Cohesion: 0.20
Nodes (17): 🏈 Preseason Experience — PS-001→PS-004 implementado (MVP, 2026-08-12), Diagnóstico, Contexto / problema actual, Modelo de datos (PLAN-004, BUILD-004.1), LeagueGamesManager(), genInviteCode(), src_data_nflpreseason2026, src_data_nflschedule2026 (+9 more)

### Community 6 - "navigate"
Cohesion: 0.29
Nodes (23): Contexto de liga por URL — PLAN-LEAGUE-CONTEXT (Fases 1-3 implementadas, BUILD-LEAGUE-CONTEXT-01 2026-08-09), `src/router/` + `src/league/` — contexto de liga por URL (BUILD-LEAGUE-CONTEXT-01, Fases 1-3), Fases implementadas (BUILD-LEAGUE-CONTEXT-01), Qué se construyó, 12. Plan de implementación por fases, 13. Tests, AppInner(), AppShell() (+15 more)

### Community 7 - "package.json"
Cohesion: 0.08
Nodes (25): dependencies, react, react-dom, @supabase/supabase-js, devDependencies, gh-pages, @types/react, @types/react-dom (+17 more)

### Community 8 - "BottomNav.jsx"
Cohesion: 0.40
Nodes (4): 8. Header selector (`Topbar` + `BottomNav`), BottomNav(), src_components_bottomnav_module, NAV_ITEMS

### Community 9 - "EventDirector"
Cohesion: 0.08
Nodes (24): BUILD-TC-003 — Event Director (implementado, sin commitear), Cambios de código (sin commitear), 7. Integraciones con el código existente, 8.3 BUILD-TC-003 — Event Director (implementado 2026-08-04), 8.4 BUILD-TC-004 — Fixture Generation Event (implementado 2026-08-05), 8.5.2 BUILD-TC-005.3 (2026-08-08) — QA end-to-end desbloqueado + admin advance, 8. Roadmap por BUILD (BUILD-TC), Archivos (+16 more)

### Community 10 - "supabase.js"
Cohesion: 0.17
Nodes (18): react, InviteModal(), src_components_invitemodal_module, PublicPicksMatrix(), tdStyle, thStyle, useLeagueData(), useLeagueIdentity() (+10 more)

### Community 11 - "game-week/index.js"
Cohesion: 0.12
Nodes (40): Sistema de Temporadas — PLAN-004 (BUILD-004.1 implementado, wizard pendiente), Training Camp Experience — PLAN-005 (diseño aprobado · BUILD-TC-001/002/003/004/004.2/005 implementados), Decisiones (elegidas por el usuario), Privacy Behavior (PRIVACY-001), Qué se construyó (UX 006.3), Cambios, 3. Decisiones (preguntadas y resueltas), 5. Cambios de código (+32 more)

### Community 12 - "gameguru — Resumen diario 2026-08-13 (Jue)"
Cohesion: 0.06
Nodes (31): API, Completado, Contexto, Contexto, Estado actual del proyecto (fin de sesión 14-ago), FASE 0 — Auditoría live DB (read-only), Fix 1 — Botón "Unirse" visible con ligas, Fix 2 — Contexto de liga persistido en memoria (+23 more)

### Community 13 - "gameguru — Resumen diario 2026-08-08 (Sáb)"
Cohesion: 0.11
Nodes (17): Archivos tocados, Arquitectura propuesta, Estado, Fix, gameguru — Resumen diario 2026-08-08 (Sáb), Handoff, Impacto bug picks (`picks_user_id_game_id_key` / `picks_user_id_week_game_id_key`), Plan por fases (BUILD posterior) (+9 more)

### Community 14 - "BUILD-AUTO-SYNC-002: Security & Scheduler Hardening"
Cohesion: 0.05
Nodes (37): 1. Authorization Fix (CRITICAL), 2. Cron Security, 3. Concurrency Protection, 4. Test Coverage, ✅ Authorization Model, Build, BUILD-AUTO-SYNC-002: Security & Scheduler Hardening, ✅ Code Complete (+29 more)

### Community 15 - "reconcile/index.ts"
Cohesion: 0.25
Nodes (12): ref_https, corsHeaders, executeApply(), executeDryRun(), executeRollback(), isManualOverride(), matchGame(), parseGameTime() (+4 more)

### Community 16 - "SUP-004 Deployment & QA Report"
Cohesion: 0.06
Nodes (35): 8 Action Types, Appendix: Audit Action Types (Complete List), Audit Security, Audit System, Authentication & Authorization, Backfill Status, Before/After State, Build Status (+27 more)

### Community 17 - "sports/index.js"
Cohesion: 0.19
Nodes (15): ref_node_fs, ref_node_path, ref_node_url, apiErrorList(), createEspnNflAdapter(), apiRequest(), espnProvider, normalizeGame() (+7 more)

### Community 18 - "App.jsx"
Cohesion: 0.15
Nodes (18): react-dom, App(), src_components_leaguegamesmanager_module, formatLastSync(), src_components_syncstatus_module, SyncStatus(), canReadPlatform(), isPlatformAdmin() (+10 more)

### Community 19 - "LeagueContext.jsx"
Cohesion: 0.19
Nodes (14): Archivos tocados, Contexto y decisión de diseño (RLS verificada en BD), Handoff, Notas / decisiones, Sesión 7 — BUILD-LEAGUE-CONTEXT-01 (Fases 1-3: mini-router, LeagueContext, LeagueRoute), Verificación, hydrateLeague(), clearActiveLeagueId() (+6 more)

### Community 20 - "HANDOFF — Incidente: "Apply borró resultados" (producción)"
Cohesion: 0.14
Nodes (13): Agente / Modelo, Archivos y áreas tocadas (sesión previa, ya desplegados), Causa raíz confirmada: cron `results-sync` falla "ESPN 400", Causa raíz (código), Decisiones del PO, Evidencia de QA, Hallazgos verificados (solo lecturas), HANDOFF — Incidente: "Apply borró resultados" (producción) (+5 more)

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
Nodes (31): 1. Disable Cron Job, 1. Sourcede datos: ESPN (scoreboard público), 2. Cron Secret, 2. Delete Edge Function, 3. Required Extensions, 3. Revert Database Changes (if needed), Auto-Results Sync - Deployment Guide, Concurrency Protection (+23 more)

### Community 25 - "modes.js"
Cohesion: 0.21
Nodes (12): LEAGUE_MODES, src_domains_platform_index_default_page_size, DEFAULT_PAGE_SIZE, src_pages_platformleagues_module, fmt(), lastPickOf(), src_pages_platformuserdetail_module, PlatformUserDetail() (+4 more)

### Community 27 - "espn-nfl.ts"
Cohesion: 0.22
Nodes (13): Cambios, Files y áreas cambiadas, Residual risks, Alcance / archivos a modificar, Riesgos residuales, apiErrorList(), fetchGamesByDate(), fetchGamesBySeason() (+5 more)

### Community 28 - "TeamLogo.jsx"
Cohesion: 0.26
Nodes (7): Nuevos archivos, src_components_createsimulationmodal_module, TEAM_LIST, src_components_gamecard_module, GameTime(), TeamLogo(), AuditSnapshotPage()

### Community 29 - "ScoreEditor"
Cohesion: 0.22
Nodes (11): 🎯 Actualizaciones parciales de marcador — BUILD-SCORE-001 (2026-08-13), Captura de resultados — PLAN-003 (ScoreEditor universal), Cambios, Contexto, Pendientes, QA, Sesión 10b — 🎯 Actualizaciones parciales de marcador (BUILD-SCORE-001), BUILD-SCORE-001 (2026-08-13) — Actualizaciones parciales de marcador (+3 more)

### Community 30 - "public.game_weeks"
Cohesion: 0.26
Nodes (11): game_weeks_league_idx, game_weeks_session_idx, pick_submissions_week_idx, picks_session_idx, public.game_weeks, public.pick_submissions, public, public.leagues (+3 more)

### Community 31 - "standings.test.js"
Cohesion: 0.21
Nodes (11): calcStandings(), calcStreak(), calcStreaks(), resolveResult(), sortFinishedByTime(), gameA, gameB, gameC (+3 more)

### Community 32 - "012.0-auth-nickname-reveal.sql"
Cohesion: 0.20
Nodes (6): public.protect_league_member_nickname, public.protect_league_reveal_lifecycle, league_members_nickname_per_league_key, public.league_members, trg_protect_league_member_nickname, trg_protect_league_reveal_lifecycle

### Community 33 - "010.0-adaptive-sync.sql"
Cohesion: 0.24
Nodes (8): api_budget, check_budget(), idx_api_budget_provider_date, idx_master_games_game_time, idx_master_games_sync_state, master_games, public.api_budget, sync_cooldown_config

### Community 34 - "results-sync/index.ts"
Cohesion: 0.27
Nodes (6): classifyWindow(), corsHeaders, etDateFmt, schedulerDecision(), toDateKey(), updateSyncState()

### Community 35 - "public.pick_snapshots"
Cohesion: 0.31
Nodes (8): pick_snapshots_hash_idx, pick_snapshots_league_idx, pick_snapshots_week_idx, public.pick_snapshots, public.game_weeks, public.leagues, public.training_sessions, training_sessions_v2_state_idx

### Community 36 - "apiSportsNfl.js"
Cohesion: 0.36
Nodes (4): createApiSportsNflAdapter(), SEASON_TYPE_MAPPING, STATUS_MAPPING, TEAM_MAPPING

### Community 37 - "PLAN-SUP-003 — Platform User Management (diseño, READ-ONLY)"
Cohesion: 0.06
Nodes (35): 10. League Relationship, 11. Platform Overview (`#/platform`), 12. Performance, 13. Auth data (cómo se consulta de forma segura), 14. Authorization, 15. Read-only (confirmación de alcance), 17. Empty / Loading / Error, 18. Routing (+27 more)

### Community 38 - "BUILD-SUP-004 — Provider Game Reconciliation"
Cohesion: 0.07
Nodes (29): Acceptance Criteria, Authorization, Backfill Status, BUILD-010 Integration, BUILD-SUP-004 — Provider Game Reconciliation, Componentes implementados:, Coverage, Database (+21 more)

### Community 39 - "BUILD-010 — Adaptive NFL Results Sync + API Budget"
Cohesion: 0.07
Nodes (26): 1. Migración 010.0, 2. Scheduler Adaptativo, 3. API-Sports Batch by Date, 4. Budget Atómico, 5. Reconciliation, 6. Frontend Budget Display, Acceptance Criteria, API Consumption (+18 more)

### Community 40 - "SuperAdmin / Plataforma — SUP-000 + SUP-001 + SUP-002 + SUP-003 (implementado 2026-08-13)"
Cohesion: 0.12
Nodes (16): BUILD-SCORE-001 (2026-08-13) — impacto en plataforma, Contexto y regla crítica, Decisión clave — FKs reales de la BD viva (check `check-fks.mjs`), FASE 0 — Auditoría live DB (read-only), Fuera de alcance / backlog, Migraciones aplicadas (idempotentes, vía Management API), Migración `supabase/008.0-profiles-created-at.sql` (aplicada a BD viva, idempotente), Modelo de roles real (auditoría BUILD-SUP-DOC-001, read-only 2026-08-13) (+8 more)

### Community 41 - "users.js"
Cohesion: 0.39
Nodes (18): 🛡️ Platform User Management — SUP-003 (2026-08-13, read-only), Dominio, 21. Tests (harness `regression.mjs`), API (`src/supabase.js`, `platformApi`), Dominio (lógica pura, `src/domains/platform/models/users.js`), applyUserFilters(), applyUserSearch(), assembleUserIndex() (+10 more)

### Community 42 - "GameGuru — Blueprint Completo"
Cohesion: 0.13
Nodes (15): 🎯 Acciones de semana en My Picks — BUILD-UX (2026-08-12), Arquitectura orientada a dominios (Feature First), Convenciones de código, Design Tokens (`global.css`), Estrategia de migración (PLAN-001), Estructura del proyecto, Experiencias oficiales (referencias), GameGuru — Blueprint Completo (+7 more)

### Community 43 - "routes.js"
Cohesion: 0.15
Nodes (14): LEAGUE_PAGES, LEGACY, LEGACY_PAGES, PAGES, isMemberOf(), leaguePicksRoute(), leagueRoute(), leagueStandingsRoute() (+6 more)

### Community 44 - "Preseason Experience (🏈)"
Cohesion: 0.25
Nodes (8): Backlog post-Preseason, Comportamiento, Freeze (2026-08-12) — Go-Live Readiness Audit, Modelo de datos (PLAN-004, BUILD-004.1), Preseason Experience (🏈), Riesgos, Verificación (2026-08-12), Visión

### Community 45 - "PLAN-005 — Training Camp Experience (🎓)"
Cohesion: 0.06
Nodes (35): Qué se construyó, Sesión 3 — BUILD-TC-006.2 (Orquestación automática de la simulación), Verificación (harness A–K, réplica exacta del flujo del hook), 10. Recomendaciones del Arquitecto, 1. Principio arquitectónico clave, 2. Los 9 estados del evento, 4. Velocidades (`time_per_game_ms` por batch), 6.1 Identidad visual del Training Camp (decisión 2026-08-04) (+27 more)

### Community 46 - "Sesión 9 — 🏈 Preseason (BUILD-PS-001→004, MVP)"
Cohesion: 0.11
Nodes (18): Cambios (solo layout), Contexto, Contexto, Contexto y alcance MVP (decisión del usuario), gameguru — Resumen diario 2026-08-12 (Mié), Pendientes, Pendientes (mañana), PS-001 — Semanas derivadas de la fase (+10 more)

### Community 47 - "BUILD-SUP-004.2: Navigation Fix - Handoff"
Cohesion: 0.14
Nodes (13): Archivos de Documentación, Build, BUILD-SUP-004.2: Navigation Fix - Handoff, Código en Bundle, Deployment, Estado Final, Importante, Navegación Esperada (+5 more)

### Community 48 - "PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario"
Cohesion: 0.14
Nodes (15): Routing (hash-based), Rutas legacy, Rutas nuevas (`src/router/hashRouter.js` + `routes.js`), 11. Impacto sobre Picks / Standings + bug `picks_user_id_game_id_key`, 14. Riesgos, 15. Preguntas resueltas / pendientes, 1. Summary, 2. Hallazgo QA actual (+7 more)

### Community 49 - "009.0-auto-results-sync.sql"
Cohesion: 0.39
Nodes (7): master_games_external_game_unique, master_games_provider_idx, master_games, sync_runs, sync_runs_provider_idx, sync_runs_started_idx, sync_runs_status_idx

### Community 51 - "PlatformOverview.jsx"
Cohesion: 0.24
Nodes (15): SUP-001 — Consola + dominio, SUP-001 — Consola read-only + dominio, DEFAULT_TIMEZONE, isValidTimezone(), resolveTimezone(), computeHealthSummary(), computeOverviewMetrics(), computeTodayGames() (+7 more)

### Community 52 - "gameguru — Resumen diario 2026-08-03 (Lun)"
Cohesion: 0.14
Nodes (13): Auditoría (resultado: la app ya era mayormente conforme), BUILD-004.1 — Persistencia del Sistema de Temporadas (IMPLEMENTADO), Cambios implementados, Datos/estado, Decisiones del usuario, Estado de git, Fix navegación (bugs previos), gameguru — Resumen diario 2026-08-03 (Lun) (+5 more)

### Community 53 - "QA-SUP-004.1 — Provider Reconciliation Dry Run"
Cohesion: 0.13
Nodes (14): APPLY Status, Audit Validation, Code Review, Database Validation, Edge Function Logic, Executive Summary, Frontend Deployment, QA-SUP-004.1 — Provider Reconciliation Dry Run (+6 more)

### Community 54 - "Picks"
Cohesion: 0.14
Nodes (19): `src/utils/` — lógica transversal compartida, Auditoría previa (conforme sin cambios), 1. Modelo de datos recomendado, 3. Comportamiento por modo, 4. Integración con proveedores (arquitectura existente), 5. Compatibilidad / migración segura, 7. Roadmap por BUILD, 8. Riesgos (+11 more)

### Community 55 - "GameGuru — Blueprint de cambios"
Cohesion: 0.05
Nodes (40): Archivo modificado, Archivo modificado, Archivo modificado, Archivos modificados, Archivos modificados, Auto-selección de última semana disponible, Bloqueo por tiempo real (no por envío), Bugs corregidos (+32 more)

### Community 56 - "Instructions for User"
Cohesion: 0.17
Nodes (12): Instructions for User, Step 10: Verify Audit, Step 11: Report Results, Step 1: Deploy Frontend, Step 2: Access GameGuru, Step 3: Login as platform_superadmin, Step 4: Navigate to Reconciliation, Step 5: Execute Dry Run (Preseason) (+4 more)

### Community 57 - "PicksService.js"
Cohesion: 0.38
Nodes (3): readLocalSubs(), subKey(), writeLocalSubs()

### Community 58 - "Flujos clave"
Cohesion: 0.20
Nodes (10): Admin de liga (LeaguePage + LeagueGamesManager), Crear liga real, Crear liga simulación (solo superadmin), Flujos clave, Leaderboard, Login / Registro, Picks, Picks Públicos (+2 more)

### Community 59 - "gameguru — Resumen diario 2026-08-01 (Sáb)"
Cohesion: 0.25
Nodes (7): BUILD-002.1 ✅ — Unificar Home y Dashboard ("Home = Dashboard"), BUILD-002 ✅ — Dashboard completo (experiencia fantasy), Datos confirmados (no re-investigar), Estado de git, gameguru — Resumen diario 2026-08-01 (Sáb), Qué se hizo hoy (BUILD-001 + BUILD-002 + BUILD-002.1), Referencias clave

### Community 60 - "public.training_sessions"
Cohesion: 0.43
Nodes (6): public.training_sessions, public, public.leagues, training_sessions_event_type_idx, training_sessions_league_idx, training_sessions_state_idx

### Community 61 - "BUILD-PURGE-RESET-001: Purga total de usuarios y contenido (conservando el superadmin) - Handoff"
Cohesion: 0.20
Nodes (9): Archivo creado, BUILD-PURGE-RESET-001: Purga total de usuarios y contenido (conservando el superadmin) - Handoff, Decisiones del PO (PLAN aprobado 2026-09-01), Estado Final, Nivel de Riesgo, Próximo paso recomendado (orden estricto), Resumen, Riesgos residuales (+1 more)

### Community 62 - "PLAN-003 — Rediseño UX de captura de resultados"
Cohesion: 0.20
Nodes (9): Alternativas evaluadas, Archivos modificados, Decisión de diseño, Implementación, Nuevos archivos, PLAN-003 — Rediseño UX de captura de resultados, Problema original, Sin cambios (+1 more)

### Community 63 - "007.2-admin-audit-log.sql"
Cohesion: 0.47
Nodes (4): auth.users, idx_admin_audit_log_actor, idx_admin_audit_log_entity, public.admin_audit_log

### Community 64 - "Handoff"
Cohesion: 0.20
Nodes (10): Apply, Database, Deployment, Dry Run, Files, Handoff, Next Step, Security (+2 more)

### Community 65 - "TrainingCampLobby.jsx"
Cohesion: 0.17
Nodes (19): BUILD-TC-001 — Lobby del Training Camp (implementado, sin commitear), Alcance entregado, Decisiones, Qué se hizo hoy (BUILD-TC-004 — Fixture Generation Event), Alcance entregado, src_domains_game_week_index_gameweekview, fmtStart(), pad() (+11 more)

### Community 66 - "public.admn_verify_freq"
Cohesion: 0.40
Nodes (4): cron.job, public.sync_cooldown_config, public.admn_verify_freq(), public.api_budget

### Community 67 - "Auto Results Sync — BUILD-AUTO-SYNC-001 (MVP NFL)"
Cohesion: 0.22
Nodes (8): Architecture, Auto Results Sync — BUILD-AUTO-SYNC-001 (MVP NFL), Deployment Checklist, Files Changed, Handoff, Simulation Protection, Summary, Tests

### Community 68 - "Topbar.jsx"
Cohesion: 0.11
Nodes (18): Build, BUILD-SUP-004.2: Navigation Fix, Deployment, Fix, Navigation, Next Step, Tests, Verification Checklist (+10 more)

### Community 69 - "Qué se hizo hoy (PLAN-005 diseño + BUILD-TC-001 Lobby + BUILD-TC-002 Entrada oficial + BUILD-TC-003 Event Director)"
Cohesion: 0.33
Nodes (5): Datos/estado, gameguru — Resumen diario 2026-08-04 (Mar), Pendiente, PLAN-005 — Training Camp Experience (diseño aprobado), Qué se hizo hoy (PLAN-005 diseño + BUILD-TC-001 Lobby + BUILD-TC-002 Entrada oficial + BUILD-TC-003 Event Director)

### Community 70 - "QA-SUP-004.2 — Diagnostic: Reconciliation Navigation Issue"
Cohesion: 0.22
Nodes (8): Browser Validation Steps, Deployment Status, Files to Modify, QA-SUP-004.2 — Diagnostic: Reconciliation Navigation Issue, Questions, Root Cause Identified, Solution, Testing

### Community 71 - "004.1-season-system.sql"
Cohesion: 0.40
Nodes (4): leagues_league_mode_idx, master_games_phase_idx, leagues, master_games

### Community 72 - "league/index.js"
Cohesion: 0.06
Nodes (49): Archivos y áreas modificadas, BUILD-AUTH-NICK-001: Email/Google auth + nickname por liga + revelar nombres - Handoff, Datos (migración — NO APLICADA aún), Decisiones pendientes, Dominio puro (lógica testeada), Estado Final, Infraestructura de datos cliente, Nivel de Riesgo (+41 more)

### Community 73 - "Qué se hizo hoy (BUILD-TC-005.1 — Persistencia Supabase + flujo Game Week en modo nube)"
Cohesion: 0.25
Nodes (7): Estado, Fix A (DB) — upsert de picks, Fix B (app) — GameWeekContext con sesión FG, gameguru — Resumen diario 2026-08-07 (Vie), Migraciones, Qué se hizo hoy (BUILD-TC-005.1 — Persistencia Supabase + flujo Game Week en modo nube), Verificación

### Community 74 - "useTrainingSession"
Cohesion: 0.12
Nodes (29): Estado actual (2026-08-04), BUILD-TC-005 — Game Week & Picks (implementado 2026-08-05, sin commitear), Datos/estado, gameguru — Resumen diario 2026-08-05 (Mié), Pendiente, PLAN-TC-005 — Game Week & Picks (diseño aprobado 2026-08-05, sin implementar), Integración al contrato, 8.5.1 BUILD-TC-005 — alcance entregado (2026-08-05) (+21 more)

### Community 75 - "Base de datos (Supabase)"
Cohesion: 0.29
Nodes (7): Base de datos (Supabase), `league_games`, `league_members`, `leagues`, `master_games`, `picks`, `profiles`

### Community 76 - "NFL Data"
Cohesion: 0.29
Nodes (7): `generateNFLSchedule(season)`, `genInviteCode()`, NFL Data, `NFL_TEAMS`, `NFL_WEEKS` (mock estático, solo semanas 1-2), `SPORTS`, `translateAuthError(msg)`

### Community 77 - "008.0-profiles-created-at.sql"
Cohesion: 0.40
Nodes (4): league_members_user_id_idx, profiles_created_at_idx, public.league_members, public.profiles

### Community 78 - "public.league_can_manage_members"
Cohesion: 0.60
Nodes (4): public.league_can_manage_members(), public.league_remove_member(), public.league_members, public.leagues

### Community 79 - "Cambios"
Cohesion: 0.20
Nodes (20): Archivos legacy / no utilizados, 🧭 Navegación multi-liga — Fix UX (2026-08-14), `src/domains/dashboard/` — Home / dashboard, 🕐 Timezone por liga — TZ-001→TZ-005 implementado (2026-08-12), Verificación, Archivos modificados, Filosofía, Cambios (+12 more)

### Community 80 - "PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario"
Cohesion: 0.40
Nodes (5): Ajustes de alcance (detectados por QA), Decisión (elegida por el usuario), Pendiente (BUILD-LEAGUE-CONTEXT-02 en adelante), PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario, Verificación

### Community 81 - "canManageLeague"
Cohesion: 0.29
Nodes (11): Archivos modificados, BUILD-002.1 — Unificar Home y Dashboard (Experiencia Fantasy First), Notas, Nuevos archivos, Verificación, Pendiente para mañana, LeagueDashboard(), LeaguesOverview() (+3 more)

### Community 82 - "006.2-picks-unique.sql"
Cohesion: 0.67
Nodes (3): picks_league_idx, picks_league_week_idx, public.picks

### Community 83 - "011.0-provider-reconciliation.sql"
Cohesion: 0.67
Nodes (3): idx_master_games_candidate_lookup, idx_master_games_mapping_status, master_games

### Community 88 - "SimulationService.js"
Cohesion: 0.11
Nodes (23): Bugs reales encontrados por el QA E2E y corregidos, Migraciones aplicadas en la nube (bloqueante destrabado), Qué se construyó (dominio `src/domains/simulation/`, 4 módulos aprobados en PLAN-TC-006), Sesión 2 — BUILD-TC-006.1 (Simulation Engine: núcleo, sin UX), Sesión 4 — BUILD-TC-006.3 (UX de Simulation + Results sobre el motor TC-006.1/006.2) + CIERRE EN LA NUBE, Verificación (harness `/tmp/opencode/regression.mjs` + mock), Verificación (harness `/tmp/opencode/regression.mjs` + QA browser), Bugs reales corregidos (encontrados por el QA E2E) (+15 more)

### Community 89 - "Hooks API"
Cohesion: 0.40
Nodes (5): Hooks API, `useAuth()`, `useLeague(user)`, `usePicks(user, league, week)`, `useSuperAdmin(user)`

### Community 90 - "CountdownCard"
Cohesion: 0.27
Nodes (9): Bugs conocidos y notas, BUILD-002 — MVP del nuevo Home Dashboard (Fase 1 de PLAN-001), Notas y riesgos, Verificación, generateNFLSchedule(), CountdownCard(), fmtDeadline(), fmtLeft() (+1 more)

### Community 91 - "PLAN-003 — Rediseño UX de captura de resultados"
Cohesion: 0.40
Nodes (5): Archivos modificados, Decisión (elegida por el usuario), Nuevos archivos, PLAN-003 — Rediseño UX de captura de resultados, Verificación

### Community 93 - "getWeekDeadline"
Cohesion: 0.18
Nodes (17): Archivos modificados, Archivos modificados, BUILD-001 — Preparación de arquitectura del nuevo Dashboard, Notas y riesgos, Nuevos archivos, `src/pages/Leaderboard.jsx`, `src/pages/Picks.jsx`, BUILD-001 ✅ — Base compartida (+9 more)

### Community 99 - "Expected Behavior (Theoretical)"
Cohesion: 0.67
Nodes (3): DAL vs ARI (Regular Week 8, 2026-11-01), Expected Behavior (Theoretical), TEN vs SEA (Preseason Week 3, 2026-08-24)

### Community 100 - "Recommendations"
Cohesion: 0.67
Nodes (3): If Dry Run Fails, Immediate Actions, Recommendations

### Community 101 - "Problems"
Cohesion: 0.67
Nodes (3): Problem 1: Frontend Not Deployed, Problem 2: Cannot Execute Dry Run, Problems

### Community 109 - "PLAN-021 — Migrar resultados automáticos de API-Sports (free, sin 2026) a scraper ESPN NFL"
Cohesion: 0.20
Nodes (9): Contexto, Decisiones del PLAN, Decisión del PO: Scrapping de resultados (elegido), Fuente ESPN — endpoint validado hoy, Pendiente antes de BUILD, PLAN-021 — Migrar resultados automáticos de API-Sports (free, sin 2026) a scraper ESPN NFL, QA / validación (mínima para hoy), Root cause hallada (validada en producción) (+1 more)

### Community 110 - "weekService.js"
Cohesion: 0.15
Nodes (10): trainingCampPicksService, gamesKey(), readLocalGames(), readLocalWeeks(), trainingCampWeekService, weeksKey(), writeLocalGames(), writeLocalWeeks() (+2 more)

### Community 111 - "HANDOFF — Mejora de frecuencia de actualización de resultados NFL"
Cohesion: 0.18
Nodes (10): Cambios de esta petición (por qué y cómo), Decisiones del PO (2026-09-13), Evidencia de QA en producción (2026-09-13 ~22:18 UTC), Files / áreas cambiadas, HANDOFF — Mejora de frecuencia de actualización de resultados NFL, Límite diario del API y ventanas del calendario (análisis PO), Riesgos residuales, Siguiente paso recomendado (monitoreo) (+2 more)

### Community 112 - "useTrainingSession.js"
Cohesion: 0.11
Nodes (27): BUILD-TC-004.2 — Estabilización (misma jornada), Hardening defensivo, mapPhase(), levelLabelKey(), roundUp(), TrainingCampSetupForm(), GAME_COUNT_OPTIONS, TRAINING_LEVELS (+19 more)

### Community 113 - "HANDOFF-PLAN-021 — Migración a ESPN (resultados NFL temporada 2026)"
Cohesion: 0.25
Nodes (7): Agent, model y variant, HANDOFF-PLAN-021 — Migración a ESPN (resultados NFL temporada 2026), Pending decisions, Recommended next step, Risk level, Summary, Tests y QA evidence

### Community 114 - "event/index.js"
Cohesion: 0.11
Nodes (19): EVENT_ACTIONS, EVENT_TYPES, FIXTURE_STATES, STEPS, buildCalendar(), fmtLocal(), mulberry32(), roundRobinRounds() (+11 more)

### Community 115 - "usePicks"
Cohesion: 0.14
Nodes (17): gameguru — Resumen diario 2026-08-09 (Dom), Hallazgo de fondo (QA-MULTI-LEAGUE-DIAGNOSTIC), Pendientes, QA, Sesión 8 — PLAN-LEAGUE-CONTEXT-01.1 (corrección del aislamiento multi-liga), 1. Resumen, 2. Hallazgo QA (fuente de verdad), 4. Cambios de esquema — `supabase/006.2-picks-unique.sql` (+9 more)

### Community 116 - "Regular Season Experience (🏆)"
Cohesion: 0.24
Nodes (5): Comportamiento, Regular Season Experience (🏆), Riesgos, Roadmap por BUILD (BUILD-RS), Visión

### Community 118 - "platform/index.js"
Cohesion: 0.14
Nodes (27): Cambios, src_domains_platform_index_default_users_page_size, computeBudgetSummary(), CRON_REFERENCE, defaultBudgetLimits(), formatCooldown(), orderCooldownWindows(), PROVIDER_LIMITS (+19 more)

### Community 119 - "ExperienceWizard.jsx"
Cohesion: 0.15
Nodes (16): PLAN-004 — Sistema de Temporadas (Practice / Preseason / Regular) — SOLO DISEÑO, BUILD-TC-002 — Experience Picker + Entrada Oficial (implementado, sin commitear), 2. Wizard de creación ("elegir una experiencia"), 6. UX, 10. Compatibilidad con Training Camp / Game Week / Simulation, 5. Wizard de configuración (pasos), Decisiones de entrada, JoinLeagueModal() (+8 more)

### Community 120 - "HANDOFF — Fix de scores fantasma en semanas abiertas (ESP$N scheduled → 0-0)"
Cohesion: 0.29
Nodes (6): Decisiones, HANDOFF — Fix de scores fantasma en semanas abiertas (ESP$N scheduled → 0-0), Riesgos residuales, Siguiente paso recomendado, Síntoma y causa raíz, Tests / QA

### Community 121 - "HANDOFF — Panel admin para `platform_admin`: ligas + participantes por role y pestaña "API""
Cohesion: 0.33
Nodes (5): Decisiones del PO (aprobadas antes del BUILD), HANDOFF — Panel admin para `platform_admin`: ligas + participantes por role y pestaña "API", Pending decisions / siguiente paso, Riesgos residuales, Tests / QA

## Knowledge Gaps
- **620 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+615 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 805 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useLanguage()` connect `useLanguage` to `useTrainingCamp.js`, `nflData.js`, `navigate`, `supabase.js`, `game-week/index.js`, `App.jsx`, `TeamLogo.jsx`, `ScoreEditor`, `PLAN-LEAGUE-CONTEXT — Gestión de múltiples ligas por usuario`, `Picks`, `TrainingCampLobby.jsx`, `Topbar.jsx`, `league/index.js`, `useTrainingSession`, `Cambios`, `canManageLeague`, `CountdownCard`, `useTrainingSession.js`, `ExperienceWizard.jsx`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `react` connect `supabase.js` to `leagues.js`, `useLanguage`, `useTrainingCamp.js`, `nflData.js`, `useLeague.js`, `package.json`, `game-week/index.js`, `App.jsx`, `LeagueContext.jsx`, `modes.js`, `TeamLogo.jsx`, `ScoreEditor`, `PlatformOverview.jsx`, `TrainingCampLobby.jsx`, `league/index.js`, `Cambios`, `CountdownCard`, `useTrainingSession.js`, `usePicks`, `platform/index.js`, `ExperienceWizard.jsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `LeagueGamesManager()` connect `useLeague.js` to `supabase.js`, `game-week/index.js`, `Cambios`, `App.jsx`, `HANDOFF — Incidente: "Apply borró resultados" (producción)`, `Picks`, `ExperienceWizard.jsx`, `PLAN-003 — Rediseño UX de captura de resultados`, `ScoreEditor`, `PLAN-003 — Rediseño UX de captura de resultados`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `useLanguage()` (e.g. with `Stack` and `UI`) actually correct?**
  _`useLanguage()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `EventDirector` (e.g. with `Training Camp Experience — PLAN-005 (diseño aprobado · BUILD-TC-001/002/003/004/004.2/005 implementados)` and `Decisiones (elegidas por el usuario)`) actually correct?**
  _`EventDirector` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `navigate()` (e.g. with `Contexto de liga por URL — PLAN-LEAGUE-CONTEXT (Fases 1-3 implementadas, BUILD-LEAGUE-CONTEXT-01 2026-08-09)` and ``src/router/` + `src/league/` — contexto de liga por URL (BUILD-LEAGUE-CONTEXT-01, Fases 1-3)`) actually correct?**
  _`navigate()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _620 weakly-connected nodes found - possible documentation gaps or missing edges._