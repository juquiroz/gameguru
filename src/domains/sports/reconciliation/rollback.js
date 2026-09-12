/**
 * SUP-004 — Rollback
 *
 * Manual rollback based on before/after state from audit log.
 *
 * Critical rule:
 *   - If current_value === recorded_after_value → restore before_value
 *   - If current_value !== recorded_after_value → rollback_conflict (no overwrite)
 *
 * NO SET score = NULL as generic rollback mechanism.
 * Rollback must be idempotent.
 */

import { PROVIDER_OWNED_FIELDS } from './propagation.js'
import {
  buildRollbackConflictPayload,
  buildRollbackAppliedPayload,
  snapshotMasterGame,
} from './audit.js'

export const ROLLBACK_RESULT = {
  APPLIED: 'applied',
  CONFLICT: 'conflict',
  NO_CHANGE: 'no_change',
  ALREADY_ROLLED_BACK: 'already_rolled_back',
}

/**
 * Compare a field value safely (handles null, undefined, types).
 */
function valuesEqual(a, b) {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return String(a) === String(b)
}

/**
 * Check if rollback can be safely applied for a single field.
 *
 * @param {*} currentValue - Current value in the database
 * @param {*} recordedAfterValue - Value recorded in audit after_state
 * @param {*} recordedBeforeValue - Value recorded in audit before_state
 * @returns {Object} Decision with canRestore and reason
 */
export function checkFieldRollback(currentValue, recordedAfterValue, recordedBeforeValue) {
  if (valuesEqual(currentValue, recordedBeforeValue)) {
    return { canRestore: false, result: ROLLBACK_RESULT.ALREADY_ROLLED_BACK, reason: 'already_at_before_state' }
  }

  if (valuesEqual(currentValue, recordedAfterValue)) {
    return { canRestore: true, result: ROLLBACK_RESULT.APPLIED, reason: 'current_matches_after' }
  }

  return { canRestore: false, result: ROLLBACK_RESULT.CONFLICT, reason: 'current_differs_from_after' }
}

/**
 * Evaluate rollback feasibility for a master_game based on audit record.
 *
 * @param {Object} currentMasterGame - Current state of master_game
 * @param {Object} auditBeforeState - before_state from audit record
 * @param {Object} auditAfterState - after_state from audit record
 * @returns {Object} Rollback evaluation result
 */
export function evaluateMasterGameRollback(currentMasterGame, auditBeforeState, auditAfterState) {
  const result = {
    canRollback: true,
    conflicts: [],
    restorableFields: {},
    alreadyRestoredFields: {},
  }

  const fieldsToCheck = [
    'provider', 'external_game_id', 'external_competition_id',
    'mapping_status', 'mapping_confidence', 'reconciliation_source',
    'game_time', 'home_score', 'away_score', 'result', 'finished',
  ]

  for (const field of fieldsToCheck) {
    const current = currentMasterGame[field]
    const before = auditBeforeState?.[field]
    const after = auditAfterState?.[field]

    const check = checkFieldRollback(current, after, before)

    if (check.result === ROLLBACK_RESULT.CONFLICT) {
      result.canRollback = false
      result.conflicts.push({
        field,
        current_value: current,
        recorded_after_value: after,
        recorded_before_value: before,
        reason: check.reason,
      })
    } else if (check.result === ROLLBACK_RESULT.ALREADY_ROLLED_BACK) {
      result.alreadyRestoredFields[field] = { current_value: current, before_value: before }
    } else if (check.result === ROLLBACK_RESULT.APPLIED) {
      result.restorableFields[field] = {
        current_value: current,
        before_value: before,
        after_value: after,
      }
    }
  }

  return result
}

/**
 * Evaluate rollback feasibility for league_games propagation.
 *
 * @param {Array} currentLeagueGames - Current state of league_games
 * @param {Array} auditPropagationChanges - propagation changes from audit
 * @returns {Object} Rollback evaluation for propagation
 */
export function evaluatePropagationRollback(currentLeagueGames, auditPropagationChanges) {
  const result = {
    canRollback: true,
    conflicts: [],
    restorable: [],
    alreadyRestored: [],
  }

  if (!auditPropagationChanges || !auditPropagationChanges.changes) {
    return result
  }

  for (const change of auditPropagationChanges.changes) {
    const currentLg = currentLeagueGames.find(lg => lg.id === change.league_game_id)
    if (!currentLg) {
      result.conflicts.push({
        league_game_id: change.league_game_id,
        reason: 'league_game_not_found',
      })
      result.canRollback = false
      continue
    }

    for (const field of PROVIDER_OWNED_FIELDS) {
      const before = change.before?.[field]
      const after = change.after?.[field]
      const current = currentLg[field]

      const check = checkFieldRollback(current, after, before)

      if (check.result === ROLLBACK_RESULT.CONFLICT) {
        result.canRollback = false
        result.conflicts.push({
          league_game_id: change.league_game_id,
          field,
          current_value: current,
          recorded_after_value: after,
          recorded_before_value: before,
          reason: check.reason,
        })
      } else if (check.result === ROLLBACK_RESULT.ALREADY_ROLLED_BACK) {
        result.alreadyRestored.push({ league_game_id: change.league_game_id, field })
      } else if (check.result === ROLLBACK_RESULT.APPLIED) {
        result.restorable.push({
          league_game_id: change.league_game_id,
          field,
          before_value: before,
          after_value: after,
        })
      }
    }
  }

  return result
}

/**
 * Build the restore payload for master_game rollback.
 * Only includes fields that can be safely restored.
 */
export function buildMasterGameRestorePayload(evaluation) {
  const payload = {}
  for (const [field, info] of Object.entries(evaluation.restorableFields)) {
    payload[field] = info.before_value
  }
  return payload
}

/**
 * Build the restore payload for league_games rollback.
 * Groups by league_game_id.
 */
export function buildLeagueGamesRestorePayload(evaluation) {
  const byLeagueGame = {}
  for (const item of evaluation.restorable) {
    if (!byLeagueGame[item.league_game_id]) {
      byLeagueGame[item.league_game_id] = {}
    }
    byLeagueGame[item.league_game_id][item.field] = item.before_value
  }
  return byLeagueGame
}

/**
 * Build audit payloads for rollback results.
 */
export function buildRollbackAuditPayloads({ masterGame, auditRecord, evaluation, propagationEvaluation, actor }) {
  const payloads = []

  if (evaluation.conflicts.length > 0) {
    for (const conflict of evaluation.conflicts) {
      payloads.push({
        entity: 'master_games',
        entity_id: masterGame.id,
        payload: buildRollbackConflictPayload({
          masterGame,
          auditRecord: { ...auditRecord, field: conflict.field, before_value: conflict.recorded_before_value },
          currentValue: conflict.current_value,
          afterValue: conflict.recorded_after_value,
          actor,
        }),
      })
    }
  }

  if (propagationEvaluation?.conflicts?.length > 0) {
    for (const conflict of propagationEvaluation.conflicts) {
      payloads.push({
        entity: 'league_games',
        entity_id: conflict.league_game_id,
        payload: buildRollbackConflictPayload({
          masterGame,
          auditRecord: { ...auditRecord, field: conflict.field, before_value: conflict.recorded_before_value },
          currentValue: conflict.current_value,
          afterValue: conflict.recorded_after_value,
          actor,
        }),
      })
    }
  }

  if (evaluation.canRollback && (!propagationEvaluation || propagationEvaluation.canRollback)) {
    const before = snapshotMasterGame(masterGame)
    const after = buildMasterGameRestorePayload(evaluation)
    const afterState = { ...masterGame, ...after }

    payloads.push({
      entity: 'master_games',
      entity_id: masterGame.id,
      payload: buildRollbackAppliedPayload({
        before,
        after: afterState,
        auditRecord,
        actor,
      }),
    })
  }

  return payloads
}
