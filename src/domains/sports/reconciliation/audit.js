/**
 * SUP-004 — Audit
 *
 * Uses admin_audit_log infrastructure (007.2).
 * Records before/after state sufficient for rollback.
 *
 * Actions:
 *   - reconciliation_auto_map
 *   - reconciliation_ambiguous
 *   - reconciliation_unmatched
 *   - reconciliation_skipped
 *   - manual_override
 *   - manual_revert
 *   - rollback_conflict
 */

export const AUDIT_ACTIONS = {
  AUTO_MAP: 'reconciliation_auto_map',
  AMBIGUOUS: 'reconciliation_ambiguous',
  UNMATCHED: 'reconciliation_unmatched',
  SKIPPED: 'reconciliation_skipped',
  MANUAL_OVERRIDE: 'manual_override',
  MANUAL_REVERT: 'manual_revert',
  ROLLBACK_CONFLICT: 'rollback_conflict',
  ROLLBACK_APPLIED: 'rollback_applied',
}

/**
 * Build the master_game state snapshot for audit.
 * Captures all fields relevant to reconciliation.
 */
export function snapshotMasterGame(masterGame) {
  if (!masterGame) return null
  return {
    id: masterGame.id,
    provider: masterGame.provider ?? null,
    external_game_id: masterGame.external_game_id ?? null,
    external_competition_id: masterGame.external_competition_id ?? null,
    mapping_status: masterGame.mapping_status ?? null,
    mapping_confidence: masterGame.mapping_confidence ?? null,
    reconciliation_source: masterGame.reconciliation_source ?? null,
    game_time: masterGame.game_time ?? null,
    home_score: masterGame.home_score ?? null,
    away_score: masterGame.away_score ?? null,
    result: masterGame.result ?? null,
    finished: masterGame.finished ?? null,
    home_abbr: masterGame.home_abbr ?? null,
    away_abbr: masterGame.away_abbr ?? null,
    week: masterGame.week ?? null,
    phase: masterGame.phase ?? null,
    season: masterGame.season ?? null,
    mapped_at: masterGame.mapped_at ?? null,
    mapped_by: masterGame.mapped_by ?? null,
  }
}

/**
 * Build propagation changes snapshot for audit.
 */
export function snapshotPropagationChanges(propagationResult) {
  if (!propagationResult) return null
  return {
    league_games_affected: propagationResult.updates.length,
    changes: propagationResult.updates.map(u => ({
      league_game_id: u.leagueGameId,
      before: u.before,
      after: u.after,
    })),
  }
}

/**
 * Build audit payload for reconciliation_auto_map.
 */
export function buildAutoMapPayload({ before, after, provider, externalGameId, matchResult, propagationResult, actor }) {
  return {
    action: AUDIT_ACTIONS.AUTO_MAP,
    provider,
    external_game_id: externalGameId,
    entity_id: after?.id ?? null,
    actor: actor ?? 'system',
    timestamp: new Date().toISOString(),
    reason: matchResult?.reason ?? null,
    confidence: after?.mapping_confidence ?? null,
    mapping_status_before: before?.mapping_status ?? null,
    mapping_status_after: after?.mapping_status ?? null,
    provider_before: before?.provider ?? null,
    provider_after: after?.provider ?? null,
    external_id_before: before?.external_game_id ?? null,
    external_id_after: after?.external_game_id ?? null,
    before_state: snapshotMasterGame(before),
    after_state: snapshotMasterGame(after),
    propagation_before: propagationResult ? null : null,
    propagation_after: snapshotPropagationChanges(propagationResult),
  }
}

/**
 * Build audit payload for reconciliation_ambiguous.
 */
export function buildAmbiguousPayload({ providerGame, candidates, provider, actor }) {
  return {
    action: AUDIT_ACTIONS.AMBIGUOUS,
    provider,
    external_game_id: providerGame?.externalGameId ?? null,
    entity_id: null,
    actor: actor ?? 'system',
    timestamp: new Date().toISOString(),
    reason: 'multiple_candidates',
    confidence: 'conflict',
    candidates: candidates.map(c => ({
      id: c.id,
      home_abbr: c.home_abbr,
      away_abbr: c.away_abbr,
      game_time: c.game_time,
      week: c.week,
      phase: c.phase,
      mapping_status: c.mapping_status,
    })),
    provider_game: {
      externalGameId: providerGame?.externalGameId,
      homeTeamAbbr: providerGame?.homeTeamAbbr,
      awayTeamAbbr: providerGame?.awayTeamAbbr,
      gameTime: providerGame?.gameTime,
      week: providerGame?.week,
      phase: providerGame?.phase,
    },
  }
}

/**
 * Build audit payload for reconciliation_unmatched.
 */
export function buildUnmatchedPayload({ providerGame, provider, actor }) {
  return {
    action: AUDIT_ACTIONS.UNMATCHED,
    provider,
    external_game_id: providerGame?.externalGameId ?? null,
    entity_id: null,
    actor: actor ?? 'system',
    timestamp: new Date().toISOString(),
    reason: 'no_candidate',
    confidence: null,
    provider_game: {
      externalGameId: providerGame?.externalGameId,
      homeTeamAbbr: providerGame?.homeTeamAbbr,
      awayTeamAbbr: providerGame?.awayTeamAbbr,
      gameTime: providerGame?.gameTime,
      week: providerGame?.week,
      phase: providerGame?.phase,
    },
  }
}

/**
 * Build audit payload for reconciliation_skipped.
 */
export function buildSkippedPayload({ masterGame, provider, externalGameId, reason, actor }) {
  return {
    action: AUDIT_ACTIONS.SKIPPED,
    provider,
    external_game_id: externalGameId ?? null,
    entity_id: masterGame?.id ?? null,
    actor: actor ?? 'system',
    timestamp: new Date().toISOString(),
    reason,
    confidence: masterGame?.mapping_confidence ?? null,
    before_state: snapshotMasterGame(masterGame),
  }
}

/**
 * Build audit payload for manual_override.
 */
export function buildManualOverridePayload({ before, after, actor, reason }) {
  return {
    action: AUDIT_ACTIONS.MANUAL_OVERRIDE,
    provider: after?.provider ?? null,
    external_game_id: after?.external_game_id ?? null,
    entity_id: after?.id ?? null,
    actor,
    timestamp: new Date().toISOString(),
    reason: reason ?? 'manual_override_set',
    confidence: 'manual',
    mapping_status_before: before?.mapping_status ?? null,
    mapping_status_after: after?.mapping_status ?? null,
    before_state: snapshotMasterGame(before),
    after_state: snapshotMasterGame(after),
  }
}

/**
 * Build audit payload for manual_revert.
 */
export function buildManualRevertPayload({ before, after, actor, reason }) {
  return {
    action: AUDIT_ACTIONS.MANUAL_REVERT,
    provider: before?.provider ?? null,
    external_game_id: before?.external_game_id ?? null,
    entity_id: after?.id ?? null,
    actor,
    timestamp: new Date().toISOString(),
    reason: reason ?? 'manual_override_reverted',
    confidence: after?.mapping_confidence ?? null,
    mapping_status_before: before?.mapping_status ?? null,
    mapping_status_after: after?.mapping_status ?? null,
    before_state: snapshotMasterGame(before),
    after_state: snapshotMasterGame(after),
  }
}

/**
 * Build audit payload for rollback_conflict.
 */
export function buildRollbackConflictPayload({ masterGame, auditRecord, currentValue, afterValue, actor }) {
  return {
    action: AUDIT_ACTIONS.ROLLBACK_CONFLICT,
    provider: masterGame?.provider ?? null,
    external_game_id: masterGame?.external_game_id ?? null,
    entity_id: masterGame?.id ?? null,
    actor,
    timestamp: new Date().toISOString(),
    reason: 'current_value_differs_from_after',
    original_audit_id: auditRecord?.id ?? null,
    conflict_details: {
      field: auditRecord?.field ?? null,
      current_value: currentValue,
      recorded_after_value: afterValue,
      recorded_before_value: auditRecord?.before_value ?? null,
    },
    before_state: snapshotMasterGame(masterGame),
  }
}

/**
 * Build audit payload for rollback_applied.
 */
export function buildRollbackAppliedPayload({ before, after, auditRecord, actor }) {
  return {
    action: AUDIT_ACTIONS.ROLLBACK_APPLIED,
    provider: after?.provider ?? null,
    external_game_id: after?.external_game_id ?? null,
    entity_id: after?.id ?? null,
    actor,
    timestamp: new Date().toISOString(),
    reason: 'rollback_applied',
    original_audit_id: auditRecord?.id ?? null,
    before_state: snapshotMasterGame(before),
    after_state: snapshotMasterGame(after),
  }
}
