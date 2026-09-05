# gameguru — Resumen diario 2026-08-03 (Lun)

Rama: master. Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb`. Tooling: node v20.20.2, vite 5.4.21 (sin `rg`/`gh`/Docker; usar Grep/Read/Glob).
Contexto previo: ver `opencode/plans/gameguru-day-2026-08-01.md` (BUILD-001/002/002.1, build 127 módulos, nada commiteado).

## Qué se hizo hoy (PRIVACY-001)

Nuevo principio de producto: **los picks individuales son privados hasta que la semana se bloquea**. Dashboard solo muestra métricas agregadas/anónimas; los admins incentivan con recordatorios, no con vigilancia.

### Auditoría (resultado: la app ya era mayormente conforme)
- PublicPicks solo muestra `lockedGames`; Leaderboard solo con juegos finalizados; export auditoría gated con `weekLocked`; LeagueGamesManager/LeaguePage/InviteModal sin info de picks. No hubo que tocar nada de eso.

### Cambios implementados
- **`useDashboardData.js`**: standings/posiciones ahora salen de `lastLockedWeek` (semana más reciente con deadline vencido o finalizada) — antes usaba la semana abierta (que nunca tenía resultados, dejando el MiniLeaderboard vacío). Nuevo `participation` = contador anónimo `{ submitted, total }` (distinct `user_id` de la semana abierta ÷ miembros), solo admin y solo con semana abierta. `getForWeek` (picks propios) sin cambios.
- **`CopyReminder.jsx`** (nuevo): botón admin "📣 Copiar recordatorio" que copia mensaje localizado con liga/semana/hora de cierre. Sin identidades.
- **`LeagueDashboard.jsx`**: `.participationBar` (admin) + `CopyReminder` en accesos rápidos (solo `!locked`); MiniLeaderboard recibe `week={lastLockedWeek}`.
- **`MiniLeaderboard.jsx`**: prop opcional `week` → título "Top — Semana {week}".
- **`dashboard.module.css`**: `.participationBar`.
- **i18n es/en**: `dashboard.copyReminder`, `reminderCopied`, `reminderText`, `adminParticipation`, `top3Week`.
- Docs: `gameguru.md` (sección "Privacidad — PRIVACY-001" + árbol), `blueprint.md` (sección PRIVACY-001 + decisiones).

### Decisiones del usuario
1. Recordatorio: solo admin, en el dashboard.
2. MiniLeaderboard: muestra la **última semana bloqueada**.
3. Contador anónimo de participación para admin: **sí**.

## Qué se hizo hoy (PLAN-003 + fix navegación + PLAN-004 + BUILD-004.1)

### Fix navegación (bugs previos)
- `Topbar.jsx` desktopNav y `BottomNav.jsx` **siempre visibles** al estar logueado (antes dependían de `currentLeague`); páginas picks/board/league sin liga activa muestran estado vacío (`topbar.needLeague` es/en). Build ✅.

### PLAN-003 — Rediseño captura de resultados (diseño + implementación)
Problema: los inputs de score estaban agrupados a la derecha de la fila, sin anclaje a su equipo. Solución elegida (Opción A, fila expandida):
- **`ScoreEditor.jsx`** (nuevo, universal para NFL/MLB/NBA): columnas Visitante/Local con logo + abbr + input debajo de cada equipo; barra Guardar/Cancelar full-width; Enter/Esc; autofocus.
- **`LeagueGamesManager.jsx`**: eliminados `homeScore`/`awayScore`/`handleOpenResult`; `handleSetScores(game, awayValue, homeValue)` con persistencia idéntica; render condicional `editing` (`editMeta` + `ScoreEditor`).
- **CSS**: `.gameRow.editing` + `.editMeta` nuevos; `.scoreForm/.scoreInput/.saveScoreBtn/.cancelScoreBtn` eliminados.
- **i18n es/en**: sección `manager.*` (away/home/save/cancel) — única parte traducida del manager.
- Build ✅ 130 módulos. Propuesta completa en `opencode/plans/PLAN-003.md`.

### PLAN-004 — Sistema de Temporadas (Practice / Preseason / Regular) — SOLO DISEÑO
Arquitectura aprobada, sin implementar (no se tocó código ni BD). Documento completo en `opencode/plans/PLAN-004.md`.
- **Modelo target**: `leagues.league_mode` ('practice'|'preseason'|'regular') + `leagues.season` ('2026') + `master_games.phase` ('preseason'|'regular'|'postseason'). Clave `(sport, season, phase)`.
- **Decisiones del usuario**: captura manual = contingencia (provider offline) con aviso ⚠, sin doble fuente de verdad; "Liga" en UI / "experiencia" en wizard; Práctica con switch Equipos NFL/Personalizado; backfill SQL manual.
- **Wizard**: modal único 3 pasos con cards (`ExperiencePicker`), reemplaza `CreateLeagueModal` + `CreateSimulationModal`.
- **Provider**: concretar cadena Provider→Adapter→Repository→Service (`espnProvider` real + `sportsService.syncSeason`); SuperAdmin = hub de sync.
- **Roadmap**: BUILD-004.1 → 004.8 (modelo/backfill → badges → wizard → gating → provider → resultados automáticos → multi-deporte → Edge Function).
- Docs: `gameguru.md` (sección "Sistema de Temporadas — PLAN-004"), `blueprint.md` (sección + estado actual).

## Datos/estado
- `npm run build` ✅ 130 módulos (warning chunk >500 kB pre-existente).
- Dev server local del usuario: `http://localhost:5173/gameguru/`.

## Pendiente
1. **Ejecutar** `supabase/004.1-season-system.sql` en SQL Editor de Supabase (una sola vez, manual).
2. Verificar visualmente PRIVACY-001 (sim con admin: contador "n de total" + recordatorio; MiniLeaderboard con semana cerrada; que no aparezca nada individual pre-cierre).
3. Verificar los 3 escenarios de BUILD-002.1 (usuario nuevo / con ligas sin activa / liga activa) y capturas.
4. Verificar PLAN-003: guardar resultado nuevo, editar existente (pre-fill), cancelar sin guardar, toggle, en móvil (barra full-width).
5. Verificar BUILD-004.1 tras backfill: las ligas existentes tienen `mode` y `season` correctamente; nuevas ligas crean con `league_mode` y `season` por defecto.
6. Decidir commit (BUILD-001/002/002.1 + PRIVACY-001 + nav + PLAN-003 + BUILD-004.1, todo sin commitear), deploy (CI vs manual) y limpieza del `.env`.
7. (Cuando se autorice) arrancar BUILD-004.2 (badges de modo).

## Referencias
- `src/domains/dashboard/hooks/useDashboardData.js` — `lastLockedWeek` (~l.65), `participation` (~l.120).
- `src/domains/dashboard/components/{CopyReminder,LeagueDashboard,MiniLeaderboard}.jsx`.
- `src/components/ScoreEditor.jsx` + `ScoreEditor.module.css` — editor universal de scores (PLAN-003).
- `src/components/LeagueGamesManager.jsx` — `handleSetScores(game, away, home)` (~l.96), render `editing` (~l.300+).
- `src/i18n/{es,en}.js` — claves `dashboard.*` y `manager.*` nuevas.
- `opencode/plans/PLAN-004.md` — arquitectura del sistema de Temporadas (diseño).

### BUILD-004.1 — Persistencia del Sistema de Temporadas (IMPLEMENTADO)
Modelo de datos + dominio implementados sin cambios visuales.
- **SQL**: `supabase/004.1-season-system.sql` — DDL idempotente (`league_mode`, `season`, `phase` con CHECK constraints) + backfill (`simulation=true→practice`, `false→regular`). Manual: ejecutar en SQL Editor de Supabase.
- **Decisión documentada**: `league_mode` (vs `experience_mode` / `season_mode`) — enum estable, extensible a multi-deporte/año.
- **Dominio** (`src/domains/league/`): `LEAGUE_MODES`/`SEASONS` config + helpers `getLeagueMode`/`getLeagueSeason`/`providerAvailable` + servicio `hydrateLeague`.
- **Combinidad**: `getLeagueMode()` fallback a `simulation`; funciona ANTES y DESPUÉS de ejecutar el script. `fetchMyLeagues` hidrata ligas con derived `mode`/`season` (aditivo, sin regression).
- Build ✅ 132 módulos. Docs: `gameguru.md` (schema + sección), `blueprint.md` (BUILD-004.1 + estado).

## Estado de git
Modificados hoy: `useDashboardData.js`, `LeagueDashboard.jsx`, `MiniLeaderboard.jsx`, `dashboard.module.css`, `Topbar.jsx`, `App.jsx`, `LeagueGamesManager.jsx`, `LeagueGamesManager.module.css`, `i18n/{es,en}.js`, `useLeague.js`, `gameguru.md`, `blueprint.md`, este archivo. Nuevos: `CopyReminder.jsx`, `ScoreEditor.jsx`, `ScoreEditor.module.css`, `PLAN-003.md`, `PLAN-004.md`, `src/domains/league/*` (4 archivos), `supabase/004.1-season-system.sql`. Todo sin commitear. SQL manual (no ejecutado).
