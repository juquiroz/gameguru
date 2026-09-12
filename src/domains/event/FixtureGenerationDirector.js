// ════════════════════════════════════════════════════════════════════
// FixtureGenerationDirector — director del evento Fixture Generation (BUILD-TC-004)
//
// Implementa el contrato EventDirector para el evento que genera el
// calendario del Training Camp: `waiting → generating_fixtures →
// saving_matches → completed`. El generador (FixtureGeneratorService, sin
// React) reporta el avance con GENERATION_PROGRESS y el director deriva el
// paso activo: mientras no haya generado todos los partidos está en
// `generating_fixtures`; una vez generados pasa a `saving_matches` (persistencia).
//
// REGLA: el director coordina, NO genera. No conoce la NFL ni la base de
// datos: solo traduce acciones/estado a pasos y parches.
//
// Nota de implementación: el prompt pidió `FixtureGenerationDirector.ts`,
// pero el proyecto es 100% JS (Vite 5 sin toolchain TS); se implementa en
// `.js` para mantener la convención del dominio `event/`.
// ════════════════════════════════════════════════════════════════════

import { EventDirector, EVENT_ACTIONS, EVENT_TYPES } from './EventDirector'

const STEPS = [
  { id: 'waiting',             icon: '📋' },
  { id: 'generating_fixtures', icon: '⚙️' },
  { id: 'saving_matches',      icon: '💾' },
  { id: 'completed',           icon: '✅' },
]

const FIXTURE_STATES = {
  waiting: 'waiting',
  generating_fixtures: 'generating_fixtures',
  saving_matches: 'saving_matches',
  completed: 'completed',
  cancelled: 'cancelled',
}

const getFixtureState = (event = {}) =>
  FIXTURE_STATES[event.state] || FIXTURE_STATES.waiting

export class FixtureGenerationDirector extends EventDirector {
  constructor() {
    super({ id: 'fixture_generation', type: EVENT_TYPES.FIXTURE_GENERATION, steps: STEPS })
  }

  getCurrentStep(event, now = new Date()) {
    const state = getFixtureState(event)
    if (state === FIXTURE_STATES.cancelled) {
      return { id: 'cancelled', index: this.steps.length, state }
    }
    const index = this.getStepIndex(state)
    return { id: state, index: index >= 0 ? index : 0, state }
  }

  dispatch(event, action, payload = {}) {
    const now = payload.now || new Date()
    const state = getFixtureState(event)
    const progress = event.fixture_progress || { generated: 0, saved: 0, total: payload.total || 0 }

    switch (action) {
      case EVENT_ACTIONS.START_GENERATION:
        if (state === FIXTURE_STATES.waiting || state === FIXTURE_STATES.cancelled) {
          return {
            state: FIXTURE_STATES.generating_fixtures,
            started_at: now.toISOString(),
            fixture_progress: {
              generated: 0,
              saved: 0,
              total: payload.total || 0,
            },
          }
        }
        return null

      case EVENT_ACTIONS.GENERATION_PROGRESS: {
        const generated = payload.generated ?? progress.generated
        const saved = payload.saved ?? progress.saved
        const total = payload.total ?? progress.total
        const allGenerated = generated >= total
        return {
          state: allGenerated ? FIXTURE_STATES.saving_matches : FIXTURE_STATES.generating_fixtures,
          fixture_progress: { generated, saved, total },
        }
      }

      case EVENT_ACTIONS.SAVE_COMPLETE:
        if (state === FIXTURE_STATES.saving_matches || state === FIXTURE_STATES.generating_fixtures) {
          return {
            state: FIXTURE_STATES.completed,
            finished_at: now.toISOString(),
            fixture_progress: {
              generated: progress.total,
              saved: progress.total,
              total: progress.total,
            },
          }
        }
        return null

      case EVENT_ACTIONS.COMPLETE_EVENT:
        if (state !== FIXTURE_STATES.completed && state !== FIXTURE_STATES.cancelled) {
          return { state: FIXTURE_STATES.completed, finished_at: now.toISOString() }
        }
        return null

      case EVENT_ACTIONS.CANCEL:
        if (state !== FIXTURE_STATES.completed && state !== FIXTURE_STATES.cancelled) {
          return {
            state: FIXTURE_STATES.cancelled,
            cancel_reason: payload.reason || 'cancelled_by_admin',
          }
        }
        return null

      default:
        return null
    }
  }
}

// Singleton de uso directo desde hooks (nunca desde componentes).
export const fixtureGenerationDirector = new FixtureGenerationDirector()
