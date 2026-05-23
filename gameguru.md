# GameGuru

Pool de pronósticos deportivos. Crea ligas, invita amigos, predice ganadores de la NFL.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | React 18 (hooks, JSX, sin TypeScript) |
| Build | Vite 5 |
| DB / Auth | Supabase (PostgreSQL, Auth REST) |
| Routing | Hash-based (`window.location.hash`) |
| Estilos | CSS Modules + design tokens en `global.css` |
| i18n | Context propio (es/en) |
| Deploy | GitHub Pages (`gh-pages`) |

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Dev server con HMR |
| `npm run build` | Build producción a `dist/` |
| `npm run preview` | Preview del build local |
| `npm run deploy` | Build + deploy a GitHub Pages |

---

## Routing (hash-based)

| Hash | Página | Condición |
|------|--------|-----------|
| `#dashboard` | Home (LeagueDashboard si hay currentLeague) | Default |
| `#picks` | Picks | Requiere `currentLeague` |
| `#board` | Leaderboard | Requiere `currentLeague` |
| `#league` | LeaguePage | Requiere `currentLeague` |
| `#superadmin` | SuperAdmin | Requiere `isSuperAdmin` |

---

## Estructura del proyecto

```
src/
├── App.jsx                # Root: ruteo, auth, modales
├── main.jsx               # Entry point
├── supabase.js            # Cliente Supabase + helpers por tabla
├── styles/global.css      # Tokens de diseño
├── data/
│   ├── nflData.js         # Equipos, semanas, helper genInviteCode()
│   └── nflSchedule2026.json
├── hooks/
│   ├── useAuth.js         # Estado de sesión
│   ├── useLeague.js       # CRUD ligas, membresía, auto-import
│   ├── usePicks.js        # Selección y envío de picks
│   └── useSuperAdmin.js   # Flag is_superadmin
├── i18n/
│   ├── context.jsx        # LangProvider + hook useLanguage
│   ├── es.js              # Traducciones español
│   └── en.js              # Traducciones inglés
├── pages/
│   ├── Auth.jsx           # Login / Register
│   ├── Home.jsx           # Home (new user / lista ligas / dashboard liga)
│   ├── Picks.jsx          # Juego de picks por semana
│   ├── Leaderboard.jsx    # Tabla de posiciones
│   ├── LeaguePage.jsx     # Configuración de liga
│   ├── Lobby.jsx          # (legacy) lobby ligas
│   ├── Dashboard.jsx      # (legacy) dashboard con datos mock
│   └── SuperAdmin.jsx     # Admin global: calendario maestro
└── components/
    ├── Topbar.jsx         # Barra superior con navegación
    ├── BottomNav.jsx      # Nav inferior mobile
    ├── GameCard.jsx       # Tarjeta de partido para picks
    ├── GameTime.jsx       # Formateo de fecha/hora
    ├── TeamLogo.jsx       # Logo ESPN CDN + fallback emoji
    ├── CreateLeagueModal.jsx  # Modal crear liga
    ├── InviteModal.jsx    # Modal código de invitación
    ├── LeaderboardTable.jsx   # Tabla reusable de posiciones
    ├── LeagueGamesManager.jsx # Admin: importar/activar juegos
    └── LanguageSwitch.jsx     # Toggle ES/EN
```

---

## Base de datos (Supabase)

### `profiles`
`id` (UUID PK, ref auth.users), `username` (text), `is_superadmin` (boolean)

### `leagues`
`id` (UUID PK), `name` (text), `sport` (text), `code` (text 6), `admin_id` (UUID), `deadline_mode` (text: 'weekly'|'game_by_game'), `created_at` (timestamptz)

### `league_members`
`league_id` (UUID FK), `user_id` (UUID FK), `role` (text: 'admin'|'member')
UK: `(league_id, user_id)`

### `master_games`
`id` (UUID PK), `sport`, `season`, `week` (int), `game_id` (text), `home_team`, `away_team`, `home_abbr`, `away_abbr`, `game_time`

### `league_games`
`id` (UUID PK), `league_id` (UUID FK), `master_game_id` (UUID FK), `sport`, `season`, `week` (int), `game_id`, `home_team`, `away_team`, `home_abbr`, `away_abbr`, `game_time`, `active` (boolean), `result` (text), `finished` (boolean)

### `picks`
UK: `(user_id, league_id, week, game_id)`
Columnas: `user_id`, `league_id`, `week` (int), `game_id` (text), `pick` (text)

---

## Flujos clave

### Crear liga
CreateLeagueModal → `useLeague.createLeague()` → gen código → inserta `leagues` → inserta `league_members` (admin) → auto-importa `master_games` a `league_games` → muestra código de invitación.

### Crear liga de simulación (solo super admin)
CreateSimulationModal → `useLeague.createSimulationLeague()` → gen código → inserta `leagues` con `simulation: true` y `deadline_mode: 'game_by_game'` → inserta `league_members` (admin) → inserta juegos custom en `league_games` con `game_time` definido por el usuario → muestra código de invitación.
Las ligas de simulación se muestran con badge 🧪 Simulación en el dashboard y en la lista de ligas.

### Unirse a liga
JoinLeagueModal → `useLeague.joinByCode()` → busca liga por código → inserta `league_members` (member) → entra a la liga.

### Picks
Picks.jsx → `usePicks()` carga picks existentes → usuario selecciona en GameCards → `submitPicks()` hace upsert en `picks`.

### Leaderboard
Leaderboard.jsx → carga `league_games` + `picks` con join a `profiles` → compara cada pick contra `result` → ranking por aciertos.

---

## Variables de entorno (`.env`)

```
VITE_SUPABASE_URL=https://yzssihtflqmgolyajhvb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Convenciones de código

- Sin TypeScript, sin comentarios en código
- CSS Modules: `import styles from './X.module.css'`
- i18n: `const { t } = useLanguage()` → `t('clave.del.texto', { vars })`
- Las claves de traducción usan notación de puntos: `'home.createLeague'`
- Estado compartido via hooks, no Redux/Context (excepto i18n)
- Los handlers de navegación reciben `onNavigate` como prop
- Excluir del contexto: `node_modules/`, `dist/`, `build/`, `*.log`, `.env`
