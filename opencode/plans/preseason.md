# Preseason Experience (🏈)

**Estado**: ✅ **GO / FROZEN** (2026-08-12) — implementado (PS-001→PS-004, alcance MVP) y **congelado para el inicio de la pretemporada**. Pendiente (post-preseason): provider real + resultados automáticos (PS-002-orig / PS-003-orig, ver tabla + Backlog).

## Visión

La experiencia **🏈 Pretemporada** es una liga **exclusiva** de calendario oficial. Enseña a los usuarios cómo jugar GameGuru en un entorno con el calendario real de pretemporada (fases `preseason`, semanas 1–4), con resultados provistos por el motor oficial (no manuales). Es el paso intermedio entre el 🎓 Training Camp (aprendizaje simulado) y la 🏆 Temporada Regular (la experiencia completa).

## Modelo de datos (PLAN-004, BUILD-004.1)

- `leagues.league_mode = 'preseason'`.
- `leagues.season` (default `'2026'`).
- `master_games.phase = 'preseason'` desambigua la colisión de `week` con la regular (semanas 1–4 de pretemporada vs 1–18 de regular).
- Clave canónica `(sport, season, phase)` ya existente.
- **Identidad visual (decisión 2026-08-04)**: color teal `#14B8A6` (token `--mode-ps`), ícono 🏈, banner "Pretemporada", mensajes de puesta a punto. Ver índice de experiencias en `blueprint.md`.

## Comportamiento

| Funcionalidad | 🏈 Pretemporada |
|---|---|
| Importar del calendario maestro | ✅ fase `preseason` |
| Agregar juego manual | ❌ |
| Captura manual de resultados | ⚠ solo provider offline (con aviso `manager.manualResultWarning`) |
| Resultados por proveedor | ⏳ pendiente (provider real; MVP: captura manual con aviso ⚠) |
| Dashboard completo | ✅ |
| Leaderboards (semanal + general) | ✅ |
| Estadísticas | ✅ |
| Noticias (futuro) | ❌ |
| PRIVACY-001 | ✅ aplica (picks privados hasta el cierre) |

## Integración con proveedores

`espnProvider (preseason) → adapter.mapProviderGame → sportsRepository.getSchedule/getScoreboard → sportsService.syncSeason({ sport, season, phase: 'preseason' })`
- `sportsService.syncSeason` hace upsert en `master_games` y propaga scores a `league_games` por `master_game_id` de ligas oficiales de esa fase.
- **SuperAdmin** = hub de sincronización ("Sincronizar NFL 2026", incluye pretemporada).
- Deadline de picks: semanal (1h antes del primer partido de la semana de la fase), igual que Regular — `getWeekDeadline`/`isWeekLocked` de `src/utils/dates.js`.

> **Nota MVP (2026-08-12)**: el provider real y los resultados automáticos quedan **pendientes**. El calendario de pretemporada viene de `src/data/nflPreseason2026.json` (49 juegos, semanas 1–4) cargado a `master_games.phase='preseason'` (vía service_role; RLS bloquea anon). Los resultados se capturan manualmente en ligas oficiales con aviso ⚠ `manager.manualResultWarning` (regla de contingencia).

## Roadmap por BUILD (BUILD-PS)

| BUILD | Contenido | Resultado | Estado |
|---|---|---|---|
| **PS-001** | Derivar semanas de la fase de la liga (`Picks`/`PublicPicks` reemplazan `TOTAL_WEEKS=18`); filtro por fase en import de `LeagueGamesManager` | Pretemporada legible/importable | ✅ |
| **PS-002** | SuperAdmin por fase (selector regular/preseason, carga/delete por `phase`, `game_id` con prefijo `psw`) + calendario en `src/data/nflPreseason2026.json` cargado a BD | Calendario de pretemporada real (49 juegos) | ✅ (MVP: JSON en repo, no provider) |
| **PS-003** | Rangos por fase (tabs data-driven, `getAll(sport, season, phase)`), gating de "Agregar juego manual" en oficiales, ScoreEditor con prop `official` + aviso ⚠ `manager.manualResultWarning` | Sin captura manual (excepto contingencia con aviso) | ✅ (MVP) |
| **PS-004** | Pulido: badge de modo (🏈 Pretemporada) en `LeagueIdentity` con tokens `--mode-ps`, colores por modo | Experiencia completa | ✅ |
| **PS-002-orig / PS-003-orig** | Provider real `espnProvider` + `syncSeason` con fase + propagación automática de resultados | Calendario/resultados del proveedor | ⏳ Pendiente |

Depende de BUILD-004.4 (gating por modo) y BUILD-004.5/004.6 (provider + resultados automáticos) del roadmap de PLAN-004.

## Verificación (2026-08-12)

- Harness de regresión: **294 PASS / 0 FAIL**.
- QA end-to-end (`/tmp/opencode/qae2e/qa-preseason.mjs`): **15 PASS / 0 FAIL** — liga preseason creada por wizard importa 49 `league_games` (prefijo `psw*`; semanas {1:1, 2:16, 3:16, 4:16}); Picks y Manager muestran tabs 1–4; chip 🏈; "Agregar juego manual" oculto; ScoreEditor muestra aviso ⚠; Standings renderiza.
- `master_games`: 272 regular + 49 preseason.

## Freeze (2026-08-12) — Go-Live Readiness Audit

Veredicto de auditoría: **GO**. Decisión de producto: **CONGELAR Preseason MVP** (no más BUILDs funcionales antes del inicio de la pretemporada).

- **Blockers**: 0. **High Risks bloqueantes**: 0.
- Harness final: **294/294**. `npm run build`: ✅ (único warning: chunk >500 kB, pre-existente).
- QA browser previamente validado: **15/15** (no re-ejecutado en el freeze; nada de `src/` cambió tras esa corrida).
- Data: 49 preseason (weeks 1–4) + 272 regular, sin duplicados, JSON↔BD exacto.
- Riesgos Medium/Low NO ocultos — ver Backlog.

## Backlog post-Preseason

Sin bloquear el MVP. Orden recomendado:

1. **Provider real** (`espnProvider` + adapter + `syncSeason` con fase) — PS-002-orig.
2. **Sincronización automática de resultados** — PS-003-orig (propagación a `league_games`).
3. **Reconciliación manuales vs provider** (regla: el provider manda; manual solo en contingencia).
4. **RLS UPDATE en `master_games`** (solo superadmin): hoy no existe policy de UPDATE → `setScoresByGameId` falla en silencio (afecta a Regular igual que a Preseason; sin impacto visible porque las vistas de liga leen `league_games`).
5. **Eliminar hardcode de season `'2026'`** en `LeagueGamesManager.jsx:137` (usar `getLeagueSeason(league)`).
6. **Validar carga por fase con JWT real** (botón "Cargar {fase}" del SuperAdmin; policy INSERT superadmin existe; la carga real ya se hizo vía service_role).
7. **Limpieza por fase de `league_games`** huérfanas al borrar el calendario maestro (`deleteAll` solo borra master).
8. **Decisión de producto para empates** (resultado nulo = nadie acierta; pre-existente).
9. Otros Medium/Low de la auditoría: Semana 1 (HOF 08-07) ya pasada y sin resultado (ingresar manualmente si se desea); `[useTrainingSession]` console.error en ligas sin evento TC; `console.log` en `Leaderboard.jsx:69`; QA legacy `QA-TC0053/0063` en `league_games` (130 filas) pendiente de limpieza; strings hardcoded ES en SuperAdmin (pre-existente).

## Riesgos

1. **Calendario en JSON (MVP)**: `nflPreseason2026.json` es snapshot; desactualizará vs. proveedor → mitigado cuando llegue PS-002-orig (provider real). RLS bloquea inserts anon a `master_games` (botón SuperAdmin sin verificar; carga vía service_role).
2. Colisión de `week` entre fases → mitigado con `phase` (`(sport, season, phase)` como filtro).
3. Bloqueo prematuro de resultados manuales → regla de contingencia (provider offline = manual permitido con aviso ⚠).
4. PRIVACY-001 aplica aquí: nunca agregar picks de la semana abierta (el dashboard usa `lastLockedWeek`).
5. `useTrainingSession` loguea `console.error` en ligas sin evento TC (pre-existente, benigno).
