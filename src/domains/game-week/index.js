// ════════════════════════════════════════════════════════════════════
// src/domains/game-week/ — Game Week & Picks (BUILD-TC-005)
//
// Tercer evento del ciclo (Training Camp → Fixture Generation → Game Week).
// Misma arquitectura que los demás: un director puro (GameWeekDirector)
// orquesta el ciclo (waiting → picks_open → picks_locked → completed) y los
// services (GameWeekService / PicksService) deciden y persisten. El contexto
// React es el único puente hacia la UI; TC-006 (Simulation Engine) consume
// los picks confirmados vía picksService.getConfirmedPicks sin tocar la UI.
// ════════════════════════════════════════════════════════════════════

export { GameWeekDirector, gameWeekDirector, GAME_WEEK_STATES } from './GameWeekDirector'
export { gameWeekService } from './GameWeekService'
export { picksService, PICK_STATUS } from './PicksService'
export { GameWeekProvider, useGameWeek } from './GameWeekContext'
export { default as GameWeekView } from './GameWeekView'
