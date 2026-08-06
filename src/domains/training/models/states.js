export const TRAINING_STATES = {
  created: 'created',
  waiting_players: 'waiting_players',
  countdown: 'countdown',
  training_started: 'training_started',
  picks_open: 'picks_open',
  picks_locked: 'picks_locked',
  games_in_progress: 'games_in_progress',
  simulation_running: 'simulation_running',
  finished: 'finished',
  cancelled: 'cancelled',
}

export const TRAINING_STATES_LIST = [
  { id: TRAINING_STATES.created,            icon: '🎓' },
  { id: TRAINING_STATES.waiting_players,    icon: '👥' },
  { id: TRAINING_STATES.countdown,          icon: '⏳' },
  { id: TRAINING_STATES.training_started,   icon: '🏈' },
  { id: TRAINING_STATES.picks_open,         icon: '✅' },
  { id: TRAINING_STATES.picks_locked,       icon: '🔒' },
  { id: TRAINING_STATES.games_in_progress,  icon: '📊' },
  { id: TRAINING_STATES.simulation_running, icon: '⚙️' },
  { id: TRAINING_STATES.finished,           icon: '🏆' },
]

export const isValidTrainingState = (state) =>
  Object.prototype.hasOwnProperty.call(TRAINING_STATES, state)

export const COUNTDOWN_THRESHOLD_MS = 60 * 1000

export const getTrainingState = (event = {}) =>
  isValidTrainingState(event.state) ? event.state : TRAINING_STATES.created

// Fase derivada para la UI. El estado es discreto (transiciones manuales); la
// fase añade matices derivados del reloj:
//   waiting_players → countdown (T-60s) → ready (start_at vencido)
export function getDerivedPhase(event, now = new Date()) {
  const state = getTrainingState(event)
  if (state === TRAINING_STATES.cancelled) return 'cancelled'
  if (state === TRAINING_STATES.created) return 'created'
  const start = event.start_at ? new Date(event.start_at) : null
  const remaining = start ? start - now : Infinity
  if (state === TRAINING_STATES.waiting_players || state === TRAINING_STATES.countdown) {
    if (start && remaining <= 0) return 'ready'
    if (state === TRAINING_STATES.countdown || remaining <= COUNTDOWN_THRESHOLD_MS) return 'countdown'
    return 'waiting'
  }
  return state
}
