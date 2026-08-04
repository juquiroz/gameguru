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

| Hash | Página | Condición |
|------|--------|-----------|
| `#dashboard` | HomeDashboard (se adapta: bienvenida, mis ligas o dashboard de liga) | Default |
| `#picks` | Picks | Requiere `currentLeague` |
| `#board` | Leaderboard | Requiere `currentLeague` |
| `#publicpicks` | PublicPicks | Requiere `currentLeague` |
| `#league` | LeaguePage | Requiere `currentLeague` |
| `#superadmin` | SuperAdmin | Requiere `isSuperAdmin` |

`App.jsx` sincroniza `activePage` con `window.location.hash` via `useEffect`.

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
| `leaguesApi` | `create`, `getByCode`, `getMyLeagues`, `getMembers`, `delete` |
| `membersApi` | `join` |
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

**Script de migración**: `supabase/004.1-season-system.sql` — DDL + backfill idempotente, **manual** (ejecutar en SQL Editor de Supabase). Actualiza `simulation=true→practice`, `simulation=false→regular`. No toca calendarios.

**Compatibilidad**: `getLeagueMode(league)` devuelve `league.league_mode` (si existe) o `simulation ? 'practice' : 'regular'` (fallback). `getLeagueSeason(league)` devuelve `league.season || '2026'`. El código funciona correctamente ANTES y DESPUÉS de ejecutar el script; `fetchMyLeagues` ya hidrata cada liga con derivados `mode`/`season` (valores atajos para consumidores).

**Dominio** (`src/domains/league/`): config `LEAGUE_MODES`/`SEASONS` + helpers `getLeagueMode`/`getLeagueSeason`/`isOfficialMode`/`providerAvailable` + servicio `hydrateLeague`. Listo para uso por BUILD-004.2+.

- **Roadmap**: BUILD-004.1 ✅ → 004.2 (badges) → 004.3 (wizard) → 004.4 (gating+aviso) → 004.5 (provider) → 004.6 (resultados automáticos) → 004.7 (multi-deporte/limpieza) → 004.8 (Edge Function/noticias).
