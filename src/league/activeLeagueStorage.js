// ─── activeLeagueId persistido (PLAN-LEAGUE-CONTEXT, Fase 2) ────────────────
// `localStorage['gameguru.activeLeagueId']` es SOLO una sugerencia de
// navegación (LAST KNOWN). NUNCA resuelve una ruta con leagueId explícito:
// la URL es la única fuente de verdad.

const ACTIVE_LEAGUE_KEY = 'gameguru.activeLeagueId'

function hasStorage() {
  return typeof globalThis !== 'undefined' && !!globalThis.localStorage
}

export function loadActiveLeagueId() {
  try {
    return hasStorage() ? globalThis.localStorage.getItem(ACTIVE_LEAGUE_KEY) || null : null
  } catch {
    return null
  }
}

export function saveActiveLeagueId(leagueId) {
  try {
    if (hasStorage() && leagueId) globalThis.localStorage.setItem(ACTIVE_LEAGUE_KEY, leagueId)
  } catch { /* sin persistencia: solo sugerencia */ }
}

export function clearActiveLeagueId() {
  try {
    if (hasStorage()) globalThis.localStorage.removeItem(ACTIVE_LEAGUE_KEY)
  } catch { /* sin persistencia */ }
}
