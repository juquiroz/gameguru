// ════════════════════════════════════════════════════════════════════
// src/domains/event/ — Directores de eventos (BUILD-TC-003 / TC-004)
//
// El Dashboard/la UI solo conoce el contrato EventDirector (steps + dispatch),
// no qué motor está detrás. Hoy hay dos directores (Training Camp y Fixture
// Generation); Preseason/OfficialSeason comparten el mismo contrato.
// ════════════════════════════════════════════════════════════════════

export { EVENT_TYPES, EVENT_ACTIONS, EventDirector } from './EventDirector'
export { TrainingCampDirector, trainingCampDirector } from './TrainingCampDirector'
export { FixtureGenerationDirector, fixtureGenerationDirector } from './FixtureGenerationDirector'
export { fixtureGeneratorService } from './services/FixtureGeneratorService'
export { buildCalendar, calendarHelpers } from './services/fixtureCalendar'
export { gameWeekDirector, GameWeekDirector } from '../game-week'
export { gameWeekService, picksService } from '../game-week'
