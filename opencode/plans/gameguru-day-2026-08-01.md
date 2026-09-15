# gameguru — Resumen diario 2026-08-01 (Sáb)

Rama: master (últimos commits: 28 mayo). Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb`.
Tooling: node v20.20.2, npm 10.8.2, vite 5.4.21, sin `rg`/`gh`/Docker (usar `grep` o las herramientas Read/Glob).

## Qué se hizo hoy (BUILD-001 + BUILD-002 + BUILD-002.1)

### BUILD-001 ✅ — Base compartida
- `src/utils/dates.js`: `getWeekDeadline`, `isWeekLocked`, `isGameLocked`, `getCurrentWeek` (l.13), `localTZOffset`.
- `src/utils/standings.js`: `calcStandings` (resultado + víctimas, empates y pick fallado = -0, siembra 0.5, empate directo = tie, no-pick = -1).
- Esqueleto `src/domains/sports/` (stubs sin APIs, Fase 2) y `src/domains/dashboard/`.
- `Home.jsx` modularizado; Picks/Leaderboard/PublicPicks migrados a utils compartidos.
- `LeagueGamesManager.jsx` y `useLeague.js` usan `localTZOffset` (simulaciones con hora local).

### BUILD-002 ✅ — Dashboard completo (experiencia fantasy)
- `useDashboardData.js` como **DashboardState** (composer Supabase): perfil, semana actual, deadline/lock, picks, standings, racha, miembros, juegos de hoy/próximos.
- `useLeagueData.js` (fetch `league_games`) con `loadingGames: true` inicial.
- 8 módulos en `src/domains/dashboard/components/` con `dashboard.module.css` (Mobile First): DashboardHeader, PendingActionCard, CountdownCard, GamesCarousel, LeaguesSummary, QuickStats, MiniLeaderboard, UpcomingGamesList.
- i18n `dashboard.*` (38+ claves es/en).
- Build ✅ 127 módulos.

### BUILD-002.1 ✅ — Unificar Home y Dashboard ("Home = Dashboard")
Filosofía: el dashboard siempre existe; solo cambian las tarjetas según el estado. Un único compositor:
- **`HomeDashboard.jsx` (l.17)** — compositor de los 3 estados:
  1. **Sin ligas** → Header (badge "Temporada 2026") + HeroCard + GamesCarousel (juegos de la semana desde `master_games`) + HowItWorks + UpcomingGamesList + CTA "Comienza ahora".
  2. **Con ligas, ninguna activa** → contexto = primera liga: LeaguesSummary (arriba) + PendingAction + GamesCarousel + QuickStats + MiniLeaderboard + UpcomingGamesList.
  3. **Liga activa** → dashboard BUILD-002 completo (+ CountdownCard, badge "Actual", invite + CTAs admin).
- **`useDashboardData.js`**: `contextLeague = currentLeague || leagues[0] || null` (l.17); fetch de `master_games` solo sin contexto (l.42-48); `sourceGames = contextLeague ? leagueGames : masterGames` (l.50); flags `showWelcome: !hasLeagues` (l.196), `showPendingAction`/`showLeaderboard` (l.198-199).
- Nuevos `HeroCard.jsx` y `HowItWorks.jsx` (reutilizan claves `home.*`).
- `LeaguesSummary.jsx`: agrega `user` + `onDeleteLeague` (✕ solo admin de liga no-actual, preserva el delete que tenía LeaguesOverview).
- `DashboardHeader.jsx`: props `badge`/`sub` para el estado de bienvenida.
- `Home.jsx` → thin: solo loading + `<HomeDashboard {...props} />`.
- i18n: `dashboard.welcomeSub`, `dashboard.howItWorks`, `dashboard.startNow`.
- `gameguru.md` y `blueprint.md` actualizados con BUILD-002.1.

## Datos confirmados (no re-investigar)
- El login en `http://localhost:5173/gameguru/` es esperado (sesión no persistida). No es bug.
- `master_games.game_time` es **ISO parseable** (`DateUtc` de `nflSchedule2026.json`, ej. `2026-09-10 00:20:00Z`, mapeado en `SuperAdmin.jsx:57`). Countdown/juegos de hoy/próximos funcionan con fechas reales.
- El usuario confirmó "si todo esta ok" tras BUILD-002: sin bugs reportados.

## Pendiente para mañana
1. **Verificar los 3 escenarios** en el navegador (`http://localhost:5173/gameguru/`) y adjuntar capturas: usuario nuevo / con ligas sin activa / liga activa. (Requiere el usuario; yo no puedo sacar screenshots.)
2. Si en escenario 2 el usuario prefiere un CTA "seleccioná una liga" en vez de stats de la primera liga → ajustar `HomeDashboard`/`useDashboardData`.
3. **Decidir commit** (BUILD-001 + BUILD-002 + BUILD-002.1, todo sin commitear aún) y **modo de deploy** (CI `.github/workflows/deploy.yml` → push a master publica en `https://juquiroz.github.io/gameguru/`, base `/gameguru/`; o manual `npm run deploy`).
4. **`.env` commiteado** (URL + anon key de Supabase): decidir si limpiar/sacar de git.
5. Opcional: borrar componentes legacy cuando se valide → `NewUserHome`, `LeaguesOverview`, `LeagueDashboard` (aún exportados en `src/domains/dashboard/index.js`).

## Referencias clave
- `src/domains/dashboard/components/HomeDashboard.jsx:17` — compositor de los 3 estados.
- `src/domains/dashboard/hooks/useDashboardData.js:17,42-50,196-199` — DashboardState + flags + calendario maestro.
- `src/utils/dates.js:13` — `getCurrentWeek`.
- `src/pages/Home.jsx` — thin wrapper de HomeDashboard.
- `src/pages/LeaguePage.jsx` — conserva delete de liga activa (confirm l.116-149).
- `src/data/nflSchedule2026.json` / `src/pages/SuperAdmin.jsx:57` — mapeo `DateUtc` → `game_time`.

## Estado de git
Modificados: `gameguru.md`, `opencode/plans/blueprint.md`, `LeagueGamesManager.jsx`, `useLeague.js`, `i18n/{es,en}.js`, `pages/{Home.jsx,Home.module.css,Leaderboard.jsx,Picks.jsx,PublicPicks.jsx}`.
Nuevos: `src/domains/`, `src/utils/`. Todo SIN commitear (no commitear sin pedido explícito).
