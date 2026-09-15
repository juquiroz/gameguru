export { SportsDataProvider, SPORTS_PROVIDER_STATUS } from './providers/SportsDataProvider.js'
export { createEspnNflAdapter, espnProvider, TEAM_MAPPING, STATUS_MAPPING, SEASON_TYPE_MAPPING } from './providers/espn.js'
// DEPRECATED (PLAN-021): API-Sports free no cubre temporada 2026. Mantenido por compatibilidad.
export { createApiSportsNflAdapter } from './providers/apiSportsNfl.js'
export * from './reconciliation/index.js'
