// ════════════════════════════════════════════════════════════════════
// training-camp — autoResults (BUILD-TC-V2-AUTO)
//
// Resolución automática de resultados: dado un juego + (seed, index)
// deterministas, delega en el MatchSimulator del proyecto (mismo motor
// determinista de la simulación) y devuelve `{ home_score, away_score,
// result, finished: true }`. Quién persiste es el AutoResultsService.
//
// Determinismo (mismas reglas que BUILD-TC-006): misma seed + mismo index
// → mismo resultado; `result` SIEMPRE coincide con los scores (null en
// empate); `finished` lo aplica el servicio.
// ════════════════════════════════════════════════════════════════════

import { simulateGame } from '../simulation/MatchSimulator.js'
import { stableIndexOfWeek } from './autoSchedule.js'

// Resuelve un juego de forma determinista. `index` es la posición estable
// del juego dentro de su semana (por game_time), nunca el orden de la
// iteración del caller.
export const resolveGame = (game = {}, { seed = 1, index = 0 } = {}) => ({
  ...simulateGame(game, { seed, index }),
  finished: true,
})

// Re-export útil del índice estable para los services.
export { stableIndexOfWeek }