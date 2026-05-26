# GameGuru — Blueprint de cambios

## Eliminación del modo "Juego por juego"

### Archivos modificados

#### `src/components/CreateLeagueModal.jsx`
- Eliminado estado `deadlineMode`
- Eliminado parámetro `deadlineMode` del llamado a `onCreateLeague`
- Eliminado bloque UI "Modo de cierre" (selector semanal vs juego por juego)

#### `src/hooks/useLeague.js`
- `createLeague`: eliminado parámetro `deadlineMode`, hardcodeado `deadline_mode: 'weekly'`
- `createSimulationLeague`: cambiado `deadline_mode: 'game_by_game'` → `'weekly'`

#### `src/pages/Picks.jsx`
- Eliminada variable `deadlineMode`
- Eliminada función `gameDeadline`
- `isGameLocked` simplificado: solo verifica `g.finished || isWeekLocked`
- Eliminadas variables de conteo específicas de game_by_game (`lockedGames`, `unlockedGames`, etc.)
- `handleSubmit` simplificado, sin `partial`
- Eliminados badges y lock-notices condicionales de game_by_game

#### `src/hooks/usePicks.js`
- `submitPicks`: eliminado parámetro `partial`, siempre requiere todos los picks

#### `src/pages/PublicPicks.jsx`
- Cambiado de bloqueo por-juego a bloqueo semanal (1h antes del primer partido de la semana)
- Nuevas funciones: `getWeekDeadline()`, `isGameLocked(game, weekGames)`
- `weeksWithLocked` ahora usa `weekList.filter()` en lugar de Set

---

## Auto-selección de última semana disponible

### Archivo modificado

#### `src/pages/Picks.jsx`
- `activeWeek` inicializado con lazy initializer desde `NFL_WEEKS` (última semana disponible)
- Nuevo `useEffect` que sincroniza `activeWeek` a la última semana disponible cuando cargan datos dinámicos desde Supabase

---

## Bloqueo por tiempo real (no por envío)

### Archivo modificado

#### `src/pages/Picks.jsx`
- `isGameLocked` ya no usa `submitted`. Ahora computa `getWeekDeadline(weekGames)` que encuentra el primer partido de la semana y resta 1 hora
- Nueva variable `isWeekLocked`: `weekData?.finished || (weekDeadline ? new Date() >= weekDeadline : false)`
- Submit bar visible hasta `isWeekLocked` (no hasta `weekData.finished`)
- Botón de submit ya no se deshabilita por `submitted`, permitiendo re-guardar picks
- Nuevo lock-notice: "Hora límite alcanzada — los picks están bloqueados"

---

## Picks Públicos: solo desde dentro de páginas (no nav)

### Archivos modificados

#### `src/components/Topbar.jsx`
- Eliminado `{ id: 'publicpicks', label: 'P. Públicos' }` del nav

#### `src/components/BottomNav.jsx`
- Eliminado `{ id: 'publicpicks', label: 'P. Públicos', icon: '👁️' }` del nav

#### `src/pages/Picks.jsx`
- Agregado botón "👁️ Ver Picks Públicos de esta semana" cuando `isWeekLocked === true`
- Recibe `onNavigate` via props

#### `src/pages/Leaderboard.jsx`
- Agregadas funciones `getWeekDeadline()` e `isWeekLocked()` (misma lógica que Picks)
- Nuevo estado `lockedWeeks` calculado en `loadStandings`
- Botón "👁️ Ver Picks Públicos" visible cuando la semana activa está en `lockedWeeks`

---

## Inputs de score más grandes

### Archivo modificado

#### `src/components/LeagueGamesManager.module.css`
- `.scoreInput`: width `1.8rem` → `3.2rem`, padding aumentado, font-size `0.75rem` → `1.05rem`
- `.scoreForm`: gap `2px` → `6px`
- Nuevo `.scoreForm .vs` con font-size `1.1rem` y font-weight `700`
- `.saveScoreBtn` / `.cancelScoreBtn`: padding y font-size aumentados
- Agregados estados `:focus` (borde accent) y `:hover` (opacidad)
- Eliminado bloque `@media (min-width: 480px)` para score inputs

---

## Bugs corregidos

### `PublicPicks.jsx` — Temporal Dead Zone
- `weeksWithLocked` usaba `weekList` antes de su declaración `const`
- Fix: reordenar `weekList` y `weeksWithGames` antes de `weeksWithLocked`
