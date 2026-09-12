// ════════════════════════════════════════════════════════════════════
// GameWeekDirector — director del evento Game Week (BUILD-TC-005 / TC-006)
//
// Implementa el contrato EventDirector para la jornada de juego del
// Training Camp: `waiting → picks_open → picks_locked → games_in_progress
// → simulation_running → completed` (+ `cancelled` virtual). La simulación
// (BUILD-TC-006) se dispara desde este director con las acciones
// SIMULATION_START / SIMULATION_PROGRESS del contrato común: el
// SimulationService las despacha a medida que el motor persiste resultados
// (la máquina INTERNA de la corrida vive en el SimulationDirector).
//
// REGLA: el director coordina, NO genera. No conoce Supabase ni la NFL:
// traduce acciones/estado/reloj a pasos y parches puros. El deadline de
// picks (`picks_deadline_at`) se lee del evento (persistido en la sesión)
// y/o del payload `deadline_at`, para que el director no dependa de tablas.
//
// Bloqueo (decisión PLAN-TC-005): el director solo conoce la transición
// picks_open → picks_locked (TICK por deadline o LOCK_PICKS explícito con
// `reason`: deadline | all_submitted | admin). Quién dispara el lock
// (deadline vencido, todos confirmaron, admin) es decisión del service/hook.
//
// BUILD-TC-006: ADVANCE_EVENT (QA/admin) completa la jornada desde cualquier
// estado jugable de forma idempotente (null si completed/cancelled/waiting),
// igual que en TrainingCampDirector.
// ════════════════════════════════════════════════════════════════════

import { EventDirector, EVENT_ACTIONS, EVENT_TYPES } from '../event/EventDirector'

const STEPS = [
  { id: 'waiting',             icon: '🗓️' },
  { id: 'picks_open',          icon: '✅' },
  { id: 'picks_locked',        icon: '🔒' },
  { id: 'games_in_progress',   icon: '📊' },
  { id: 'simulation_running',  icon: '⚙️' },
  { id: 'completed',           icon: '🏁' },
]

export const GAME_WEEK_STATES = {
  waiting: 'waiting',
  picks_open: 'picks_open',
  picks_locked: 'picks_locked',
  games_in_progress: 'games_in_progress',
  simulation_running: 'simulation_running',
  completed: 'completed',
  cancelled: 'cancelled',
}

const getWeekState = (event = {}) =>
  GAME_WEEK_STATES[event.state] || GAME_WEEK_STATES.waiting

export class GameWeekDirector extends EventDirector {
  constructor() {
    super({ id: 'game_week', type: EVENT_TYPES.GAME_WEEK, steps: STEPS })
  }

  getCurrentStep(event, _now = new Date()) {
    // BUILD-TC-006.2: al finalizar, la sesión del evento termina en `finished`
    // (estado terminal del ciclo TC, TRAINING_STATES) mientras la jornada queda
    // `completed` (WeekState). Para la derivación de pasos, `finished` se trata
    // como el terminal `completed` (la UI no debe retroceder al paso waiting).
    const rawState = event?.state || 'waiting'
    const state = GAME_WEEK_STATES[rawState] || GAME_WEEK_STATES.waiting
    const effective = rawState === 'finished' ? GAME_WEEK_STATES.completed : state
    if (effective === GAME_WEEK_STATES.cancelled) {
      return { id: 'cancelled', index: this.steps.length, state }
    }
    const index = this.getStepIndex(effective)
    return { id: effective, index: index >= 0 ? index : 0, state }
  }

  dispatch(event, action, payload = {}) {
    const now = payload.now || new Date()
    const state = getWeekState(event)
    const deadlineAt = payload.deadline_at || event.picks_deadline_at || null
    const deadline = deadlineAt ? new Date(deadlineAt) : null

    switch (action) {
      case EVENT_ACTIONS.OPEN_WEEK:
        if (state === GAME_WEEK_STATES.waiting) {
          return {
            state: GAME_WEEK_STATES.picks_open,
            picks_deadline_at: deadlineAt
              ? new Date(deadlineAt).toISOString()
              : new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
          }
        }
        return null

      case EVENT_ACTIONS.LOCK_PICKS:
        if (state === GAME_WEEK_STATES.picks_open || state === GAME_WEEK_STATES.waiting) {
          return {
            state: GAME_WEEK_STATES.picks_locked,
            locked_at: now.toISOString(),
            lock_reason: payload.reason || 'manual',
          }
        }
        return null

      case EVENT_ACTIONS.OPEN_NEXT_WEEK:
        if (state === GAME_WEEK_STATES.picks_locked) {
          return {
            state: GAME_WEEK_STATES.picks_open,
            picks_deadline_at: deadlineAt
              ? new Date(deadlineAt).toISOString()
              : new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
          }
        }
        return null

      case EVENT_ACTIONS.COMPLETE_EVENT:
        if (state === GAME_WEEK_STATES.picks_locked ||
            state === GAME_WEEK_STATES.games_in_progress ||
            state === GAME_WEEK_STATES.simulation_running ||
            state === GAME_WEEK_STATES.completed) {
          return {
            state: GAME_WEEK_STATES.completed,
            finished_at: now.toISOString(),
          }
        }
        return null

      case EVENT_ACTIONS.SIMULATION_START:
        if (state === GAME_WEEK_STATES.picks_locked) {
          return {
            state: GAME_WEEK_STATES.games_in_progress,
            started_at: now.toISOString(),
          }
        }
        return null

      case EVENT_ACTIONS.SIMULATION_PROGRESS:
        if (state === GAME_WEEK_STATES.games_in_progress ||
            state === GAME_WEEK_STATES.simulation_running) {
          return {
            state: GAME_WEEK_STATES.simulation_running,
            simulation_progress: payload.progress || event.simulation_progress || null,
          }
        }
        return null

      case EVENT_ACTIONS.ADVANCE_EVENT:
        if (state !== GAME_WEEK_STATES.completed &&
            state !== GAME_WEEK_STATES.cancelled &&
            state !== GAME_WEEK_STATES.waiting) {
          return {
            state: GAME_WEEK_STATES.completed,
            finished_at: now.toISOString(),
            finished_reason: 'admin',
          }
        }
        return null

      case EVENT_ACTIONS.CANCEL:
        if (state !== GAME_WEEK_STATES.completed && state !== GAME_WEEK_STATES.cancelled) {
          return {
            state: GAME_WEEK_STATES.cancelled,
            cancel_reason: payload.reason || 'cancelled_by_admin',
          }
        }
        return null

      case EVENT_ACTIONS.TICK:
        if (state === GAME_WEEK_STATES.picks_open && deadline && deadline <= now) {
          return {
            state: GAME_WEEK_STATES.picks_locked,
            locked_at: now.toISOString(),
            lock_reason: 'deadline',
          }
        }
        return null

      default:
        return null
    }
  }
}

// Singleton de uso directo desde hooks/services (nunca desde componentes).
export const gameWeekDirector = new GameWeekDirector()
