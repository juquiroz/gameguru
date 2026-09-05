// ════════════════════════════════════════════════════════════════════
// EventDirector — contrato base de directores de eventos (BUILD-TC-003)
//
// Un director ORQUESTA el ciclo de un evento (hora → fixture → picks →
// simulación → fin): define la secuencia de pasos, deriva el paso actual y
// el último completado, y reacciona a acciones (admin, tick, motores).
//
// REGLA: el director coordina, NO genera. No crea partidos ni resultados;
// eso es trabajo de los motores (Fixture Generator / Simulation Engine).
// Futuros directores (PreseasonDirector, OfficialSeasonDirector) extienden
// este mismo contrato; la UI solo conoce `steps`/`currentStep`/`dispatch`.
//
// BUILD-TC-004: cada evento tiene un `type` (EVENT_TYPES) persistido en la
// sesión (`event.event_type`); el hook elige el director por ese tipo. Las
// acciones de generación (START_GENERATION / GENERATION_PROGRESS /
// SAVE_COMPLETE / COMPLETE_EVENT) son del contrato común para que cualquier
// motor futuro (Simulation Engine TC-005) reporte por el mismo camino.
// BUILD-TC-005.3: `ADVANCE_EVENT` es la acción administrativa/QA del contrato:
// completa/adelanta el evento sin esperar la duración real (los directores que
// la soportan la implementan idempotente: null si no hay transición). La UI la
// expone solo en contexto de admin.
// BUILD-TC-006: `SIMULATION_START` / `SIMULATION_PROGRESS` son las acciones
// del motor de resultados (GameWeekDirector / SimulationDirector);
// `PERSIST_DONE` / `STANDINGS_DONE` / `FAIL` son del SimulationDirector (la
// máquina interna de la corrida), también parte del contrato común.
// ════════════════════════════════════════════════════════════════════

export const EVENT_TYPES = {
  TRAINING_CAMP: 'training_camp',
  FIXTURE_GENERATION: 'fixture_generation',
  GAME_WEEK: 'game_week',
}

export const EVENT_ACTIONS = {
  OPEN_LOBBY: 'OPEN_LOBBY',
  START_NOW: 'START_NOW',
  CANCEL: 'CANCEL',
  TICK: 'TICK',
  ADVANCE_EVENT: 'ADVANCE_EVENT',
  START_GENERATION: 'START_GENERATION',
  GENERATION_PROGRESS: 'GENERATION_PROGRESS',
  SAVE_COMPLETE: 'SAVE_COMPLETE',
  COMPLETE_EVENT: 'COMPLETE_EVENT',
  OPEN_WEEK: 'OPEN_WEEK',
  LOCK_PICKS: 'LOCK_PICKS',
  OPEN_NEXT_WEEK: 'OPEN_NEXT_WEEK',
  SIMULATION_START: 'SIMULATION_START',
  SIMULATION_PROGRESS: 'SIMULATION_PROGRESS',
  PERSIST_DONE: 'PERSIST_DONE',
  STANDINGS_DONE: 'STANDINGS_DONE',
  FAIL: 'FAIL',
}

export class EventDirector {
  constructor({ id, type, steps }) {
    this.id = id
    this.type = type || id
    this.steps = steps
  }

  // Tipo de evento (EVENT_TYPES) que identifica a este director en la sesión.
  getEventType() {
    return this.type
  }

  // Secuencia canónica del evento (pasos ordenados).
  getSteps() {
    return this.steps
  }

  getStepIndex(stepId) {
    return this.steps.findIndex(s => s.id === stepId)
  }

  // Paso activo derivado de estado + reloj. Los directores concretos
  // implementan esta lógica (la base devuelve el primer paso).
  getCurrentStep(_event, _now = new Date()) {
    return { id: this.steps[0]?.id || null, index: 0 }
  }

  // Último paso completado. Para un paso activo i es i-1; al terminar el
  // ciclo el paso final queda como completado. null si nada se completó.
  getLastCompletedStep(event, now = new Date()) {
    const current = this.getCurrentStep(event, now)
    if (current.id == null || current.id === 'cancelled') return null
    if (current.index >= this.steps.length - 1) return current
    const prevIndex = current.index - 1
    return {
      id: prevIndex >= 0 ? this.steps[prevIndex].id : null,
      index: prevIndex,
    }
  }

  // Reacciona a una acción del sistema. Puro: recibe el estado y devuelve el
  // parche a aplicar (o null si no hay transición). No persiste.
  dispatch(_event, _action, _payload) {
    return null
  }
}
