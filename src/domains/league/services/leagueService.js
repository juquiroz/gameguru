import { getLeagueMode, getLeagueSeason } from '../models/modes.js'

export function hydrateLeague(league) {
  if (!league || typeof league !== 'object') return league
  return {
    ...league,
    mode: getLeagueMode(league),
    season: getLeagueSeason(league),
  }
}

export const ROSTER_STATUS = {
  OPEN: 'open',
}

// BUILD-016 — Roster siempre abierto. Regla de producto: las ligas aceptan
// nuevos participantes con el código de invitación en CUALQUIER momento del
// ciclo (regular, Training Camp, Game Week…), aunque ya hayan comenzado.
// Reemplaza el cierre de BUILD-TC-005.4 (canJoinLeague ya no bloquea).
// Espejo de league_roster_open() en 016.0-roster-always-open.sql.
export function getRosterStatus() {
  return { status: ROSTER_STATUS.OPEN, open: true }
}

export const canJoinLeague = () => true
