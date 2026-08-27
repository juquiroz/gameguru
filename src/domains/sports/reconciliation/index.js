/**
 * SUP-004 — Reconciliation Engine
 *
 * Main entry point for provider game reconciliation.
 *
 * Flow:
 *   1. Receive normalized games from provider
 *   2. Match against existing master_games
 *   3. Resolve conflicts
 *   4. Assign mapping when appropriate
 *   5. Propagate to league_games
 *   6. Record audit
 *   7. Idempotent: repeated execution produces same result
 */

export {
  matchGame,
  findByExternalId,
  findByTeamWeekTime,
  findByTeamTime,
  findFuzzy,
  parseGameTime,
  timeDiffMs,
  MATCH_RESULT,
  MATCH_CONFIDENCE,
  TIME_TOLERANCE_MS,
} from './matching.js'

export {
  resolveConflict,
  shouldProceed,
  isManualOverride,
  hasExistingMapping,
  RESOLUTION,
} from './conflictResolution.js'

export {
  PROVIDER_OWNED_FIELDS,
  LEAGUE_OWNED_FIELDS,
  isEligibleForPropagation,
  buildPropagationPayload,
  shouldPropagate,
  calculatePropagation,
} from './propagation.js'

export {
  AUDIT_ACTIONS,
  snapshotMasterGame,
  snapshotPropagationChanges,
  buildAutoMapPayload,
  buildAmbiguousPayload,
  buildUnmatchedPayload,
  buildSkippedPayload,
  buildManualOverridePayload,
  buildManualRevertPayload,
  buildRollbackConflictPayload,
  buildRollbackAppliedPayload,
} from './audit.js'

export {
  ROLLBACK_RESULT,
  checkFieldRollback,
  evaluateMasterGameRollback,
  evaluatePropagationRollback,
  buildMasterGameRestorePayload,
  buildLeagueGamesRestorePayload,
  buildRollbackAuditPayloads,
} from './rollback.js'

export {
  dryRun,
  reconcileSingle,
  apply,
} from './backfill.js'
