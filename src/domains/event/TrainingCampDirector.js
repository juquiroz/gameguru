// ════════════════════════════════════════════════════════════════════
// TrainingCampDirector — director del evento Training Camp (BUILD-TC-003)
//
// Implementa el contrato EventDirector para las 9 etapas de PLAN-005.
// Usa la fase derivada del reloj (getDerivedPhase) para saber en qué paso
// está la sesión y decide las transiciones de orquestación por hora:
//   waiting_players ─T-60s→ countdown ─start_at→ training_started
// y las acciones del admin (abrir lobby / comenzar / cancelar).
//
// NO genera contenido: el fixture y los resultados llegan con el Fixture
// Generator (TC-004) y el Simulation Engine (TC-005).
// ════════════════════════════════════════════════════════════════════

import {
  TRAINING_STATES,
  getTrainingState,
  getDerivedPhase,
  COUNTDOWN_THRESHOLD_MS,
} from '../training/models/states'
import { EventDirector, EVENT_ACTIONS, EVENT_TYPES } from './EventDirector'

const STEPS = [
  { id: 'created',            icon: '🎓' },
  { id: 'waiting_players',    icon: '👥' },
  { id: 'countdown',          icon: '⏳' },
  { id: 'training_started',   icon: '🏈' },
  { id: 'picks_open',         icon: '✅' },
  { id: 'picks_locked',       icon: '🔒' },
  { id: 'games_in_progress',  icon: '📊' },
  { id: 'simulation_running', icon: '⚙️' },
  { id: 'finished',           icon: '🏆' },
]

// Fase derivada → paso canónico de la secuencia.
const PHASE_TO_STEP = {
  waiting: 'waiting_players',
  countdown: 'countdown',
  ready: 'training_started',
}

const mapPhase = (phase) => PHASE_TO_STEP[phase] || phase

export class TrainingCampDirector extends EventDirector {
  constructor() {
    super({ id: 'training_camp', type: EVENT_TYPES.TRAINING_CAMP, steps: STEPS })
  }

  getCurrentStep(event, now = new Date()) {
    const state = getTrainingState(event)
    if (state === TRAINING_STATES.cancelled) {
      return { id: 'cancelled', index: this.steps.length, state }
    }
    const id = mapPhase(getDerivedPhase(event, now))
    const index = this.getStepIndex(id)
    return { id, index: index >= 0 ? index : 0, state }
  }

  dispatch(event, action, payload = {}) {
    const now = payload.now || new Date()
    const state = getTrainingState(event)
    const start = event.start_at ? new Date(event.start_at) : null
    const remaining = start ? start - now : Infinity

    switch (action) {
      case EVENT_ACTIONS.OPEN_LOBBY:
        return { state: TRAINING_STATES.waiting_players }

      case EVENT_ACTIONS.START_NOW:
        return {
          state: TRAINING_STATES.countdown,
          start_at: new Date(now.getTime() + COUNTDOWN_THRESHOLD_MS).toISOString(),
        }

      case EVENT_ACTIONS.CANCEL:
        return {
          state: TRAINING_STATES.cancelled,
          cancel_reason: payload.reason || 'cancelled_by_admin',
        }

      case EVENT_ACTIONS.TICK:
        if (state === TRAINING_STATES.waiting_players || state === TRAINING_STATES.countdown) {
          if (remaining <= 0) {
            return {
              state: TRAINING_STATES.training_started,
              started_at: now.toISOString(),
            }
          }
          if (state === TRAINING_STATES.waiting_players && remaining <= COUNTDOWN_THRESHOLD_MS) {
            return { state: TRAINING_STATES.countdown }
          }
        }
        return null

      default:
        return null
    }
  }
}

// Singleton de uso directo desde hooks/componentes.
export const trainingCampDirector = new TrainingCampDirector()
