# gameguru — Resumen diario 2026-08-12 (Mié)

Rama: development. Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb` (anon key en `.env`; service_role en `/tmp/opencode/sb_service_role` obtenido vía Management API — token en `/tmp/opencode/sb_token`). Tooling: node v20.20.2, vite 5.4.21, puppeteer-core@23 (Chrome v151), esbuild 0.21.5 (harness). Contexto previo: `gameguru-day-2026-08-09.md` (PLAN-LEAGUE-CONTEXT-01.1, harness 285/285, QA multi-liga 25/25). **Sesión 9 (este día): Preseason Experience PS-001→PS-004 implementado (alcance MVP)** — SuperAdmin por fase, calendario real de pretemporada cargado a BD, gating de captura manual con aviso ⚠, identidad 🏈. Harness **294/294**, QA browser **15/15**, `npm run build` ✅. **Sesión 9b: auditoría Go-Live → GO y congelamiento (Preseason MVP GO/FROZEN, 0 blockers)**. **Sesión 9c: Timezone por liga TZ-001→TZ-005 implementado y verificado (harness 311/311, QA timezone 18/18, 0 errores consola/red).** **Sesión 9d: Manual Frontend QA Preseason → BUILD-UX reubicación de acciones de semana en My Picks (QA weekactions 26/26 + regresión completa verde).** **Sin commit/push.**

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

## Sesión 9c — 🕐 Timezone por liga (TZ-001→TZ-005)

**Estado**: implementado y verificado. Sección de referencia en `gameguru.md` (## 🕐 Timezone por liga). **Sin commitear.**

### Contexto
Todas las ligas mostraban horarios en el TZ del browser, pero la audiencia (Panamá) y los juegos usan `America/Panama`; para el inicio de la pretemporada se decidió (usuario) **detectar el TZ del creador de la liga** con fallback `America/Panama`. Implementado AHORA antes del kickoff.

### Cambios
- **TZ-001**: migración `supabase/006.3-league-timezone.sql` **aplicada vía Management API** → `leagues.timezone TEXT NOT NULL DEFAULT 'America/Panama'`; verificado en nube (26 ligas → `America/Panama`).
- **TZ-002**: dominio puro `src/domains/league/models/timezone.js` (`DEFAULT_TIMEZONE='America/Panama'`, `isValidTimezone` con try/catch RangeError, `detectBrowserTimezone`, `getLeagueTimezone(league)`); exportado en `src/domains/league/index.js`. Tests en el harness (17 nuevos → **311/311**).
- **TZ-003**: prop `timeZone` en `GameTime` (default undefined = browser) propagada por `GameCard`/`GamesCarousel`/`UpcomingGamesList`/`CountdownCard`/`CopyReminder`/`Picks`/`PublicPicks`/`GameWeekView`/`GameWeekResults`/`LeagueGamesManager` (vía `GameWeekContext.timezone`); `HomeDashboard`/`LeagueDashboard` pasan `getLeagueTimezone(currentLeague || contextLeague)`; SuperAdmin usa `UTC`.
- **TZ-004**: `ExperienceWizard` envía `opts.timezone = detectBrowserTimezone()`; `createLeague` persiste `timezone: opts.timezone || detectBrowserTimezone()`. Bonus: manual-add SuperAdmin con `datetime-local` + offset local (`localTZOffset`) y validación de campo.
- **Bug TDZ real (bloqueador de QA)**: `ReferenceError: Cannot access 'leagueTz' before initialization` — el edit previo había puesto `timeZone={leagueTz}` en el `UpcomingGamesList` del **estado 1 (sin liga)** que renderiza ANTES de la declaración en la línea 127. Fix: revertido en estado 1 (`HomeDashboard.jsx:111`) y añadido solo al `UpcomingGamesList` del estado 2/3 (`HomeDashboard.jsx:206`).

### QA
- Harness **311/311** (294 + 17 TZ-002), `npm run build` ✅ (2.6–3.7s).
- **QA browser `qa-timezone.mjs` 18/18**: signup+dashboard → creación → `leagues.timezone` persistido e IANA válido → CIN@DET 23:00Z: browser Panama + liga Panama → 6:00 PM; browser NY + liga Panama → sigue 6:00 PM (**la liga gana sobre el browser**); liga NY → 7:00 PM; `game_time` intacto en UTC; deadline absoluto 22:00 UTC y locking idéntico en ambos TZ. 0 errores consola/red.
- **Aprendizajes del QA**: (1) los tabs muestran "SEMANA 1" uppercase (CSS) → buscar case-insensitive; (2) tras `page.reload()` el tab vuelve a la última semana → re-seleccionar "Semana 2"; (3) la semana 2 también tiene un juego a las `00:00Z` (SEA@DAL) → 7:00 PM legítimo en Panama, por eso la aserción final quedó anclada a la tarjeta CIN@DET (`cardTime`), no a texto global; (4) `league_games` SELECT con anon → 0 filas (RLS) → usar bearer del usuario o service_role.
- **Debug scripts** (en `/tmp/opencode/qae2e/`): `tz-debug*.mjs`, `qa-timezone.mjs`.

## Sesión 9d — 🎯 Manual Frontend QA Preseason → BUILD-UX (acciones de semana en My Picks)

**Estado**: implementado y verificado. **Sin commitear.**

### Contexto
Durante el Manual Frontend QA de Preseason se detectó que `📥 Exportar auditoría` y `👁️ Ver Picks Públicos` aparecían al final de la lista de partidos (con 16 juegos obligaba a scroll). Decisión UX: mover ambas **debajo de los tabs de semana y el estado/deadline, antes de la lista**.

### Cambios (solo layout)
- `src/pages/Picks.jsx`: bloque `{weekLocked && …}` reubicado antes de `styles.grid` (mismas condiciones, `onClick` y textos).
- `src/pages/Picks.module.css`: clase nueva `styles.weekActions` (`display:flex; flex-wrap:wrap; gap:.5rem; margin-bottom:1.2rem` + `button { flex: 1 1 170px; white-space:nowrap }`) → fila en desktop, wrap/columna en mobile.
- `Guardar Picks` permanece abajo (submit bar); Preseason sigue **GO/FROZEN**; TC sigue **HOLD**.

### QA
- Harness **311/311**, `npm run build` ✅.
- **QA browser nuevo `qa-weekactions.mjs` 26/26** (0 errores consola/red): semana 1 (naturalmente bloqueada, 1 juego) → acciones arriba antes de la grilla (exp.top 264 < card.top 436), 1 sola instancia c/u, sin `Guardar Picks`; semana 2 (abierta, 16 juegos) → acciones ausentes + `Guardar Picks` presente; semana 2 forzada a bloqueada (PATCH service_role `game_time` al pasado) → acciones visibles sin scroll; `Ver Picks Públicos` navega a `publicpicks`; `Exportar auditoría` descarga `auditoria-semana2-*.html` (CDP `Page.setDownloadBehavior`); mobile 375px sin overflow (`scrollW=375 clientW=375`), botones apilados sin solape y habilitados.
- Regresión: `qa-preseason.mjs` **15/15**, `qa-multileague-picks.mjs` **25/25**.
- **Aprendizaje QA**: usar `page.createCDPSession()` (no `page._client`) para download behavior; rest() con bearer para `league_games` (RLS); `textContent` conserva mayúsculas/minúsculas originales (útil para `clickExact`).

### Pendientes (mañana)
- Continuar el **Manual Frontend QA de Preseason** (sesión 9d dejó el BUILD-UX verificado y recomendado para seguir).
- Backlog post-preseason (`preseason.md`) y Training Camp HOLD (BUILD-TC-006.3).
- Git a cargo del usuario (working tree con cambios de hoy sin commitear: TZ + Week Actions + preseason + docs).
