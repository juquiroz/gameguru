// ════════════════════════════════════════════════════════════════════
// SimulationDirector — director de la corrida de simulación (BUILD-TC-006)
//
// Implementa el contrato EventDirector para la corrida de resultados de una
// Game Week con picks bloqueados:
//   `waiting → simulating → persisting_results → updating_standings → completed`
//   (+ `cancelled` / `failed` virtuales, terminales).
//
// Esta máquina es INTERNA del motor: opera sobre el objeto `run`
// (persistido en `game_weeks.simulation_progress`), NO sobre la sesión.
// La máquina pública del evento sigue siendo GameWeekDirector
// (picks_locked → games_in_progress → simulation_running → completed);
// SimulationService traduce una a otra.
//
// REGLA: el director coordina, NO genera. No conoce Supabase, React ni la
// NFL: traduce acciones/estado a pasos y parches puros. `dispatch` es puro
// (recibe el estado y devuelve el parche a aplicar, o null si no hay
// transición) y es IDEMPOTENTE: re-despachar una acción ya consumada
// devuelve null (o no retrocede el estado).
// ════════════════════════════════════════════════════════════════════

import { EventDirector, EVENT_ACTIONS } from '../event/EventDirector'

const STEPS = [
  { id: 'waiting',             icon: '🕐' },
  { id: 'simulating',          icon: '🎲' },
  { id: 'persisting_results',  icon: '💾' },
  { id: 'updating_standings',  icon: '📊' },
  { id: 'completed',           icon: '🏁' },
]

export const SIMULATION_STATES = {
  waiting: 'waiting',
  simulating: 'simulating',
  persisting_results: 'persisting_results',
  updating_standings: 'updating_standings',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
}

export const getSimulationState = (run = {}) => {
  const safe = run && typeof run === 'object' ? run : {}
  return SIMULATION_STATES[safe.state] || SIMULATION_STATES.waiting
}

// Run inicial por defecto (tolerante a null / undefined / objeto incompleto).
// Un `null` explícito (columna simulation_progress de la nube sin valor) debe
// normalizarse al run inicial, nunca romper la lectura de `.state`.
export const defaultRun = (run = {}) => {
  const safe = run && typeof run === 'object' ? run : {}
  return {
    state: getSimulationState(safe),
    progress: safe.progress || { completed: 0, total: 0 },
  }
}

export class SimulationDirector extends EventDirector {
  constructor() {
    super({ id: 'simulation', type: 'simulation', steps: STEPS })
  }

  getCurrentStep(run, _now = new Date()) {
    const state = getSimulationState(run)
    if (state === SIMULATION_STATES.cancelled || state === SIMULATION_STATES.failed) {
      return { id: state, index: this.steps.length, state }
    }
    const index = this.getStepIndex(state)
    return { id: state, index: index >= 0 ? index : 0, state }
  }

  dispatch(run, action, payload = {}) {
    const now = payload.now || new Date()
    const state = getSimulationState(run)
    const progress = run.progress || { completed: 0, total: 0 }
    const total = Number(payload.total) >= 0 ? Number(payload.total) : Number(progress.total) || 0

    switch (action) {
      case EVENT_ACTIONS.SIMULATION_START:
        if (state === SIMULATION_STATES.waiting) {
          return {
            state: SIMULATION_STATES.simulating,
            started_at: now.toISOString(),
            progress: { completed: 0, total },
          }
        }
        return null

      case EVENT_ACTIONS.SIMULATION_PROGRESS:
        if (state === SIMULATION_STATES.simulating) {
          const completed = Math.max(
            Number(progress.completed) || 0,
            Math.min(Number(payload.completed) ?? progress.completed, total)
          )
          const allDone = completed >= total
          return {
            state: allDone ? SIMULATION_STATES.persisting_results : SIMULATION_STATES.simulating,
            progress: { completed, total },
          }
        }
        return null

      case EVENT_ACTIONS.PERSIST_DONE:
        if (state === SIMULATION_STATES.persisting_results) {
          return {
            state: SIMULATION_STATES.updating_standings,
            results_persisted: Number(payload.results_persisted) || 0,
          }
        }
        return null

      case EVENT_ACTIONS.STANDINGS_DONE:
        if (state === SIMULATION_STATES.updating_standings) {
          return {
            state: SIMULATION_STATES.completed,
            finished_at: now.toISOString(),
          }
        }
        return null

      case EVENT_ACTIONS.FAIL:
        if (state !== SIMULATION_STATES.completed &&
            state !== SIMULATION_STATES.failed &&
            state !== SIMULATION_STATES.cancelled) {
          return { state: SIMULATION_STATES.failed, error: payload.error || 'simulation_error' }
        }
        return null

      case EVENT_ACTIONS.CANCEL:
        if (state !== SIMULATION_STATES.completed &&
            state !== SIMULATION_STATES.failed &&
            state !== SIMULATION_STATES.cancelled) {
          return { state: SIMULATION_STATES.cancelled, cancel_reason: payload.reason || 'cancelled_by_admin' }
        }
        return null

      default:
        return null
    }
  }
}

// Singleton de uso directo desde services (nunca desde componentes).
export const simulationDirector = new SimulationDirector()
