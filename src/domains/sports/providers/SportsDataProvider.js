/**
 * SportsDataProvider - Interfaz abstracta para proveedores de datos deportivos
 * 
 * Esta interfaz define el contrato mínimo que debe implementar cualquier proveedor
 * de datos deportivos (API-Sports, SportsDataIO, etc.)
 * 
 * MVP: Solo NFL implementado via API-Sports
 * POST-MVP: MLB, NBA via adapters adicionales
 */

export const SPORTS_PROVIDER_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINAL: 'final',
  POSTPONED: 'postponed',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended',
  DELAYED: 'delayed',
  RESCHEDULED: 'rescheduled',
}

/**
 * @typedef {Object} NormalizedGame
 * @property {string} externalGameId - ID único del partido en el proveedor
 * @property {string} externalCompetitionId - ID de la competición/liga externa
 * @property {string} homeTeamAbbr - Abreviatura del equipo local (mapeada a Gameguru)
 * @property {string} awayTeamAbbr - Abreviatura del equipo visitante (mapeada a Gameguru)
 * @property {string} gameTime - ISO string del horario del partido
 * @property {string} status - Estado del partido (ver SPORTS_PROVIDER_STATUS)
 * @property {number|null} homeScore - Puntaje del equipo local (null si no empezó)
 * @property {number|null} awayScore - Puntaje del equipo visitante (null si no empezó)
 * @property {string|null} result - Abreviatura del ganador o null (empate/pendiente)
 * @property {boolean} finished - true si el partido terminó
 * @property {number} week - Semana/jornada del partido
 * @property {string} phase - 'preseason' | 'regular' | 'postseason'
 */

/**
 * @typedef {Object} SyncResult
 * @property {string} status - 'completed' | 'failed'
 * @property {number} records_fetched - Total de partidos obtenidos del provider
 * @property {number} records_created - Nuevos partidos creados en master_games
 * @property {number} records_updated - Partidos actualizados (scores cambiados)
 * @property {number} records_unchanged - Partidos sin cambios
 * @property {number} records_rejected - Partidos que no se pudieron procesar
 * @property {number} records_propagated - Partidos propagados a league_games
 * @property {number} error_count - Número de errores
 * @property {string|null} error_message - Mensaje de error si status = 'failed'
 */

export const SportsDataProvider = {
  /**
   * Obtener partidos de una competición/liga
   * 
   * @param {Object} params
   * @param {string} params.sport - 'NFL' | 'MLB' | 'NBA'
   * @param {string} params.season - Temporada (ej: '2026')
   * @param {string} params.phase - 'preseason' | 'regular' | 'postseason'
   * @param {string} [params.competitionId] - ID específico de la competición (opcional)
   * @returns {Promise<NormalizedGame[]>}
   */
  async getGames({ sport, season, phase, competitionId }) {
    throw new Error('getGames must be implemented by provider')
  },

  /**
   * Obtener estado actual de un partido específico
   * 
   * @param {string} externalGameId - ID del partido en el proveedor
   * @returns {Promise<NormalizedGame|null>}
   */
  async getGameStatus(externalGameId) {
    throw new Error('getGameStatus must be implemented by provider')
  },

  /**
   * Obtener competiciones/ligas disponibles para un deporte
   * 
   * @param {string} sport - 'NFL' | 'MLB' | 'NBA'
   * @returns {Promise<Array<{id: string, name: string, season: string}>>}
   */
  async getCompetitions(sport) {
    throw new Error('getCompetitions must be implemented by provider')
  },
}
