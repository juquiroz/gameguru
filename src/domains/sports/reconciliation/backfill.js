/**
 * SUP-004 — Backfill
 *
 * Two separate operations:
 *   1. DRY RUN — identifies candidates, calculates matches, returns statistics.
 *      NO data modification.
 *   2. APPLY — executes reconciliation with audit. Requires JWT + platform_superadmin.
 *
 * DRY RUN metrics:
 *   - total_candidates
 *   - high_confidence_matches
 *   - medium_confidence_matches
 *   - low_confidence_matches
 *   - ambiguous
 *   - unmatched
 *   - conflicts
 *   - manual_overrides
 *   - skipped_already_mapped
 */

import { matchGame, MATCH_RESULT, MATCH_CONFIDENCE } from './matching.js'
import { resolveConflict, RESOLUTION } from './conflictResolution.js'
import { calculatePropagation } from './propagation.js'
import {
  buildAutoMapPayload,
  buildAmbiguousPayload,
  buildUnmatchedPayload,
  buildSkippedPayload,
  snapshotMasterGame,
} from './audit.js'

/**
 * Execute dry run reconciliation.
 * NO data modification. Returns statistics and details.
 *
 * @param {Array} providerGames - Normalized games from provider
 * @param {Array} existingMasterGames - Existing master_games
 * @param {string} provider - Provider name
 * @param {Object} options - Options (providerPrecedence, etc.)
 * @returns {Object} Dry run result with statistics and details
 */
export function dryRun(providerGames, existingMasterGames, provider, options = {}) {
  const stats = {
    total_candidates: providerGames.length,
    high_confidence_matches: 0,
    medium_confidence_matches: 0,
    low_confidence_matches: 0,
    ambiguous: 0,
    unmatched: 0,
    conflicts: 0,
    manual_overrides: 0,
    skipped_already_mapped: 0,
  }

  const details = []

  for (const pg of providerGames) {
    const matchResult = matchGame(pg, existingMasterGames, provider)

    const detail = {
      provider_game_id: pg.externalGameId,
      home_team: pg.homeTeamAbbr,
      away_team: pg.awayTeamAbbr,
      game_time: pg.gameTime,
      week: pg.week,
      phase: pg.phase,
      match_status: matchResult.status,
      match_confidence: matchResult.confidence,
      match_reason: matchResult.reason,
      master_game_id: matchResult.matchedGame?.id ?? null,
      candidates_count: matchResult.candidates.length,
      resolution: null,
    }

    if (matchResult.status === MATCH_RESULT.MAPPED && matchResult.matchedGame) {
      const resolution = resolveConflict(matchResult.matchedGame, pg, provider, options.providerPrecedence)
      detail.resolution = resolution.resolution

      if (resolution.action === 'skip' && resolution.reason === 'manual_override_protected') {
        stats.manual_overrides++
      } else if (resolution.action === 'skip' && resolution.reason === 'existing_authoritative_mapping') {
        stats.skipped_already_mapped++
      } else if (resolution.action === 'skip') {
        stats.skipped_already_mapped++
      } else if (resolution.action === 'review') {
        stats.conflicts++
      } else {
        if (matchResult.confidence === MATCH_CONFIDENCE.HIGH) stats.high_confidence_matches++
        else if (matchResult.confidence === MATCH_CONFIDENCE.MEDIUM) stats.medium_confidence_matches++
        else if (matchResult.confidence === MATCH_CONFIDENCE.LOW) stats.low_confidence_matches++
      }
    } else if (matchResult.status === MATCH_RESULT.AMBIGUOUS) {
      stats.ambiguous++
    } else if (matchResult.status === MATCH_RESULT.UNMATCHED) {
      stats.unmatched++
    }

    details.push(detail)
  }

  return {
    dry_run: true,
    provider,
    statistics: stats,
    details,
  }
}

/**
 * Execute reconciliation for a single provider game.
 * Returns the action taken and audit payload.
 *
 * @param {Object} providerGame - Normalized game from provider
 * @param {Array} existingMasterGames - Existing master_games
 * @param {string} provider - Provider name
 * @param {Object} options - Options (actor, providerPrecedence, etc.)
 * @returns {Object} Reconciliation result with action and audit payload
 */
export function reconcileSingle(providerGame, existingMasterGames, provider, options = {}) {
  const actor = options.actor ?? 'system'
  const matchResult = matchGame(providerGame, existingMasterGames, provider)

  if (matchResult.status === MATCH_RESULT.UNMATCHED) {
    return {
      action: 'unmatched',
      auditPayload: buildUnmatchedPayload({ providerGame, provider, actor }),
      masterGameId: null,
    }
  }

  if (matchResult.status === MATCH_RESULT.AMBIGUOUS) {
    return {
      action: 'ambiguous',
      auditPayload: buildAmbiguousPayload({
        providerGame,
        candidates: matchResult.candidates,
        provider,
        actor,
      }),
      masterGameId: null,
    }
  }

  if (matchResult.status === MATCH_RESULT.MAPPED && matchResult.matchedGame) {
    const resolution = resolveConflict(matchResult.matchedGame, providerGame, provider, options.providerPrecedence)

    if (resolution.action === 'skip') {
      return {
        action: 'skipped',
        auditPayload: buildSkippedPayload({
          masterGame: matchResult.matchedGame,
          provider,
          externalGameId: providerGame.externalGameId,
          reason: resolution.reason,
          actor,
        }),
        masterGameId: matchResult.matchedGame.id,
      }
    }

    if (resolution.action === 'review') {
      return {
        action: 'conflict_review',
        auditPayload: buildSkippedPayload({
          masterGame: matchResult.matchedGame,
          provider,
          externalGameId: providerGame.externalGameId,
          reason: 'conflict_requires_review',
          actor,
        }),
        masterGameId: matchResult.matchedGame.id,
      }
    }

    const before = snapshotMasterGame(matchResult.matchedGame)
    const after = {
      ...matchResult.matchedGame,
      provider,
      external_game_id: providerGame.externalGameId,
      external_competition_id: providerGame.externalCompetitionId ?? null,
      mapping_status: 'mapped',
      mapping_confidence: matchResult.confidence,
      reconciliation_source: options.reconciliationSource ?? provider,
      home_score: providerGame.homeScore ?? matchResult.matchedGame.home_score,
      away_score: providerGame.awayScore ?? matchResult.matchedGame.away_score,
      result: providerGame.result ?? matchResult.matchedGame.result,
      finished: providerGame.finished ?? matchResult.matchedGame.finished,
      game_time: providerGame.gameTime ?? matchResult.matchedGame.game_time,
      mapped_at: new Date().toISOString(),
      mapped_by: actor !== 'system' ? actor : null,
    }

    return {
      action: 'mapped',
      before,
      after,
      matchResult,
      masterGameId: matchResult.matchedGame.id,
    }
  }

  return {
    action: 'error',
    auditPayload: buildUnmatchedPayload({ providerGame, provider, actor }),
    masterGameId: null,
  }
}

/**
 * Execute full reconciliation apply.
 * Requires authorization (checked at Edge Function level).
 *
 * @param {Array} providerGames - Normalized games from provider
 * @param {Array} existingMasterGames - Existing master_games
 * @param {string} provider - Provider name
 * @param {Object} options - Options (actor, providerPrecedence, etc.)
 * @returns {Object} Apply result with statistics, updates, and audit payloads
 */
export function apply(providerGames, existingMasterGames, provider, options = {}) {
  const results = {
    mapped: [],
    ambiguous: [],
    unmatched: [],
    skipped: [],
    conflicts: [],
    auditPayloads: [],
    propagationUpdates: [],
  }

  let currentMasterGames = [...existingMasterGames]

  for (const pg of providerGames) {
    const result = reconcileSingle(pg, currentMasterGames, provider, options)

    if (result.action === 'mapped') {
      results.mapped.push({
        providerGameId: pg.externalGameId,
        masterGameId: result.masterGameId,
        before: result.before,
        after: result.after,
        confidence: result.matchResult.confidence,
        reason: result.matchResult.reason,
      })

      const propagation = calculatePropagation(result.after, options.leagueGames ?? [])
      results.propagationUpdates.push(...propagation.updates)

      results.auditPayloads.push({
        entity: 'master_games',
        entity_id: result.masterGameId,
        payload: buildAutoMapPayload({
          before: result.before,
          after: result.after,
          provider,
          externalGameId: pg.externalGameId,
          matchResult: result.matchResult,
          propagationResult: propagation,
          actor: options.actor ?? 'system',
        }),
      })

      currentMasterGames = currentMasterGames.map(mg =>
        mg.id === result.masterGameId ? { ...mg, ...result.after } : mg
      )
    } else if (result.action === 'ambiguous') {
      results.ambiguous.push({ providerGameId: pg.externalGameId })
      results.auditPayloads.push({
        entity: 'master_games',
        entity_id: null,
        payload: result.auditPayload,
      })
    } else if (result.action === 'unmatched') {
      results.unmatched.push({ providerGameId: pg.externalGameId })
      results.auditPayloads.push({
        entity: 'master_games',
        entity_id: null,
        payload: result.auditPayload,
      })
    } else if (result.action === 'skipped') {
      results.skipped.push({ providerGameId: pg.externalGameId, masterGameId: result.masterGameId })
      results.auditPayloads.push({
        entity: 'master_games',
        entity_id: result.masterGameId,
        payload: result.auditPayload,
      })
    } else if (result.action === 'conflict_review') {
      results.conflicts.push({ providerGameId: pg.externalGameId, masterGameId: result.masterGameId })
      results.auditPayloads.push({
        entity: 'master_games',
        entity_id: result.masterGameId,
        payload: result.auditPayload,
      })
    }
  }

  return {
    dry_run: false,
    provider,
    statistics: {
      total_candidates: providerGames.length,
      mapped: results.mapped.length,
      ambiguous: results.ambiguous.length,
      unmatched: results.unmatched.length,
      skipped: results.skipped.length,
      conflicts: results.conflicts.length,
      propagation_updates: results.propagationUpdates.length,
    },
    results,
  }
}
