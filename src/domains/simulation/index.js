// ════════════════════════════════════════════════════════════════════
// src/domains/simulation/ — Simulation Engine (BUILD-TC-006)
//
// Cuarto motor del ciclo (Training Camp → Fixture Generation → Game Week →
// Simulation → Results → Standings). Misma arquitectura que los demás:
// un director puro (SimulationDirector, máquina INTERNA de la corrida)
// coordina; MatchSimulator genera resultados deterministas (seed); el
// SimulationService persiste en `league_games` y `game_weeks`; y
// StandingsCalculator deriva los standings por usuario. La máquina pública
// del evento sigue siendo GameWeekDirector (games_in_progress →
// simulation_running → completed); este dominio solo consume una Game Week
// con picks bloqueados y NUNCA escribe sobre picks.
//
// Fase 6.1 (núcleo, este BUILD): director + motor + service + standings +
// migración + extensión de GameWeekDirector. La UI/orquestación en el hook
// y la UX live son fases 6.2/6.3.
// ════════════════════════════════════════════════════════════════════

export { SimulationDirector, simulationDirector, SIMULATION_STATES, getSimulationState, defaultRun } from './SimulationDirector'
export { simulateGame, simulateBatch } from './MatchSimulator'
export { simulationService } from './SimulationService'
export { computeStandings, buildResultsMap } from './StandingsCalculator'
