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
// ════════════════════════════════════════════════════════════════════

export const EVENT_ACTIONS = {
  OPEN_LOBBY: 'OPEN_LOBBY',
  START_NOW: 'START_NOW',
  CANCEL: 'CANCEL',
  TICK: 'TICK',
}

export class EventDirector {
  constructor({ id, steps }) {
    this.id = id
    this.steps = steps
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
