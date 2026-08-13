# GameGuru — Blueprint Completo

Pool de pronósticos deportivos (NFL). React 18 + Vite 5 + Supabase + hash routing + CSS Modules + i18n (es/en).

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | React 18 (hooks, JSX, sin TS) |
| Build | Vite 5 |
| DB / Auth | Supabase (PostgreSQL, Auth REST) |
| Routing | Hash-based (`window.location.hash`) |
| Estilos | CSS Modules (`*.module.css`) + design tokens en `global.css` |
| i18n | Context propio (`LangProvider` + `useLanguage()`) |
| Fuentes | Bebas Neue (títulos), Barlow (cuerpo), Barlow Condensed (labels) |
| Deploy | GitHub Pages via `gh-pages` |

---

## Scripts

```bash
npm run dev       # Dev server con HMR
npm run build     # Build producción a dist/
npm run preview   # Preview del build local
npm run deploy    # Build + deploy a GitHub Pages
```

---

## Variables de entorno (`.env`)

```
VITE_SUPABASE_URL=https://yzssihtflqmgolyajhvb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Estructura del proyecto

```
src/
├── App.jsx                        # Root: ruteo, auth, modales
├── main.jsx                       # Entry point (StrictMode)
├── supabase.js                    # Cliente Supabase + helpers por tabla
├── styles/global.css              # Design tokens + clases compartidas
├── utils/
│   ├── dates.js                   # getWeekDeadline, isWeekLocked, isGameLocked, getCurrentWeek, localTZOffset
│   └── standings.js               # calcStandings
├── domains/
│   ├── dashboard/
│   │   ├── hooks/
│   │   │   ├── useLeagueData.js   # league_games + loading + refresh (usado por LeagueDashboard)
│   │   │   └── useDashboardData.js# DashboardState: composer de todos los datos Supabase del dashboard
│   │   ├── dashboard.module.css   # CSS module propio de los módulos del dashboard
│   │   ├── components/
│   │   │   ├── HomeDashboard.jsx  # ÚNICO dashboard: renderiza módulos según DashboardState (los 3 estados)
│   │   │   ├── NewUserHome.jsx    # (legacy) hero usuario nuevo — ya no lo usa Home, se reutiliza vía HeroCard/HowItWorks
│   │   │   ├── LeaguesOverview.jsx# (legacy) lista de mis ligas — ya no lo usa Home; delete pasó a LeaguesSummary
│   │   │   ├── LeagueDashboard.jsx# (legacy) dashboard de liga activa de BUILD-002, reemplazado por HomeDashboard
│   │   │   ├── HeroCard.jsx       # bienvenida: título + desc + Crear/Unirse
│   │   │   ├── HowItWorks.jsx     # 3 tarjetas: crear liga / invitar / ganar
│   │   │   ├── DashboardHeader.jsx# saludo, nº de ligas, badge de semana (override para estado bienvenida)
│   │   │   ├── PendingActionCard.jsx# CTA "Te faltan {n} picks" / completos / bloqueado
│   │   │   ├── CountdownCard.jsx  # cuenta regresiva al deadline (refresca cada 30s)
│   │   │   ├── GamesCarousel.jsx  # carrusel horizontal de partidos (hoy o semana)
│   │   │   ├── LeaguesSummary.jsx # "Mis ligas" compacto con conteo de miembros + delete (admin, no-actual)
│   │   │   ├── QuickStats.jsx     # 4 stats: posición, aciertos, pendientes, racha
│   │   │   ├── MiniLeaderboard.jsx# Top 3 con medallas + ver clasificación completa
│   │   │   ├── UpcomingGamesList.jsx# próximos partidos no finalizados
│   │   │   └── CopyReminder.jsx   # (PRIVACY-001) admin: copia recordatorio de cierre, sin identidades
│   │   └── index.js               # barrel exports
│   └── sports/
│       ├── models/index.js        # modelo canónico: normalizeScoreboard, normalizeNews
│       ├── providers/espn.js      # espnProvider (stub, sin integración real aún)
│       ├── adapters/index.js      # mapProviderGame: mapeo provider → modelo (stub)
│       ├── repositories/sportsRepository.js  # interfaz: getScoreboard/getNews/getTeamStandings
│       ├── services/sportsService.js         # fachada del dominio sports
│       └── index.js               # barrel exports
│   └── league/
│       ├── index.js               # barrel exports (PLAN-004.1)
│       ├── models/
│       │   ├── modes.js           # LEAGUE_MODES, getLeagueMode(), getLeagueSeason()
│       │   └── seasons.js         # SEASONS, providerAvailable()
│       └── services/
│           └── leagueService.js   # hydrateLeague()
├── data/
│   ├── nflData.js                 # NFL_TEAMS, TEAM_LOGOS, SPORTS, NFL_WEEKS (mock), genInviteCode(), translateAuthError()
│   └── nflSchedule2026.json       # Calendario real 2026 (desde API)
├── hooks/
│   ├── useAuth.js                 # user, session, loading, signIn, signUp, signOut
│   ├── useLeague.js               # myLeagues, currentLeague, CRUD, join, enter/leave
│   ├── usePicks.js                # picks, submitted, saving, selectPick, submitPicks
│   └── useSuperAdmin.js           # isSuperAdmin, checking
├── i18n/
│   ├── context.jsx                # LangProvider + useLanguage() → { lang, toggleLang, t('key', {vars}) }
│   ├── es.js                      # Traducciones español (notación de puntos)
│   └── en.js                      # Traducciones inglés
├── pages/
│   ├── Auth.jsx                   # Login/Register con tabs, username opcional en registro
│   ├── Auth.module.css
│   ├── Home.jsx                   # Thin: solo loading + <HomeDashboard {...props} />
│   ├── Home.module.css            # CSS module compartido por los componentes del dashboard
│   ├── Picks.jsx                  # Juego de picks por semana con tabs, bloqueo por deadline
│   ├── Picks.module.css
│   ├── Leaderboard.jsx            # Tabla de posiciones por semana o general
│   ├── LeaguePage.jsx             # Configuración de liga: código, miembros, delete, game manager
│   ├── PublicPicks.jsx            # Tabla de picks públicos de todos los miembros
│   ├── SuperAdmin.jsx             # Admin global: calendario maestro CRUD
│   ├── SuperAdmin.module.css
│   ├── Lobby.jsx                  # (legacy) lobby ligas
│   ├── Lobby.module.css
│   └── Dashboard.jsx              # (legacy) dashboard con datos mock
└── components/
    ├── Topbar.jsx                 # Barra superior con navegación desktop, logout, lang switch
    ├── Topbar.module.css
    ├── BottomNav.jsx              # Nav inferior mobile (4-5 items)
    ├── BottomNav.module.css
    ├── GameCard.jsx               # Tarjeta de partido para picks
    ├── GameCard.module.css
    ├── GameTime.jsx               # Formatea fecha ISO o string legacy
    ├── TeamLogo.jsx               # Logo ESPN CDN + fallback emoji
    ├── LeaderboardTable.jsx       # Tabla de posiciones con medallas
    ├── CreateLeagueModal.jsx      # Modal crear liga (nombre, sport)
    ├── CreateSimulationModal.jsx  # Modal crear liga de simulación (solo superadmin)
    ├── CreateSimulationModal.module.css
    ├── InviteModal.jsx            # Modal código de invitación
    ├── InviteModal.module.css
    ├── LeagueGamesManager.jsx     # Admin: importar/activar juegos, resultados, agregar manual
    ├── LeagueGamesManager.module.css
    ├── ScoreEditor.jsx            # (PLAN-003) editor universal de scores: fila expandida con columnas Visitante/Local
    ├── ScoreEditor.module.css
    └── LanguageSwitch.jsx         # Toggle ES/EN
    └── LanguageSwitch.module.css
```

---

## Routing (hash-based)

Mini-router en `src/router/` (Fases 1-3 de PLAN-LEAGUE-CONTEXT, BUILD-LEAGUE-CONTEXT-01). `useHashRoute` escucha `hashchange`; `App.jsx` (`AppInner`/`AppShell`) renderiza por ruta.

### Rutas nuevas (`src/router/hashRouter.js` + `routes.js`)

| Hash | Página | Condición |
|------|--------|-----------|
| `#/league/:leagueId` | LeaguePage (vista `league`) | Miembro (LeagueRoute, guard READY) |
| `#/league/:leagueId/picks` | Picks con la liga de la URL | Miembro |
| `#/league/:leagueId/standings` | Leaderboard con la liga de la URL | Miembro |
| `#/league/:leagueId/training` | Training Camp (reservada; migración en Fase 6) | — |
| `#dashboard` | Home (hub: todas las ligas) | Default |
| `#superadmin` | SuperAdmin | Requiere `isSuperAdmin` |

- **URL explícita manda** sobre `localStorage['gameguru.activeLeagueId']` (solo sugerencia/LAST KNOWN).
- `LeagueRoute` (`src/league/LeagueRoute.jsx`) guard: miembro→READY, no-miembro→DENIED (0 datos), inexistente→NOT_FOUND (RLS verifica vía `leaguesApi.getById` + `membersApi.getMembership`), carga→LOADING.
- `LeagueContext` (`src/league/context/LeagueContext.jsx`) expone `{ league, leagueId, membership, loading, error, isMember, setActiveLeague, ...leaguesState, route }`.

### Rutas legacy

| Hash | Página | Condición |
|------|--------|-----------|
| `#dashboard` | HomeDashboard (se adapta: bienvenida, mis ligas o dashboard de liga) | Default |
| `#picks` | Picks | Requiere `currentLeague`; **auto-redirige** a `#/league/:leagueId/picks` (vía `resolveForView`) |
| `#board` | Leaderboard | Requiere `currentLeague`; **auto-redirige** a `#/league/:leagueId/standings` |
| `#publicpicks` | PublicPicks | Requiere `currentLeague`; **auto-redirige** a `#/league/:leagueId/publicpicks` |
| `#league` | LeaguePage | Requiere `currentLeague`; **auto-redirige** a `#/league/:leagueId` |
| `#training` | Training Camp | Requiere `currentLeague`; **SIN auto-redirect** (excluido de `LEGACY_REDIRECTABLE` hasta Fase 6) |
| `#superadmin` | SuperAdmin | Requiere `isSuperAdmin` |

`LEGACY_REDIRECTABLE = { picks, board, publicpicks, league }`. `App.jsx` sincroniza `activePage` con `window.location.hash` via `useEffect` (flujo legacy, fallback cuando la ruta no es de liga).

---

## Base de datos (Supabase)

### `profiles`
| Columna | Tipo |
|---------|------|
| `id` | UUID PK (ref auth.users) |
| `username` | text |
| `is_superadmin` | boolean |

### `leagues`
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `name` | text |
| `sport` | text (NFL, MLB, NBA, Custom) |
| `code` | text (6 chars, unique) |
| `admin_id` | UUID (FK profiles) |
| `deadline_mode` | text ('weekly' fijo) |
| `simulation` | boolean |
| `league_mode` | text ('practice' \| 'preseason' \| 'regular') — BUILD-004.1, default 'regular' |
| `season` | text (default '2026') — BUILD-004.1 |
| `created_at` | timestamptz |

### `league_members`
| Columna | Tipo |
|---------|------|
| `league_id` | UUID FK |
| `user_id` | UUID FK |
| `role` | text ('admin' | 'member') |

UK: `(league_id, user_id)`

### `master_games`
| Columna | Tipo |
|---------|------|
| `id` | UUID PK |
| `sport` | text |
| `season` | text |
| `week` | int |
| `game_id` | text |
| `home_team` | text |
| `away_team` | text |
| `home_abbr` | text |
| `away_abbr` | text |
| `game_time` | text (ISO o string legacy) |
| `home_score` | int (nullable) |
| `away_score` | int (nullable) |
| `result` | text (nullable, abbr del ganador) |
| `finished` | boolean |
| `phase` | text ('preseason' \| 'regular' \| 'postseason') — BUILD-004.1, default 'regular' |

### `league_games`
Mismas columnas que `master_games` + `league_id` (FK) + `master_game_id` (FK, nullable) + `active` (boolean)

### `picks`
| Columna | Tipo |
|---------|------|
| `user_id` | UUID |
| `league_id` | UUID |
| `week` | int |
| `game_id` | text |
| `pick` | text (abbr del equipo seleccionado) |

UK: `(user_id, league_id, week, game_id)`

---

## Hooks API

### `useAuth()`
```js
const { user, session, loading, signIn, signUp, signOut } = useAuth()
```
- `signUp(email, password, username)` → crea auth + profile
- `signIn(email, password)` → login
- `signOut()` → limpia sesión

### `useLeague(user)`
```js
const {
  myLeagues,           // [{...league, role}]
  currentLeague,       // league object o null
  loadingLeagues,
  fetchMyLeagues,      // refresca lista
  createLeague,        // (name, sport) → { data, error }
  createSimulationLeague, // (name, games[]) → { data, error }
  joinByCode,          // (code) → { data, error, alreadyMember }
  enterLeague,         // (league) → setea currentLeague
  leaveCurrentLeague,  // limpia currentLeague
} = useLeague(user)
```

### `usePicks(user, league, week)`
```js
const { picks, submitted, saving, selectPick, submitPicks, loadPicks } = usePicks(user, league, week)
```
- `picks`: `{ gameId: abbr }`
- `selectPick(gameId, teamAbbr)`
- `submitPicks(totalGames)` → upsert, requiere todos los picks
- Bloqueo por tiempo: 1h antes del primer partido de la semana

### `useSuperAdmin(user)`
```js
const { isSuperAdmin, checking } = useSuperAdmin(user)
```

---

## i18n

```js
const { t, lang, toggleLang } = useLanguage()
t('home.createLeague')           // → "Crear liga"
t('home.leagueMeta', { sport, code }) // → "NFL · ABC123"
```

Claves organizadas por módulo: `auth.*`, `topbar.*`, `bottomNav.*`, `home.*`, `dashboard.*`, `picks.*`, `leaderboard.*`, `league.*`, `manager.*` (ScoreEditor), `lobby.*`, `superadmin.*`, `invite.*`, `gameCard.*`, `weekTabs.*`, `common.*`.

Resolución: busca en lang actual → fallback a ES → fallback a la key textual.

---

## Convenciones de código

- **Sin TypeScript**, sin comentarios en código
- **CSS Modules**: `import styles from './X.module.css'`, clases con camelCase
- **Clases globales** compartidas en `global.css`: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.field`, `.msg` (`.error`, `.success`, `.info`, `.warning`), `.page`, `.page-title`, `.page-sub`, `.sec-title`, `.week-tabs`, `.week-tab`, `.lb-*`, `.stats-grid`, `.stat-card`, `.alert-card`, `.empty-state`, `.modal-overlay`, `.modal-box`, `.result-banner`, `.lock-notice`, `.invite-code-box`
- **i18n**: notación de puntos, variables con `{key}`
- **Estado compartido** via hooks, no Redux/Context (excepto i18n)
- **Handlers de navegación** reciben `onNavigate` como prop
- **Props comunes**: `user`, `league`, `onNavigate`, `onChangeLeague`
- **NFL teams**: `NFL_TEAMS` (abbr → {name, division}), `TEAM_LOGOS` (abbr → emoji fallback)
- **TeamLogo**: intenta cargar de ESPN CDN, fallback a emoji de `TEAM_LOGOS`

---

## Arquitectura orientada a dominios (Feature First)

Base preparada en **BUILD-001**. El objetivo es que React no dependa directamente de proveedores deportivos y que cada dominio evolucione de forma desacoplada.

### `src/utils/` — lógica transversal compartida
- `dates.js`: `getWeekDeadline(games)`, `isWeekLocked(games)`, `isGameLocked(game, weekGames)`, `getCurrentWeek(games)`, `localTZOffset()`. Usados por `Picks`, `Leaderboard`, `PublicPicks`, `useLeague`, `LeagueGamesManager` y `useDashboardData` (antes duplicados).
- `standings.js`: `calcStandings(picks, games, profileMap)` (antes inline en `Leaderboard`).

### `src/domains/dashboard/` — Home / dashboard
- **`HomeDashboard` (BUILD-002.1)** es el **único** dashboard. Home es solo loading + `<HomeDashboard />`. Nunca cambia de pantalla: solo cambian las tarjetas según el estado.
- `useDashboardData` es el **DashboardState** centralizado: flags `showWelcome`, `showLeagueSummary`, `showPendingAction`, `showLeaderboard`, `showCountdown` + `hasLeagues`/`hasCurrentLeague`.
- **PRIVACY-001**: los standings/posiciones salen de `lastLockedWeek` (última semana bloqueada/finalizada), nunca de la semana abierta. `participation` (contador anónimo "n de total", solo admin, semana abierta) y `CopyReminder` (admin) son las herramientas de incentivo permitidas.
- Tres estados derivados del DashboardState:
  1. **Sin ligas** → Header (badge "Temporada 2026") + `HeroCard` + `GamesCarousel` (juegos de la semana del **calendario maestro** `master_games`) + `HowItWorks` + `UpcomingGamesList` + CTA "Comienza ahora".
  2. **Con ligas, ninguna activa** → Header + `LeaguesSummary` (primera posición) + `PendingActionCard` + `GamesCarousel` + `QuickStats` + `MiniLeaderboard` + `UpcomingGamesList`. Usa la **primera liga como contexto** (contextLeague).
  3. **Liga activa** → el dashboard completo de BUILD-002 (agrega `CountdownCard`, Mis ligas con badge "Actual", e invite-box + CTAs de admin al pie).
- `LeagueDashboard.jsx`, `NewUserHome.jsx` y `LeaguesOverview.jsx` quedaron como componentes legacy exportados (no los usa Home); su contenido se reutiliza vía `HeroCard`, `HowItWorks`, `LeaguesSummary`.
- `LeaguesSummary` incluye delete (solo admin, liga no-actual) para no perder la funcionalidad que tenía `LeaguesOverview`.
- `useLeagueData(league)` arranca con `loadingGames: true`; fetch de `league_games` (o `master_games` si no hay contexto de liga).

### `src/domains/sports/` — datos deportivos externos (en preparación)
Cadena **Provider → Adapter → Repository → Service** (todas las implementaciones son stubs; aún no se integran APIs externas):
1. `providers/` — proveedor concreto (ej. `espn.js`).
2. `adapters/` — mapea la respuesta del proveedor al **modelo canónico** de `models/`.
3. `repositories/` — interfaz de datos (`getScoreboard`, `getNews`, `getTeamStandings`).
4. `services/` — fachada que consume el UI (a través de hooks).

El contrato permite cambiar de proveedor (ESPN → API-Sports, etc.) **sin tocar el frontend**.

### `src/router/` + `src/league/` — contexto de liga por URL (BUILD-LEAGUE-CONTEXT-01, Fases 1-3)

Routing hash con la **URL como fuente de verdad** del contexto de liga (`#/league/:leagueId/:view`). Módulos puros (testables sin React):
- `router/hashRouter.js` — `parseHash`/`buildHash`/`normalizeHash`.
- `router/routes.js` — helpers `leagueRoute`/`leaguePicksRoute`/`leagueStandingsRoute`/`leagueTrainingRoute`, `LEGACY_REDIRECTABLE` (picks/board/publicpicks/league; **`training` excluido** hasta Fase 6), `resolveForView`, `navigate`, `isMemberOf`.
- `router/useHashRoute.js` — hook `hashchange` (StrictMode-safe).
- `league/activeLeagueStorage.js` — `localStorage['gameguru.activeLeagueId']` **solo sugerencia**.
- `league/context/leagueResolution.js` — lógica pura: `computeRouteState` (LOADING/NOT_FOUND/DENIED/READY), `getActiveLeagueId` (URL > persistencia > fallback), `buildContextValue`.
- `league/context/LeagueContext.jsx` — `LeagueProvider`/`useLeagueContext`: `{ league, leagueId, membership, loading, error, isMember, setActiveLeague, ...leaguesState, route }`. Resolución: myLeagues fast path → `leaguesApi.getById` + `membersApi.getMembership` (distinguen NOT_FOUND de DENIED vía RLS); guard de UUID; guard de cancelación.
- `league/LeagueRoute.jsx` — guard de render: `LeagueLoading`/`LeagueNotFound`/`LeagueDenied`/children en READY. Estados exportados para smoke.

`App.jsx`: `AppInner` (auth + `useLeague`) envuelve `LeagueProvider`; `AppShell` renderiza por ruta (superadmin por ruta, `#dashboard` → hub, `#/league/:id[/page]` → `LeagueRoute key={leagueId}` con las páginas legacy como children, resto por `activePage` legacy).

### Estrategia de migración (PLAN-001)
- **Fase 0** ✅ (BUILD-001): utils compartidos + esqueleto de dominios + Home modularizado.
- **Fase 1** ✅ (BUILD-002 + BUILD-002.1): nuevo dashboard 100% con datos de Supabase (sin API externa) y unificado con el Home.
- **Fase 2**: integrar provider ESPN a través de la capa `sports`.
- **Fase 3**: gateway Edge Function + cache cuando se requiera ocultar keys / escalar.
- **Fase 4**: multi-deporte (NFL/MLB/NBA) + pulido.

---

---

## Supabase API helpers (`src/supabase.js`)

| Módulo | Funciones clave |
|--------|----------------|
| `authApi` | `signUp`, `signIn`, `signOut`, `getSession`, `onAuthChange` |
| `leaguesApi` | `create`, `getByCode`, `getMyLeagues`, `getMembers`, `getById` (`.maybeSingle()`, RLS público), `delete` |
| `membersApi` | `join`, `getMembership` (`.maybeSingle()` con `role`, RLS total) |
| `picksApi` | `upsert` (onConflict), `getForWeek`, `getLeaderboard`, `getAllForLeague` |
| `profilesApi` | `get`, `upsert`, `getMany` |
| `masterGamesApi` | `insertAll`, `getAll`, `getByWeek`, `insert`, `update`, `remove`, `deleteAll`, `getMasterResults`, `setScoresByGameId` |
| `leagueGamesApi` | `insertAll`, `getForLeague`, `getForWeek`, `addGame`, `removeFromLeague`, `setActive`, `setResult`, `setFinished`, `setScores` |

---

## Flujos clave

### Login / Registro
Auth.jsx → `onAuth.signIn(email, pass)` o `signUp(email, pass, username)` → Supabase Auth → listener en useAuth actualiza `user` → App renderiza contenido.

### Crear liga real
CreateLeagueModal → `useLeague.createLeague(name, sport)` → gen código 6 chars → inserta `leagues` → inserta `league_members` (admin) → auto-importa `master_games` a `league_games` → muestra código.

### Crear liga simulación (solo superadmin)
CreateSimulationModal → `useLeague.createSimulationLeague(name, games[])` → inserta `leagues` con `simulation: true` → inserta `league_members` → inserta juegos custom en `league_games` → muestra código.

### Unirse a liga
JoinLeagueModal (inline en App.jsx) → `useLeague.joinByCode(code)` → busca liga por código → upsert `league_members` → entra a la liga.

### Picks
Picks.jsx → carga `league_games` desde Supabase (o usa `NFL_WEEKS` mock) → `usePicks()` carga picks existentes → usuario selecciona en GameCards → `submitPicks()` upsert en `picks`.
- Bloqueo: 1h antes del primer partido de la semana activa.
- Si la semana terminó: muestra resultados, botón "Ver Picks Públicos".

### Leaderboard
Leaderboard.jsx → carga `league_games` + `picks` con join a `profiles` → compara cada pick contra `result` → ranking por aciertos.
- Tabs por semana + vista "General" (acumulado todas las semanas finalizadas).
- Muestra miembros incluso sin picks.

### Admin de liga (LeaguePage + LeagueGamesManager)
LeaguePage → muestra código, enlace, permite eliminar liga. LeagueGamesManager:
- Importa juegos del calendario maestro a la liga (individual o todos).
- Agrega juegos manuales (con fecha/hora real).
- Ingresa resultados (scores) que se persisten en `league_games` y opcionalmente en `master_games`. (PLAN-003: la fila se expande en un `ScoreEditor` universal con columnas Visitante/Local y barra Guardar/Cancelar full-width.)
- Habilita/inhabilita juegos.

### SuperAdmin (calendario maestro)
SuperAdmin.jsx → carga `master_games` desde `nflSchedule2026.json` → CRUD de juegos por semana.
- Carga el JSON completo a Supabase.
- Agrega/elimina juegos individuales manualmente.
- Estadísticas: total juegos, semanas.

### Picks Públicos
PublicPicks.jsx → tabla de matrix: miembros × juegos bloqueados (de la semana activa). Accesible solo desde botones dentro de Picks o Leaderboard (no desde la navegación principal).

---

## NFL Data

### `NFL_TEAMS`
```js
{ ARI: { name: 'Arizona Cardinals', division: 'NFC West' }, ... }
// 32 equipos, 8 divisiones
```

### `SPORTS`
```js
[{ id: 'NFL', label: 'NFL', icon: '🏈' }, { id: 'MLB', ... }, { id: 'NBA', ... }, { id: 'Custom', ... }]
```

### `NFL_WEEKS` (mock estático, solo semanas 1-2)
```js
{ 1: { label, deadline, finished, games: [{ id, home, away, hA, aA, time }], results } }
```

### `genInviteCode()`
Genera código de 6 chars: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`

### `translateAuthError(msg)`
Traduce errores de Supabase Auth a español.

### `generateNFLSchedule(season)`
Genera calendario NFL programático (división, inter-conference, intra-conference). Usado por el generador de schedule, pero actualmente se carga desde `nflSchedule2026.json`.

---

## Design Tokens (`global.css`)

| Variable | Valor | Uso |
|----------|-------|-----|
| `--bg` | `#070B14` | Fondo principal |
| `--bg2` | `#0D1525` | Cards, secciones |
| `--bg3` | `#131E32` | Inputs, tags |
| `--surface` | `#1A2740` | Superficies |
| `--surface2` | `#243450` | Botones secundarios |
| `--border` | `rgba(255,255,255,.07)` | Bordes suaves |
| `--border2` | `rgba(255,255,255,.14)` | Bordes visibles |
| `--text` | `#F0F4FF` | Texto principal |
| `--text2` | `#8B9ABB` | Texto secundario |
| `--text3` | `#4A5A7A` | Texto terciario/placeholder |
| `--accent` | `#F5A623` | Dorado (CTA, hover) |
| `--accent2` | `#FF4B4B` | Rojo accent |
| `--green` | `#22C55E` | Correcto/éxito |
| `--red` | `#EF4444` | Error/wrong |
| `--r` | `12px` | Border radius base |
| `--r-sm` | `8px` | Border radius small |
| `--r-lg` | `16px` | Border radius large |
| `--r-xl` | `20px` | Border radius extra large |

---

## Archivos legacy / no utilizados

- `src/pages/Lobby.jsx` — reemplazado por CreateLeagueModal + JoinLeagueModal
- `src/pages/Dashboard.jsx` — reemplazado por LeagueDashboard en Home.jsx
- `src/domains/dashboard/components/NewUserHome.jsx` — reemplazado por `HeroCard` + `HowItWorks` dentro de `HomeDashboard`
- `src/domains/dashboard/components/LeaguesOverview.jsx` — reemplazado por `LeaguesSummary` dentro de `HomeDashboard`
- `src/domains/dashboard/components/LeagueDashboard.jsx` — reemplazado por `HomeDashboard` (BUILD-002.1)
- `src/data/nflData.js` `NFL_WEEKS` mock — solo weeks 1-2, se usa como fallback cuando no hay datos dinámicos

---

## Bugs conocidos y notas

1. **PublicPicks.jsx**: `weeksWithLocked` debe calcularse después de `weekList` (orden de declaración)
2. **LeaguePage.jsx**: `InviteModal` se abre con `setShowModal(true)` pero no hay `showModal` en estado (está correcto en el código real)
3. **NFL_WEEKS**: solo tiene semanas 1 y 2 con datos mock; para más semanas se necesita carga desde Supabase
4. **Simulación**: todas las simulaciones se crean con `week: 1` (no hay distribución por semanas reales)
5. **Deadline**: se computa como 1h antes del primer partido de la semana (usa `game_time` de cada juego)
6. **Dashboard**: el calendario maestro usa `DateUtc` ISO (`2026-09-10 00:20:00Z`), por lo que `CountdownCard`, "Juegos del día" y `UpcomingGamesList` funcionan con fechas reales. El caso legacy (`Dom 1:00 PM` de `generateNFLSchedule`) no se carga en producción. El carrusel cae a "Partidos de la Semana {week}" cuando no hay juegos hoy.
7. **Dashboard**: el conteo de la racha se calcula desde la semana actual hacia atrás; si una semana finalizada no tuvo aciertos, la racha se corta.

---

## Privacidad — PRIVACY-001 (picks privados hasta el cierre)

**Principio**: los picks individuales son información privada hasta que la semana sea bloqueada. El dashboard nunca revela quién completó sus picks antes del cierre; solo muestra métricas agregadas/anónimas. Los admins tienen herramientas para incentivar (copiar recordatorio) pero sin acceso a información que sea ventaja competitiva.

**Cómo se aplica en el código:**
- **Standings/posiciones (dashboard)**: `useDashboardData` calcula los standings solo a partir de la **última semana bloqueada** (`lastLockedWeek` = deadline vencido o finalizada). Nunca de la semana abierta → nunca hay agregación de picks pre-cierre. `position`/`correctCount` del usuario derivan de esos standings (semana cerrada).
- **PublicPicks**: solo muestra picks de juegos bloqueados (`lockedGames`); semanas abiertas muestran estado vacío.
- **Export auditoría** (`Picks.jsx`): el botón solo aparece con `weekLocked`.
- **Contador de participación (admin)**: muestra `n de total` miembros que ya enviaron (distinct `user_id` de la semana abierta vía `getLeaderboard`), **sin nombres**. Solo admin, solo mientras la semana está abierta.
- **Copiar recordatorio (admin)**: botón en el dashboard que copia un mensaje con liga/semana/hora de cierre, sin identidades ni progreso.

**Qué NO se hace**: ningún listado de miembros con estado "hizo/no hizo picks" antes del cierre; ningún porcentaje por jugador individual de la semana abierta.

---

## Captura de resultados — PLAN-003 (ScoreEditor universal)

**Problema resuelto**: los inputs de score estaban agrupados al extremo derecho de la fila, sin anclaje visual a su equipo (ambigüedad "¿cuál marcador es de cuál equipo?").

**Solución (Opción A, fila expandida)**: al tocar 🏆/📝 la fila se expande (`gameRow.editing`): meta arriba (hora + toggle), columnas VISITANTE/LOCAL con logo + abbr + input **debajo de cada equipo**, y barra **Guardar/Cancelar full-width** (Mobile First).

**`ScoreEditor`** (`src/components/ScoreEditor.jsx`) es un componente universal y deporte-agnóstico (dos equipos + dos scores + guardar/cancelar):
- Props: `away`/`home` (`{abbr}`), `initialAwayScore`/`initialHomeScore`, `saving`, `onSave(awayScore, homeScore)`, `onCancel`.
- Estado interno de inputs, autofocus en away, Enter → Guardar, Esc → Cancelar.
- Reutilizable para NFL/MLB/NBA (Fase 4 multi-deporte).
- i18n: `manager.away`, `manager.home`, `manager.save`, `manager.cancel` (única parte traducida del manager).

**`LeagueGamesManager`**: eliminado el estado `homeScore`/`awayScore`; `handleSetScores(game, awayValue, homeValue)` cambió de firma pero la persistencia (`league_games` + `master_games`), validación y mensajes quedaron idénticos. Los displays de lectura (GameCard, PublicPicks, Leaderboard, dashboard) no se tocaron.

---

## Sistema de Temporadas — PLAN-004 (BUILD-004.1 implementado, wizard pendiente)

Evoluciona `leagues.simulation` (boolean) → 3 experiencias: **🎓 Práctica**, **🏈 Pretemporada**, **🏆 Temporada Oficial**. Documento completo en `opencode/plans/PLAN-004.md`.

**Campos nuevos** (BUILD-004.1):
- `leagues.league_mode` (text, `'practice'|'preseason'|'regular'`, default `'regular'`): discrimina la experiencia.
- `leagues.season` (text, default `'2026'`): elimina el hardcode `'2026'`.
- `master_games.phase` (text, `'preseason'|'regular'|'postseason'`, default `'regular'`): desambigua fases en semanas con mismo número.
- `leagues.simulation` se mantiene para compatibilidad temporal; se deprecará en BUILD-004.7.

**Decisión de nombre** (BUILD-004.1): se evaluó `experience_mode` (concepto UX, rechazado), `season_mode` (implica por-temporada, rechazado) y `league_mode` (✅ enum de la liga, extensible a múltiples deportes/años). El campo `phase` en `master_games` complementa: una liga = un modo = una fase.

**Script de migración**: `supabase/004.1-season-system.sql` — DDL + backfill idempotente, **manual** (ejecutar en SQL Editor de Supabase). Actualiza `simulation=true→practice`, `simulation=false→regular`. No toca calendarios. **✅ EJECUTADO (2026-08-07)** vía Management API (BACKFILL TC-005.1): `leagues.league_mode`/`season` + `master_games.phase` + CHECKs + índices; la liga real `16d92451-…` quedó `practice`/`2026`.

**Compatibilidad**: `getLeagueMode(league)` devuelve `league.league_mode` (si existe) o `simulation ? 'practice' : 'regular'` (fallback). `getLeagueSeason(league)` devuelve `league.season || '2026'`. El código funciona correctamente ANTES y DESPUÉS de ejecutar el script; `fetchMyLeagues` ya hidrata cada liga con derivados `mode`/`season` (valores atajos para consumidores).

**Dominio** (`src/domains/league/`): config `LEAGUE_MODES`/`SEASONS` + helpers `getLeagueMode`/`getLeagueSeason`/`isOfficialMode`/`providerAvailable` + servicio `hydrateLeague`. Listo para uso por BUILD-004.2+.

- **Roadmap**: BUILD-004.1 ✅ → 004.2 (badges) → 004.3 (wizard) → 004.4 (gating+aviso) → 004.5 (provider) → 004.6 (resultados automáticos) → 004.7 (multi-deporte/limpieza) → 004.8 (Edge Function/noticias).

---

## 🏈 Preseason Experience — PS-001→PS-004 implementado (MVP, 2026-08-12)

Liga exclusiva de calendario oficial (fase `preseason`, semanas 1–4). Detalle completo en `opencode/plans/preseason.md`.

- **PS-001 ✅**: semanas derivadas de la fase (`Picks`/`PublicPicks`/manager data-driven; sin `TOTAL_WEEKS=18` fijo).
- **PS-002 ✅ (MVP)**: **SuperAdmin por fase** — selector regular/preseason (`phaseCfg`: prefix `w`/`psw`, `totalWeeks` 18/4), `handleLoadSchedule` escribe `game_id` `${prefix}${RoundNumber}g${idx}` + campo `phase`, deleteAll por fase, guard `activeWeek`. Calendario real en **`src/data/nflPreseason2026.json` (49 juegos)** cargado a `master_games.phase='preseason'` (vía service_role; **anon insert → 401 RLS**).
- **PS-003 ✅ (MVP)**: `LeagueGamesManager` filtra por fase (`getAll(sport, getLeagueSeason(league), phase)` vía `masterPhaseForMode`), tabs data-driven + clamp `activeWeek`; **"Agregar juego manual" oculto en ligas oficiales** (`{!isOfficial && …}`); `ScoreEditor` con prop `official` → aviso ⚠ `manager.manualResultWarning` (regla de contingencia: provider offline = captura manual permitida con aviso). `useDashboardData` fijado a fase `'regular'`.
- **PS-004 ✅**: **LeagueIdentity con chip de modo** (🏈 Pretemporada) — clases `mode-tc/ps/rs` + variantes de color en `global.css` (teal `#14B8A6`).
- **Verificación**: harness **294/294**, QA browser `qa-preseason.mjs` **15/15** (wizard → 49 `league_games` importados con `psw*`, tabs 1–4 en Picks/Manager, chip 🏈, manual-add oculto, aviso ⚠ en ScoreEditor, Standings), `npm run build` ✅. `master_games` = 272 regular + 49 preseason.
- **Freeze (2026-08-12)**: auditoría Go-Live → **GO**. Preseason MVP **FROZEN** para el inicio de la pretemporada (blockers 0, high 0). Backlog post-preseason documentado en `opencode/plans/preseason.md` (provider real, RLS UPDATE en `master_games`, hardcode season, validación carga por fase, empates).
- **Pendiente**: provider real (`espnProvider` + `syncSeason` con fase) y resultados automáticos (PS-002-orig/PS-003-orig). Log benigno pre-existente `[useTrainingSession] no se pudo cargar la sesión del evento` en ligas sin evento TC.

---

## Experiencias oficiales (referencias)

GameGuru ofrece 3 experiencias, cada una con su documento de referencia oficial en `opencode/plans/`:

| Experiencia | Modo BD | Documento |
|---|---|---|
| 🎓 Training Camp | `practice` | [`opencode/plans/training-camp.md`](opencode/plans/training-camp.md) — evento simulado automáticamente (PLAN-005) |
| 🏈 Pretemporada | `preseason` | [`opencode/plans/preseason.md`](opencode/plans/preseason.md) — liga exclusiva de calendario oficial |
| 🏆 Temporada Oficial | `regular` | [`opencode/plans/regular-season.md`](opencode/plans/regular-season.md) — la experiencia completa |

- "Liga" en la UI; "experiencia" solo dentro del wizard.
- **PRIVACY-001** (picks privados hasta el cierre) aplica a Pretemporada y Temporada; **Training Camp está exento** (objetivo educativo, transparencia en vivo).
- Roadmaps independientes: **BUILD-TC-\*** (Training Camp), **BUILD-PS-\*** (Pretemporada), **BUILD-RS-\*** (Temporada).

**Identidad visual por experiencia (decisión 2026-08-04)**: cada experiencia tiene identidad visual propia (no solo badge) — color distintivo (tokens `--mode-tc`/`--mode-ps`/`--mode-rs` en `global.css`), ícono propio, banner específico en el header de liga/dashboard y mensajes adaptados (i18n `modes.*`). 🎓 Training Camp azul `#3B82F6` · 🏈 Pretemporada teal `#14B8A6` · 🏆 Temporada Oficial dorado `#F5A623`. Se materializa en BUILD-004.2 y BUILD-TC-001. Paleta final pendiente de validar.

## Contexto de liga por URL — PLAN-LEAGUE-CONTEXT (Fases 1-3 implementadas, BUILD-LEAGUE-CONTEXT-01 2026-08-09)

La **URL hash `#/league/:leagueId/:view` es la fuente de verdad** del contexto de liga (multi-liga por usuario). `localStorage['gameguru.activeLeagueId']` es solo sugerencia. Detalle en `opencode/plans/plan-league-context.md` (Fases 4-8 pendientes).

- **Mini-router**: `src/router/hashRouter.js` (`parseHash`/`buildHash`), `routes.js` (helpers de ruta + `resolveForView` + `navigate` + `LEGACY_REDIRECTABLE`), `useHashRoute.js` (hook `hashchange`). Legacy `#picks/#board/#publicpicks/#league` auto-redirigen; **`#training` NO** (excluido hasta Fase 6 — el lobby del TC no debe remontarse vía LeagueRoute).
- **LeagueContext**: `src/league/context/LeagueContext.jsx` — `{ league, leagueId, membership, loading, error, isMember, setActiveLeague, ...leaguesState, route }`. Resolución: myLeagues fast path → `getById` + `getMembership` para distinguir **NOT_FOUND** (liga inexistente) de **DENIED** (no miembro, 0 datos) vía RLS (`leagues` SELECT público + `league_members` SELECT total). Guard de UUID y de cancelación StrictMode. Lógica pura en `leagueResolution.js`/`activeLeagueStorage.js` (testable).
- **LeagueRoute**: guard 4 estados (`LeagueLoading`/`LeagueNotFound`/`LeagueDenied`/children READY); las páginas legacy se renderizan como children con `league` de la URL (contrato de props intacto, sin migrarlas).
- **App.jsx**: `AppInner` (auth + `useLeague`) → `LeagueProvider` → `AppShell` (render por ruta; `#dashboard` → hub; `#/league/:id[/page]` → `LeagueRoute key={leagueId}`; resto `activePage` legacy).
- **Verificación**: harness **278/278** (36 tests LC-A..J), QA E2E `qa-tc0063.mjs` **45/45** (TC/Game Week/Picks/Simulation intactos), smoke `qa-league-smoke.mjs` **18/18** (READY/refresh/NOT_FOUND/DENIED/redirect/hub, 0 errores consola-red), `npm run build` ✅.

## Training Camp Experience — PLAN-005 (diseño aprobado · BUILD-TC-001/002/003/004/004.2/005 implementados)

Reemplaza conceptualmente al "Practice Mode". Detalle completo en `opencode/plans/training-camp.md`.

- **Training Camp es un EVENTO, no una liga**: liga `practice` + sesión de entrenamiento (`training_sessions`, entidad independiente 1:N-ready con `session_no`; temporalmente una única sesión por liga) con `start_at`, `game_count` (5/10/15/20), `speed` (demo/normal/fast), `fixture_mode` (auto/manual), `state` (9 estados), `seed` (RNG determinista).
- **9 estados**: `created → waiting_players → countdown → training_started → picks_open → picks_locked → games_in_progress → simulation_running → finished` (+ `cancelled`). Cada estado es una experiencia distinta para Dashboard, notificaciones y Activity Feed.
- **Event Director (BUILD-TC-003)**: dominio `src/domains/event/` con el contrato base `EventDirector` (steps + `currentStep`/`lastCompletedStep` + `dispatch`) y `TrainingCampDirector`. El Director **coordina, no genera** (no crea partidos ni resultados): avanza por hora (`waiting→countdown→training_started`), resuelve acciones admin (abrir lobby / comenzar / cancelar) y deja la generación a los motores (Fixture Generator TC-004 / Simulation Engine TC-005). La UI solo conoce el contrato, no el motor.
- **Fixture Generation (BUILD-TC-004)**: evento `fixture_generation` con `FixtureGenerationDirector` (4 pasos: waiting→generating_fixtures→saving_matches→completed) + `FixtureGeneratorService`/`fixtureCalendar` (sin React; RNG seed, rondas round-robin sobre los 32 equipos NFL). `EVENT_TYPES` identifica el director por `event.event_type`; `EVENT_ACTIONS` se extiende con `START_GENERATION`/`GENERATION_PROGRESS`/`SAVE_COMPLETE`/`COMPLETE_EVENT`. Al **finalizar la sesión TC** el hook crea el evento y orquesta la generación (progreso en `fixture_progress`); el Lobby muestra la barra de progreso (componente `TrainingCampProgress`) y persiste el calendario en `league_games` (`master_game_id: null`, `tc-<sessionNo>-<n>`).
- **Game Week & Picks (BUILD-TC-005, implementado 2026-08-05; persistencia en modo nube validada 2026-08-07, BUILD-TC-005.1; QA end-to-end 2026-08-08, BUILD-TC-005.3)**: tercer evento `game_week` (TC → FG → Game Week; 1 evento = 1 director). Entidades `game_weeks` (WeekState: `pending→picks_open→picks_locked→games_in_progress→simulation_running→completed`) + `pick_submissions` (confirmación/bloqueo por usuario) + `training_session_id` en `league_games` y `picks` (SQL `005.2-game-week.sql` **aplicado**; Fix A: `picks_session_game_unique` de índice parcial → `UNIQUE CONSTRAINT` para `on_conflict` de PostgREST). Flujo: FG completed → jornada activa → selección de picks → pendientes (x/y) → confirmación → `picks_locked` (deadline `start_at + N` por nivel, todos confirmaron o lock admin). Dominio `src/domains/game-week/`: `GameWeekDirector` + `GameWeekService` + `PicksService` (sin React; `getConfirmedPicks` = punto de integración de TC-006) + `GameWeekContext`/`useGameWeek` + `GameWeekView` (reutiliza `GameCard`). Ventana de picks por nivel (`resolveConfig`: express 5'/standard 10'/advanced 15'/custom editable) propagada por el ciclo; `FixtureGeneratorService` setea `training_session_id`. Fix B: `GameWeekContext` carga la sesión FG (`trainingSessionsApi.list` con `event_type`) para enlazar los partidos generados en modo nube. E2E real 25/25 + regresión 56/56 + build + smoke (detalle en `opencode/plans/gameguru-day-2026-08-07.md`). **BUILD-TC-005.3**: acción admin `ADVANCE_EVENT` (idempotente; completa el TC y dispara FG → GW → Picks), panel admin en el lobby, UX activa del estado START, saneamiento de parches `toCloudPatch` (excluye campos internos/QA sin columna: `__week`/`finished_reason`/`locked_at`/`lock_reason` → 0 PATCH 400) y favicon. QA browser real 43/43 con 0 errores consola/red (detalle en `opencode/plans/gameguru-day-2026-08-08.md`).
- **Simulation Engine v1 — núcleo** (TC-006.1, implementado 2026-08-08, sin UX): lógica aislada de React en `src/domains/simulation/` (`SimulationDirector` máquina interna + `MatchSimulator` determinista + `StandingsCalculator` puro + `SimulationService` fachada). La máquina pública del evento es `GameWeekDirector` (`picks_locked → games_in_progress → simulation_running → completed`); Edge Functions futuras solo reemplazan el motor. Migración `006.1` **APLICADA en la nube (TC-006.3, vía Management API)** (corrida persistida en la nube). **BUILD-TC-006.2 (2026-08-08)**: orquestación automática en `useTrainingSession` — auto-start en `picks_locked`, batches deterministas por `speed`, resume tras reload (`simulation_progress`, no re-escribe `finished`), guard `simGuardRef` anti-duplicados (StrictMode), finalización `completed` (jornada) + `finished` (sesión); refactor compartido `GameWeekService.listSessionGames`/`sessionGameMatch` + `GameWeekContext.isCompleted` alias `finished` + fix `GameWeekDirector.getCurrentStep`; regresión **187/187** + build ✅. **BUILD-TC-006.3 (2026-08-08): UX en vivo + cierre en la nube** — `GameWeekView` con `SimulationProgress` (simulación en vivo: status + barra + %) y, en `completed`/`finished`, `GameWeekResults` (scores FINAL + "Your picks: correct/total" + draw) + `GameWeekLeaderboard` (rank/player/correct/total/pts) + banner; dominio puro `src/domains/game-week/simulationView.js` (`getSimulationRun`/`buildResultsView`/`sortStandings`/`buildLeaderboard`/`canRevealPicks`/`buildPickFeedback`); `GameWeekContext` expone `isSimulating`/`simRun`/`resultsMap`/`standings`/`allPicks`; picks públicos en vivo con exención PRIVACY-001 para `practice` (policy vía `modes.js`). **Cierre en la nube**: `006.1` aplicada vía Management API (PATCH `game_weeks` → 200, antes 400) + nueva `supabase/006.1b-league-games-update.sql` (política `lg_update`: UPDATE de `league_games` por membresía, no solo admin). Fixes de bugs reales: `SimulationDirector` null-safe (`defaultRun(null)`) y `useTrainingSession.participants` expone `id`. QA browser real **45/45** (0 errores consola/red) + regresión **231/231** + build ✅.
- **Contrato común `ResultSource`**: Training Engine (genera fixture/resultados, escribe `league_games` con `master_game_id: null`) y Official Provider Engine (lee `master_games`, escribe ambas) → la lectura no distingue el origen.
- **Exención de PRIVACY-001** solo en TC: leaderboard y picks públicos en vivo (transparencia educativa).
- **Naming**: "Practice" se abandona en el lenguaje de producto; la BD conserva `'practice'` (sin migración; renombrar el enum a `training_camp` queda como migración formal futura). Internamente **"Training Session"**, visible al usuario **"Training Camp"**.
- **Roadmap**: BUILD-TC-001 ✅ (renaming + tabla SQL + lobby) → TC-002 ✅ (Experience Picker + intro educativa + **entrada oficial por el wizard**: `Crear Liga → Picker → Intro TC → Configuración → Confirmación → Lobby`) → TC-003 ✅ (**Event Director** + sesión 1:N-ready + confirmación en el wizard + personalidad del Lobby) → TC-004 ✅ (**Fixture Generation** al finalizar la sesión TC: director + service sin React + progreso en el Lobby) → TC-004.2 ✅ (**Estabilización**: `005.1-training-sessions.sql` ejecutado en Supabase, `GET training_sessions` 200 con anon key, hardening defensivo del Lobby/hook/modelos con estado vacío y logs descriptivos) → TC-005 ✅ (**Game Week & Picks**: evento `game_week` + `game_weeks`/`pick_submissions` + jornada/picks/confirmación/bloqueo hasta `picks_locked`) → TC-005.1 ✅ (**Persistencia en modo nube**: `005.2` aplicado/verificado + backfill `004.1` ejecutado + Fix A/B + E2E real 25/25 + regresión 56/56) → **TC-005.2 (✅ hito TC-005 commiteado `7cb799a`, rama `development`, sin push)** → TC-005.3 ✅ (**QA end-to-end desbloqueado**: `ADVANCE_EVENT` admin + panel admin + UX activa del START + `toCloudPatch` + favicon; QA browser real 43/43, 0 errores consola/red) → TC-005.4 ✅ (QA final 48/48 + fix `league_mode: 'practice'`) → TC-006.1 ✅ (**Simulation Engine núcleo sin UX**: dominio `src/domains/simulation/` — SimulationDirector/MatchSimulator determinista/StandingsCalculator/SimulationService; `GameWeekDirector` ampliado `games_in_progress`/`simulation_running`; migración `006.1`; regresión 140/140) → TC-006.2 ✅ (**orquestación automática**: `useTrainingSession` auto-start en `picks_locked`, batches por `speed`, resume, `completed`/`finished`; regresión 187/187) → **TC-006.3 ✅ (UX en vivo + cierre en la nube: SimulationProgress/Results/Leaderboard/picks públicos con exención PRIVACY-001 practice; migraciones `006.1` + `006.1b` aplicadas vía Management API; fixes `defaultRun(null)` y `participants.id`; QA browser 45/45 + regresión 231/231)** → TC-007/TC-008 (Graduación 🏆) → TC-009 futuro (Edge/realtime + fixtures manuales).
- **Entrada oficial**: el Training Camp no es una opción aislada; se llega por el flujo de creación (wizard con Experience Picker). El CTA "🎓 Training Camp" del Topbar abre el wizard en la intro del TC (o navega al Lobby si la liga actual ya es practice). Embudo de adopción: **Training Camp → Pretemporada → Temporada Oficial**.

## 🕐 Timezone por liga — TZ-001→TZ-005 implementado (2026-08-12)

Cada liga tiene su **zona horaria propia** (`leagues.timezone`); todos los horarios (GameTime, GameCard, GamesCarousel, UpcomingGamesList, CountdownCard, CopyReminder, GameWeekView/Results, Picks/Manager) se renderizan en la zona de la liga, no en la del browser.

- **TZ-001 ✅**: migración `supabase/006.3-league-timezone.sql` **aplicada vía Management API** — `leagues.timezone TEXT NOT NULL DEFAULT 'America/Panama'`; verificada en nube (26 ligas existentes → `America/Panama`).
- **TZ-002 ✅**: dominio puro `src/domains/league/models/timezone.js` (`DEFAULT_TIMEZONE='America/Panama'`, `isValidTimezone`, `detectBrowserTimezone`, `getLeagueTimezone(league)`) exportado en `src/domains/league/index.js`.
- **TZ-003 ✅**: prop `timeZone` en `GameTime` (default undefined = tz del browser) y propagada por `GameCard`/`GamesCarousel`/`UpcomingGamesList`/`CountdownCard`/`CopyReminder`/`Picks`/`GameWeekView`/`GameWeekResults`/`LeagueGamesManager` vía `GameWeekContext.timezone`; `HomeDashboard`/`LeagueDashboard` pasan `getLeagueTimezone(currentLeague || contextLeague)`; SuperAdmin fija `UTC`.
- **TZ-004 ✅**: `ExperienceWizard` detecta `detectBrowserTimezone()` y lo envía en `opts.timezone`; `createLeague` persiste `timezone: opts.timezone || detectBrowserTimezone()`. Bonus: manual-add del SuperAdmin con `datetime-local` + offset local (`localTZOffset`) y validación de campo.
- **TZ-005 ✅ (QA)**: QA browser `qa-timezone.mjs` **18/18** (signup+dashboard, creación → timezone persistido e IANA válido, Panama browser + liga Panama → 6:00 PM, NY browser + liga Panama → sigue 6:00 PM (liga gana sobre el browser), liga NY → 7:00 PM, `game_time` intacto en UTC, deadline/locking idénticos en ambos timezones). Bug TDZ real resuelto: `leagueTz` se usaba en el `UpcomingGamesList` del estado 1 (sin liga) antes de su declaración.
- **Verificación**: harness **311/311** (294 + 17 TZ-002), `qa-preseason.mjs` **15/15**, `qa-tc0063.mjs` **45/45**, `qa-league-smoke.mjs` **18/18**, `qa-multileague-picks.mjs` **25/25**, `npm run build` ✅.
