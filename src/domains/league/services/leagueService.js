import { getLeagueMode, getLeagueSeason } from '../models/modes'
import { EVENT_TYPES } from '../../event'
import { TRAINING_STATES } from '../../training/models/states'

export function hydrateLeague(league) {
  if (!league || typeof league !== 'object') return league
  return {
    ...league,
    mode: getLeagueMode(league),
    season: getLeagueSeason(league),
  }
}

// Estados del Training Camp en los que el roster sigue ABIERTO (BUILD-TC-005.4).
// Regla de producto: las invitaciones están abiertas desde League Created →
// TC WAITING → TC COUNTDOWN y se cierran cuando el TC entra oficialmente en
// START (`training_started` o cualquier estado posterior).
const ROSTER_OPEN_STATES = new Set([
  TRAINING_STATES.created,
  TRAINING_STATES.waiting_players,
  TRAINING_STATES.countdown,
])

export const ROSTER_STATUS = {
  OPEN: 'open',
  CLOSED_STARTED: 'started',
}

// BUILD-TC-005.4 — Regla central del roster. Única fuente de verdad de cuándo
// una liga acepta nuevas invitaciones; la usan la capa de servicio (joinByCode)
// y la UI (lobby, dashboard). Sin evento (liga recién creada) → abierto.
// Con evento:
//   training_camp en created/waiting_players/countdown → abierto
//   training_camp en START o posterior → cerrado
//   cualquier otro evento (fixture_generation / game_week / …) → cerrado
//     (el ciclo ya arrancó; el roster queda congelado)
export function getRosterStatus(event) {
  if (!event || typeof event !== 'object') {
    return { status: ROSTER_STATUS.OPEN, open: true }
  }
  if (event.event_type !== EVENT_TYPES.TRAINING_CAMP) {
    return { status: ROSTER_STATUS.CLOSED_STARTED, open: false }
  }
  if (ROSTER_OPEN_STATES.has(event.state)) {
    return { status: ROSTER_STATUS.OPEN, open: true }
  }
  return { status: ROSTER_STATUS.CLOSED_STARTED, open: false }
}

export const canJoinLeague = (event) => getRosterStatus(event).open
