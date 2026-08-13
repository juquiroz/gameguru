# gameguru — Resumen diario 2026-08-12 (Mié)

Rama: development. Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb` (anon key en `.env`; service_role en `/tmp/opencode/sb_service_role` obtenido vía Management API — token en `/tmp/opencode/sb_token`). Tooling: node v20.20.2, vite 5.4.21, puppeteer-core@23 (Chrome v151), esbuild 0.21.5 (harness). Contexto previo: `gameguru-day-2026-08-09.md` (PLAN-LEAGUE-CONTEXT-01.1, harness 285/285, QA multi-liga 25/25). **Sesión 9 (este día): Preseason Experience PS-001→PS-004 implementado (alcance MVP)** — SuperAdmin por fase, calendario real de pretemporada cargado a BD, gating de captura manual con aviso ⚠, identidad 🏈. Harness **294/294**, QA browser **15/15**, `npm run build` ✅. **Sesión 9b: auditoría Go-Live → GO y congelamiento (Preseason MVP GO/FROZEN, 0 blockers)**. **Sin commit/push.**

## Sesión 9 — 🏈 Preseason (BUILD-PS-001→004, MVP)

**Estado**: implementado y verificado. Plan documentado en `opencode/plans/preseason.md`. **Sin commitear.**

### Contexto y alcance MVP (decisión del usuario)
Training Camp en HOLD. Preseason se construye como liga exclusiva de calendario oficial: resultados MVP = captura manual con aviso ⚠ (regla de contingencia), calendario en JSON del repo. Provider real (`espnProvider`) y resultados automáticos quedan pendientes (PS-002-orig/PS-003-orig).

### PS-001 — Semanas derivadas de la fase
- `src/pages/PublicPicks.jsx`: eliminado el gate `league?.simulation` del sync de `activeWeek` y del `weekList` → siempre data-driven desde los juegos de la fase.

### PS-002 — SuperAdmin por fase + calendario real en BD
- `src/pages/SuperAdmin.jsx` + `.module.css`: selector `PHASES` (regular 18 sem/prefix `w`; preseason 4 sem/prefix `psw`), `handleLoadSchedule` con `phaseCfg` (cada fila con `phase`, `game_id: ${prefix}${RoundNumber}g${idx}`), insert manual con `phase` y `game_id` `${prefix}-manual-*`, `deleteAll('NFL','2026',phase)`, tabs con `phaseCfg.totalWeeks`, guard `activeWeek > totalWeeks → 1`, empty states con `phaseCfg.label`.
- **`src/data/nflPreseason2026.json`** (nuevo): 49 juegos reales de pretemporada (semanas 1–4).
- **Carga a BD**: `POST master_games` con anon → **401 RLS** (`42501 … violates row-level security policy`); resuelto con **service_role** (INSERT 201, vía Management API). Verificado: `master_games` = 272 regular + **49 preseason** (`psw1g1`..`psw4g16`; sem1:1, sem2:16, sem3:16, sem4:16). Fix previo: regex de `nflData.js` no matcheaba nombres con doble espacio → `([A-Z]{2,3}):\s+\{ name:` → 32/32 equipos.

### PS-003 — Rangos por fase + gating de captura manual
- `src/components/LeagueGamesManager.jsx`: `getAll(sport, getLeagueSeason(league), phase)` vía `masterPhaseForMode`; `weekList` desde `masterWeeks` + clamp de `activeWeek`; tabs data-driven; "Agregar juego manual" envuelto en `{!isOfficial && …}`; `<ScoreEditor official={isOfficial} />`.
- `src/components/ScoreEditor.jsx` + `.module.css`: prop `official` (default false) → aviso `.warning` ámbar con `t('manager.manualResultWarning')`.
- i18n `manager.manualResultWarning` en `es.js`/`en.js`.
- `src/domains/dashboard/hooks/useDashboardData.js`: welcome dashboard fijado a fase `'regular'`.

### PS-004 — Identidad de modo
- `src/components/LeagueIdentity.jsx`: chip `t(modes.${mode})` con clases `mode-tc/mode-ps/mode-rs` (solo cuando no es práctica con `sessionNo`); variantes de color en `src/styles/global.css` usando los tokens `--mode-tc/--mode-ps/--mode-rs`.

### QA
- Regresión harness **294/294** (tras PS-003 y PS-004), `npm run build` ✅ (builds 2.7–4.7s).
- **QA browser `qa-preseason.mjs` 15/15** (en `/tmp/opencode/qae2e/`, puppeteer-core): signup → wizard crea liga preseason → verificación REST con bearer del usuario (RLS) de **49 `league_games`** importados (`psw*`; distribución {1:1,2:16,3:16,4:16}) → Picks tabs 1–4 → chip 🏈 → Manager tabs 1–4 → "Agregar juego manual" oculto → ScoreEditor abre con aviso ⚠ contingencia → Standings. 0 errores consola/red (se excluye el log pre-existente `useTrainingSession` de ligas sin evento TC).
- 2 fallos intermedios por carrera del test (fallback de 18 tabs satisfacía `length >= 4`); endurecido a comparación exacta `[1,2,3,4]` → 15/15 estable.
- **Limpieza BD**: 10 ligas `QA-PS-*` eliminadas vía service_role (league_games/picks/members + leagues, 204s).

## Sesión 9b — Preseason Freeze (verificación final + congelamiento)

**Estado**: **GO / FROZEN**. Auditoría Go-Live completada (veredicto GO, 0 blockers, 0 high) y decisión de producto: **congelar Preseason MVP** para el inicio de la pretemporada. Sin desarrollo funcional en esta sesión.

- **Verificación final**: harness **294/294 PASS / 0 FAIL**; `npm run build` ✅ (único warning: chunk >500 kB, pre-existente). QA browser 15/15 previamente validado (sin cambios de `src/` desde entonces).
- **BD confirmada** (solo lectura): `master_games` preseason 49 (weeks {1:1,2:16,3:16,4:16}) + regular 272; sin duplicados de `game_id`; ligas: practice 16 / regular 10 / preseason 0 (ninguna viva aún — la experiencia arranca mañana). `league_games` 130 filas = QA legacy TC0053/0063 de sesiones anteriores (backlog LOW).
- **Training Camp**: confirmado HOLD en BUILD-TC-006.3 — `git status` no toca archivos de TC; sin refactors.
- **Docs**: `preseason.md` (Freeze + Backlog post-Preseason) y `gameguru.md` actualizados.
- **Sin commit/push** (Git a cargo del usuario).

### Pendientes
- Post-preseason (backlog documentado en `opencode/plans/preseason.md`): provider real, sincronización/resultados automáticos, reconciliación manual vs provider, RLS UPDATE `master_games`, hardcode season `2026`, validación carga por fase con JWT, limpieza `league_games` por fase, decisión de empates.
- Training Camp continúa en HOLD en BUILD-TC-006.3.
