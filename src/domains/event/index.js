// ════════════════════════════════════════════════════════════════════
// src/domains/event/ — Directores de eventos (BUILD-TC-003)
//
// El Dashboard/la UI solo conoce el contrato EventDirector (steps + dispatch),
// no qué motor está detrás. Hoy hay un solo director (Training Camp); el
// Preseason/OfficialSeason Director comparten el mismo contrato.
// ════════════════════════════════════════════════════════════════════

export { EVENT_ACTIONS, EventDirector } from './EventDirector'
export { TrainingCampDirector, trainingCampDirector } from './TrainingCampDirector'
