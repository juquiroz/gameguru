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

export const isValidTrainingState = (state) => {
  if (typeof state !== 'string' || state === '') return false
  return TRAINING_STATES[state] === state || FIXTURE_GENERATION_STATES[state] === state
}

// Estados del evento Fixture Generation (BUILD-TC-004). No son estados del
// Training Camp pero SÍ son estados legítimos de sesión: getTrainingState /
// getDerivedPhase deben pasarlos tal cual (nunca coaccionarlos a `created`),
// porque el Lobby es compartido por ambos tipos de evento (event_type).
export const FIXTURE_GENERATION_STATES = {
  waiting: 'waiting',
  generating_fixtures: 'generating_fixtures',
  saving_matches: 'saving_matches',
  completed: 'completed',
}

export const COUNTDOWN_THRESHOLD_MS = 60 * 1000

// Defensivo (BUILD-TC-004.2): tolera event nulo / no objeto / estados inválidos
// sin lanzar. Un estado desconocido cae a `created` (estado inicial seguro);
// los estados del Fixture Generation (vocabulario propio, no TC) se pasan tal
// cual porque el Lobby es compartido por ambos tipos de evento.
export const getTrainingState = (event) => {
  if (!event || typeof event !== 'object') return TRAINING_STATES.created
  return isValidTrainingState(event.state) ? event.state : TRAINING_STATES.created
}

// Fase derivada para la UI. El estado es discreto (transiciones manuales); la
// fase añade matices derivados del reloj:
//   waiting_players → countdown (T-60s) → ready (start_at vencido)
// Defensivo (BUILD-TC-004.2): nunca lanza y nunca devuelve undefined aunque
// `event`, `start_at` o `now` vengan inválidos.
export function getDerivedPhase(event, now = new Date()) {
  const state = getTrainingState(event)
  if (state === TRAINING_STATES.cancelled) return 'cancelled'
  if (state === TRAINING_STATES.created) return 'created'

  let nowMs = now
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) nowMs = new Date()

  let start = null
  const raw = event && typeof event === 'object' && event.start_at ? new Date(event.start_at) : null
  if (raw && !Number.isNaN(raw.getTime())) start = raw

  const remaining = start ? start - nowMs : Infinity
  if (state === TRAINING_STATES.waiting_players || state === TRAINING_STATES.countdown) {
    if (start && remaining <= 0) return 'ready'
    if (state === TRAINING_STATES.countdown || remaining <= COUNTDOWN_THRESHOLD_MS) return 'countdown'
    return 'waiting'
  }
  return state
}
