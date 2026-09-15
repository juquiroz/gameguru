/**
 * SUP-004 — Matching Algorithm
 *
 * Matching priority (PO approved):
 *   1. Exact provider external ID (provider + external_game_id)
 *   2. Team identity + week/phase + game_time ±2h
 *   3. Normalized team identity + time
 *   4. Fuzzy fallback
 *
 * Results:
 *   - mapped (high confidence)
 *   - ambiguous (multiple candidates, manual review)
 *   - unmatched (no candidate)
 */

export const MATCH_RESULT = {
  MAPPED: 'mapped',
  AMBIGUOUS: 'ambiguous',
  UNMATCHED: 'unmatched',
}

export const MATCH_CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  MANUAL: 'manual',
  CONFLICT: 'conflict',
}

export const TIME_TOLERANCE_MS = 2 * 60 * 60 * 1000

/**
 * Parse game_time to Date. Handles ISO strings and text formats.
 */
export function parseGameTime(gameTime) {
  if (!gameTime) return null
  if (gameTime instanceof Date) return gameTime
  const d = new Date(gameTime)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Calculate absolute time difference in milliseconds.
 */
export function timeDiffMs(timeA, timeB) {
  const a = parseGameTime(timeA)
  const b = parseGameTime(timeB)
  if (!a || !b) return Infinity
  return Math.abs(a.getTime() - b.getTime())
}

/**
 * Priority 1: Exact provider external ID match.
 * Returns the existing master_game if (provider, external_game_id) matches.
 */
export function findByExternalId(candidates, provider, externalGameId) {
  if (!provider || !externalGameId) return null
  return candidates.find(
    c => c.provider === provider && c.external_game_id === String(externalGameId)
  ) || null
}

/**
 * Priority 2: Team identity + week/phase + game_time ±2h.
 * Uses home_abbr/away_abbr for matching (normalized identifiers).
 */
export function findByTeamWeekTime(candidates, normalizedGame) {
  const { homeTeamAbbr, awayTeamAbbr, week, phase, gameTime } = normalizedGame
  const toleranceMs = normalizedGame.toleranceMs ?? TIME_TOLERANCE_MS

  return candidates.filter(c => {
    if (c.home_abbr !== homeTeamAbbr || c.away_abbr !== awayTeamAbbr) return false
    if (c.phase !== phase) return false
    if (week != null && c.week != null && c.week !== week) return false
    const diff = timeDiffMs(c.game_time, gameTime)
    return diff <= toleranceMs
  })
}

/**
 * Priority 3: Normalized team identity + time (without week constraint).
 * Relaxed matching: same teams + same phase + time within tolerance.
 */
export function findByTeamTime(candidates, normalizedGame) {
  const { homeTeamAbbr, awayTeamAbbr, phase, gameTime } = normalizedGame
  const toleranceMs = normalizedGame.toleranceMs ?? TIME_TOLERANCE_MS

  return candidates.filter(c => {
    if (c.home_abbr !== homeTeamAbbr || c.away_abbr !== awayTeamAbbr) return false
    if (c.phase !== phase) return false
    const diff = timeDiffMs(c.game_time, gameTime)
    return diff <= toleranceMs
  })
}

/**
 * Priority 4: Fuzzy fallback.
 * Same teams + same season + time within extended tolerance (±2h still, but no phase constraint).
 * This is the weakest match — only used to flag potential candidates for review.
 */
export function findFuzzy(candidates, normalizedGame) {
  const { homeTeamAbbr, awayTeamAbbr, gameTime } = normalizedGame
  const toleranceMs = normalizedGame.toleranceMs ?? TIME_TOLERANCE_MS

  return candidates.filter(c => {
    if (c.home_abbr !== homeTeamAbbr || c.away_abbr !== awayTeamAbbr) return false
    const diff = timeDiffMs(c.game_time, gameTime)
    return diff <= toleranceMs
  })
}

/**
 * Main matching function. Applies priorities in order.
 *
 * @param {Object} normalizedGame - Normalized game from provider
 * @param {Array} existingMasterGames - Existing master_games to match against
 * @param {string} provider - Provider name (e.g., 'api-sports')
 * @returns {Object} Match result with status, confidence, candidates
 */
export function matchGame(normalizedGame, existingMasterGames, provider) {
  const result = {
    status: MATCH_RESULT.UNMATCHED,
    confidence: null,
    matchedGame: null,
    candidates: [],
    reason: null,
  }

  // Priority 1: Exact provider external ID
  const exactMatch = findByExternalId(existingMasterGames, provider, normalizedGame.externalGameId)
  if (exactMatch) {
    result.status = MATCH_RESULT.MAPPED
    result.confidence = MATCH_CONFIDENCE.HIGH
    result.matchedGame = exactMatch
    result.reason = 'exact_external_id'
    return result
  }

  // Priority 2: Team identity + week/phase + game_time ±2h
  const weekTimeMatches = findByTeamWeekTime(existingMasterGames, normalizedGame)
  if (weekTimeMatches.length === 1) {
    result.status = MATCH_RESULT.MAPPED
    result.confidence = MATCH_CONFIDENCE.HIGH
    result.matchedGame = weekTimeMatches[0]
    result.reason = 'team_week_time'
    return result
  }
  if (weekTimeMatches.length > 1) {
    result.status = MATCH_RESULT.AMBIGUOUS
    result.confidence = MATCH_CONFIDENCE.CONFLICT
    result.candidates = weekTimeMatches
    result.reason = 'multiple_team_week_time_matches'
    return result
  }

  // Priority 3: Normalized team identity + time (no week constraint)
  const teamTimeMatches = findByTeamTime(existingMasterGames, normalizedGame)
  if (teamTimeMatches.length === 1) {
    result.status = MATCH_RESULT.MAPPED
    result.confidence = MATCH_CONFIDENCE.MEDIUM
    result.matchedGame = teamTimeMatches[0]
    result.reason = 'team_time'
    return result
  }
  if (teamTimeMatches.length > 1) {
    result.status = MATCH_RESULT.AMBIGUOUS
    result.confidence = MATCH_CONFIDENCE.CONFLICT
    result.candidates = teamTimeMatches
    result.reason = 'multiple_team_time_matches'
    return result
  }

  // Priority 4: Fuzzy fallback
  const fuzzyMatches = findFuzzy(existingMasterGames, normalizedGame)
  if (fuzzyMatches.length === 1) {
    result.status = MATCH_RESULT.MAPPED
    result.confidence = MATCH_CONFIDENCE.LOW
    result.matchedGame = fuzzyMatches[0]
    result.reason = 'fuzzy'
    return result
  }
  if (fuzzyMatches.length > 1) {
    result.status = MATCH_RESULT.AMBIGUOUS
    result.confidence = MATCH_CONFIDENCE.CONFLICT
    result.candidates = fuzzyMatches
    result.reason = 'multiple_fuzzy_matches'
    return result
  }

  // No match found
  result.status = MATCH_RESULT.UNMATCHED
  result.confidence = null
  result.reason = 'no_candidate'
  return result
}
