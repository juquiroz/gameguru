// ─── Tabla de rutas + resolución de contexto (PLAN-LEAGUE-CONTEXT, Fase 1) ──
// Helpers de ruta (los componentes nunca concatenan strings de hash) y
// `resolveForView`: resuelve rutas legacy / #/league sin id usando el contexto
// disponible. Principio: la URL manda; `activeLeagueId` es solo sugerencia.

import { buildHash } from './hashRouter'

// Página legacy → view canónico de la ruta de liga.
export const LEGACY_VIEW_MAP = {
  picks: 'picks',
  board: 'standings',
  publicpicks: 'publicpicks',
  league: 'league',
  training: 'training',
}

// Páginas legacy con auto-redirect a ruta de liga en Fase 3. `training` se
// EXCLUYE hasta Fase 6 (BUILD-LEAGUE-CONTEXT-02): el lobby del Training Camp
// usa `currentLeague` + `lobbyVersion` + modal con `initialName=currentLeague?.name`
// y no debe remontarse vía LeagueRoute hasta su migración a contexto de ruta.
export const LEGACY_REDIRECTABLE = {
  picks: 'picks',
  board: 'standings',
  publicpicks: 'publicpicks',
  league: 'league',
}

export const leagueRoute = (leagueId) => ({ type: 'league', leagueId, page: 'league' })
export const leaguePicksRoute = (leagueId) => ({ type: 'league', leagueId, page: 'picks' })
export const leagueStandingsRoute = (leagueId) => ({ type: 'league', leagueId, page: 'standings' })
export const leagueTrainingRoute = (leagueId) => ({ type: 'league', leagueId, page: 'training' })
export const platformRoute = () => ({ type: 'platform' })
// BUILD-SUP-002 — Platform League Management (read-only).
export const platformLeaguesRoute = () => ({ type: 'platformLeagues' })
export const platformLeagueRoute = (leagueId) => ({ type: 'platformLeague', leagueId })
// BUILD-SUP-003 — Platform User Management (read-only).
export const platformUsersRoute = () => ({ type: 'platformUsers' })
export const platformUserRoute = (userId) => ({ type: 'platformUser', userId })

// ¿el usuario es miembro de la liga? `myLeagues` viene de league_members
// (fuente de datos en Supabase, RLS SELECT por membresía).
export function isMemberOf(myLeagues, leagueId) {
  return !!(myLeagues || []).find(l => l && l.id === leagueId)
}

// Resuelve una ruta al contexto disponible:
//   - ruta de liga con id      → tal cual (la URL manda; LeagueRoute valida)
//   - ruta de liga sin id (#/league) → activeLeagueId si es miembro; 1 liga → auto; si no → hub
//   - ruta legacy (#picks/…)    → activeLeagueId si es miembro; 1 liga → auto; si no → hub
//   - dashboard/superadmin      → tal cual
export function resolveForView({ route, myLeagues = [], activeLeagueId = null }) {
  if (!route) return { type: 'dashboard' }

  if (route.type === 'league') {
    if (route.leagueId) return route
    const id = activeLeagueId && isMemberOf(myLeagues, activeLeagueId)
      ? activeLeagueId
      : myLeagues.length === 1 ? myLeagues[0].id : null
    if (!id) return { type: 'dashboard' }
    return { type: 'league', leagueId: id, page: 'league' }
  }

  if (route.type === 'legacy') {
    const view = LEGACY_VIEW_MAP[route.page] || 'league'
    const id = activeLeagueId && isMemberOf(myLeagues, activeLeagueId)
      ? activeLeagueId
      : myLeagues.length === 1 ? myLeagues[0].id : null
    if (!id) return { type: 'dashboard' }
    return { type: 'league', leagueId: id, page: view }
  }

  return route
}

// Navega a una ruta (objeto) o hash (string). Escribe en la URL. Testeable
// mockeando globalThis.location en el harness.
export function navigate(target) {
  const hash = typeof target === 'string' ? target : buildHash(target)
  const loc = typeof globalThis !== 'undefined' ? globalThis.location : null
  if (!loc) return hash
  if (loc.hash !== hash) loc.hash = hash
  return hash
}
