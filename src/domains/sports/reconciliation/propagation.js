/**
 * SUP-004 — Propagation
 *
 * Propagates provider-owned data from master_games to league_games.
 *
 * Provider-owned fields (source of truth = provider/master_game):
 *   - home_score
 *   - away_score
 *   - result
 *   - finished
 *   - game_time
 *
 * League-owned fields (NOT propagated):
 *   - active
 *   - training_session_id
 *   - league_id
 *   - master_game_id
 *   - Any league-specific fields
 *
 * Propagation rules:
 *   - Only propagate to league_games where training_session_id IS NULL
 *   - Respect manual override (mapping_confidence = 'manual')
 *   - Only propagate when master_game.mapping_status = 'mapped'
 */

export const PROVIDER_OWNED_FIELDS = [
  'home_score',
  'away_score',
  'result',
  'finished',
  'game_time',
]

export const LEAGUE_OWNED_FIELDS = [
  'active',
  'training_session_id',
  'league_id',
  'master_game_id',
]

/**
 * Check if a league_game is eligible for propagation.
 * Only official league games (training_session_id IS NULL) are eligible.
 */
export function isEligibleForPropagation(leagueGame) {
  return leagueGame.training_session_id === null
    && leagueGame.master_game_id != null
}

/**
 * Build the propagation payload from master_game to league_game.
 * Only includes provider-owned fields that have actually changed.
 *
 * @param {Object} masterGame - Source master_game
 * @param {Object} leagueGame - Target league_game
 * @returns {Object|null} Update payload or null if no changes
 */
export function buildPropagationPayload(masterGame, leagueGame) {
  if (masterGame.mapping_status !== 'mapped' && masterGame.mapping_status !== 'manual_override') {
    return null
  }

  const update = {}
  let hasChanges = false

  for (const field of PROVIDER_OWNED_FIELDS) {
    const masterValue = masterGame[field]
    const leagueValue = leagueGame[field]

    if (masterValue !== leagueValue) {
      update[field] = masterValue
      hasChanges = true
    }
  }

  return hasChanges ? update : null
}

/**
 * Determine if propagation should occur for a master_game.
 *
 * @param {Object} masterGame - The master_game to check
 * @returns {Object} Decision with shouldPropagate and reason
 */
export function shouldPropagate(masterGame) {
  if (masterGame.mapping_status !== 'mapped' && masterGame.mapping_status !== 'manual_override') {
    return { shouldPropagate: false, reason: 'not_mapped' }
  }

  return { shouldPropagate: true, reason: 'mapped' }
}

/**
 * Calculate propagation changes for a set of league_games.
 *
 * @param {Object} masterGame - Source master_game
 * @param {Array} leagueGames - Target league_games
 * @returns {Object} Propagation result with updates and skipped
 */
export function calculatePropagation(masterGame, leagueGames) {
  const result = {
    updates: [],
    skipped: [],
    noChanges: [],
  }

  const decision = shouldPropagate(masterGame)
  if (!decision.shouldPropagate) {
    result.skipped = leagueGames.map(lg => ({
      leagueGameId: lg.id,
      reason: decision.reason,
    }))
    return result
  }

  for (const lg of leagueGames) {
    if (!isEligibleForPropagation(lg)) {
      result.skipped.push({
        leagueGameId: lg.id,
        reason: 'simulation_game',
      })
      continue
    }

    const payload = buildPropagationPayload(masterGame, lg)
    if (payload) {
      result.updates.push({
        leagueGameId: lg.id,
        before: {
          home_score: lg.home_score,
          away_score: lg.away_score,
          result: lg.result,
          finished: lg.finished,
          game_time: lg.game_time,
        },
        after: {
          home_score: payload.home_score ?? lg.home_score,
          away_score: payload.away_score ?? lg.away_score,
          result: payload.result ?? lg.result,
          finished: payload.finished ?? lg.finished,
          game_time: payload.game_time ?? lg.game_time,
        },
        payload,
      })
    } else {
      result.noChanges.push({ leagueGameId: lg.id })
    }
  }

  return result
}
