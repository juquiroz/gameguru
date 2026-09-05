/**
 * SUP-004 — Conflict Resolution
 *
 * Precedence (PO approved):
 *   1. manual_override — highest precedence
 *   2. Existing authoritative provider mapping
 *   3. Configured provider precedence
 *   4. New provider claim
 *   5. Conflict/ambiguous review
 */

export const RESOLUTION = {
  SKIP_MANUAL_OVERRIDE: 'skip_manual_override',
  SKIP_EXISTING_MAPPING: 'skip_existing_mapping',
  USE_EXISTING: 'use_existing',
  NEW_CLAIM: 'new_claim',
  CONFLICT_REVIEW: 'conflict_review',
}

/**
 * Provider precedence configuration.
 * For MVP, only api-sports is configured.
 * Architecture allows adding providers without structural changes.
 */
const DEFAULT_PROVIDER_PRECEDENCE = ['api-sports']

/**
 * Check if a master_game has manual override protection.
 */
export function isManualOverride(masterGame) {
  return masterGame.mapping_status === 'manual_override'
    || masterGame.mapping_confidence === 'manual'
}

/**
 * Check if a master_game already has an authoritative provider mapping.
 */
export function hasExistingMapping(masterGame, provider) {
  return masterGame.provider === provider
    && masterGame.external_game_id != null
    && masterGame.mapping_status === 'mapped'
}

/**
 * Resolve conflict when a provider game could map to an existing master_game
 * that already has a different mapping.
 *
 * @param {Object} existingMasterGame - The existing master_game
 * @param {Object} providerGame - The normalized game from provider
 * @param {string} newProvider - The provider attempting to claim
 * @param {string[]} providerPrecedence - Ordered list of provider precedence
 * @returns {Object} Resolution with action and reason
 */
export function resolveConflict(existingMasterGame, providerGame, newProvider, providerPrecedence = DEFAULT_PROVIDER_PRECEDENCE) {
  // Priority 1: Manual override — never auto-reassign
  if (isManualOverride(existingMasterGame)) {
    return {
      resolution: RESOLUTION.SKIP_MANUAL_OVERRIDE,
      action: 'skip',
      reason: 'manual_override_protected',
      masterGame: existingMasterGame,
    }
  }

  // Priority 2: Existing authoritative provider mapping (same provider)
  if (hasExistingMapping(existingMasterGame, newProvider)) {
    return {
      resolution: RESOLUTION.SKIP_EXISTING_MAPPING,
      action: 'skip',
      reason: 'existing_authoritative_mapping',
      masterGame: existingMasterGame,
    }
  }

  // Priority 3: Different provider — check precedence
  if (existingMasterGame.provider && existingMasterGame.provider !== newProvider) {
    const existingIdx = providerPrecedence.indexOf(existingMasterGame.provider)
    const newIdx = providerPrecedence.indexOf(newProvider)

    // Existing provider has higher precedence (lower index)
    if (existingIdx !== -1 && (newIdx === -1 || existingIdx < newIdx)) {
      return {
        resolution: RESOLUTION.USE_EXISTING,
        action: 'skip',
        reason: 'existing_provider_higher_precedence',
        masterGame: existingMasterGame,
      }
    }

    // New provider has higher precedence
    if (newIdx !== -1 && (existingIdx === -1 || newIdx < existingIdx)) {
      return {
        resolution: RESOLUTION.NEW_CLAIM,
        action: 'remap',
        reason: 'new_provider_higher_precedence',
        masterGame: existingMasterGame,
      }
    }

    // Same precedence or both unknown — conflict review
    return {
      resolution: RESOLUTION.CONFLICT_REVIEW,
      action: 'review',
      reason: 'provider_precedence_tie',
      masterGame: existingMasterGame,
    }
  }

  // Priority 4: No existing provider — new claim
  if (!existingMasterGame.provider) {
    return {
      resolution: RESOLUTION.NEW_CLAIM,
      action: 'map',
      reason: 'no_existing_provider',
      masterGame: existingMasterGame,
    }
  }

  // Priority 5: Unresolved — conflict review
  return {
    resolution: RESOLUTION.CONFLICT_REVIEW,
    action: 'review',
    reason: 'unresolved_conflict',
    masterGame: existingMasterGame,
  }
}

/**
 * Determine if reconciliation should proceed for a matched game.
 *
 * @param {Object} matchResult - Result from matching algorithm
 * @param {string} provider - Provider name
 * @returns {Object} Decision with shouldProceed and reason
 */
export function shouldProceed(matchResult, provider) {
  if (matchResult.status === 'unmatched') {
    return { shouldProceed: false, reason: 'no_match' }
  }

  if (matchResult.status === 'ambiguous') {
    return { shouldProceed: false, reason: 'ambiguous_match' }
  }

  if (matchResult.status === 'mapped' && matchResult.matchedGame) {
    const resolution = resolveConflict(matchResult.matchedGame, null, provider)

    if (resolution.action === 'skip') {
      return { shouldProceed: false, reason: resolution.reason }
    }

    if (resolution.action === 'review') {
      return { shouldProceed: false, reason: 'conflict_requires_review' }
    }

    return { shouldProceed: true, reason: resolution.reason }
  }

  return { shouldProceed: false, reason: 'unknown_match_status' }
}
