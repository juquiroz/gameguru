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
│   ├── Home.jsx                   # 3 modos: new user, lista ligas, dashboard de liga activa
│   ├── Home.module.css
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
    └── LanguageSwitch.jsx         # Toggle ES/EN
    └── LanguageSwitch.module.css
```

---

## Routing (hash-based)

| Hash | Página | Condición |
|------|--------|-----------|
| `#dashboard` | Dashboard de liga (si currentLeague) o Home | Default |
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

Claves organizadas por módulo: `auth.*`, `topbar.*`, `bottomNav.*`, `home.*`, `picks.*`, `leaderboard.*`, `league.*`, `lobby.*`, `superadmin.*`, `invite.*`, `gameCard.*`, `weekTabs.*`, `common.*`.

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
- Ingresa resultados (scores) que se persisten en `league_games` y opcionalmente en `master_games`.
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
- `src/data/nflData.js` `NFL_WEEKS` mock — solo weeks 1-2, se usa como fallback cuando no hay datos dinámicos

---

## Bugs conocidos y notas

1. **PublicPicks.jsx**: `weeksWithLocked` debe calcularse después de `weekList` (orden de declaración)
2. **LeaguePage.jsx**: `InviteModal` se abre con `setShowModal(true)` pero no hay `showModal` en estado (está correcto en el código real)
3. **NFL_WEEKS**: solo tiene semanas 1 y 2 con datos mock; para más semanas se necesita carga desde Supabase
4. **Simulación**: todas las simulaciones se crean con `week: 1` (no hay distribución por semanas reales)
5. **Deadline**: se computa como 1h antes del primer partido de la semana (usa `game_time` de cada juego)
