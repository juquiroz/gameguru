import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
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
} from '../src/domains/sports/reconciliation/audit.js'

function makeMasterGame(overrides = {}) {
  return {
    id: 'mg-1',
    provider: 'api-sports',
    external_game_id: '12345',
    external_competition_id: '1-2026',
    mapping_status: 'mapped',
    mapping_confidence: 'high',
    reconciliation_source: 'api-sports',
    game_time: '2026-09-10T20:20:00-05:00',
    home_score: 24,
    away_score: 17,
    result: 'KC',
    finished: true,
    home_abbr: 'KC',
    away_abbr: 'BUF',
    week: 1,
    phase: 'regular',
    season: '2026',
    mapped_at: '2026-09-10T22:00:00Z',
    mapped_by: null,
    ...overrides,
  }
}

// ── AUDIT ACTIONS ──────────────────────────────────────────────────────────────

describe('Audit Actions', () => {
  it('defines all required actions', () => {
    assert.strictEqual(AUDIT_ACTIONS.AUTO_MAP, 'reconciliation_auto_map')
    assert.strictEqual(AUDIT_ACTIONS.AMBIGUOUS, 'reconciliation_ambiguous')
    assert.strictEqual(AUDIT_ACTIONS.UNMATCHED, 'reconciliation_unmatched')
    assert.strictEqual(AUDIT_ACTIONS.SKIPPED, 'reconciliation_skipped')
    assert.strictEqual(AUDIT_ACTIONS.MANUAL_OVERRIDE, 'manual_override')
    assert.strictEqual(AUDIT_ACTIONS.MANUAL_REVERT, 'manual_revert')
    assert.strictEqual(AUDIT_ACTIONS.ROLLBACK_CONFLICT, 'rollback_conflict')
    assert.strictEqual(AUDIT_ACTIONS.ROLLBACK_APPLIED, 'rollback_applied')
  })
})

// ── SNAPSHOT ───────────────────────────────────────────────────────────────────

describe('Master Game Snapshot', () => {
  it('captures all relevant fields', () => {
    const mg = makeMasterGame()
    const snapshot = snapshotMasterGame(mg)

    assert.strictEqual(snapshot.id, 'mg-1')
    assert.strictEqual(snapshot.provider, 'api-sports')
    assert.strictEqual(snapshot.external_game_id, '12345')
    assert.strictEqual(snapshot.mapping_status, 'mapped')
    assert.strictEqual(snapshot.mapping_confidence, 'high')
    assert.strictEqual(snapshot.home_score, 24)
    assert.strictEqual(snapshot.away_score, 17)
    assert.strictEqual(snapshot.result, 'KC')
    assert.strictEqual(snapshot.finished, true)
    assert.strictEqual(snapshot.game_time, '2026-09-10T20:20:00-05:00')
  })

  it('returns null for null input', () => {
    assert.strictEqual(snapshotMasterGame(null), null)
  })

  it('handles missing fields gracefully', () => {
    const snapshot = snapshotMasterGame({ id: 'mg-1' })
    assert.strictEqual(snapshot.id, 'mg-1')
    assert.strictEqual(snapshot.provider, null)
    assert.strictEqual(snapshot.home_score, null)
  })
})

// ── AUTO MAP PAYLOAD ───────────────────────────────────────────────────────────

describe('Auto Map Payload', () => {
  it('builds correct payload structure', () => {
    const before = makeMasterGame({ provider: null, mapping_status: 'unmapped' })
    const after = makeMasterGame({ provider: 'api-sports', mapping_status: 'mapped' })

    const payload = buildAutoMapPayload({
      before,
      after,
      provider: 'api-sports',
      externalGameId: '12345',
      matchResult: { reason: 'team_week_time', confidence: 'high' },
      propagationResult: null,
      actor: 'user-1',
    })

    assert.strictEqual(payload.action, 'reconciliation_auto_map')
    assert.strictEqual(payload.provider, 'api-sports')
    assert.strictEqual(payload.external_game_id, '12345')
    assert.strictEqual(payload.actor, 'user-1')
    assert.strictEqual(payload.confidence, 'high')
    assert.strictEqual(payload.mapping_status_before, 'unmapped')
    assert.strictEqual(payload.mapping_status_after, 'mapped')
    assert.strictEqual(payload.provider_before, null)
    assert.strictEqual(payload.provider_after, 'api-sports')
    assert.ok(payload.before_state)
    assert.ok(payload.after_state)
    assert.ok(payload.timestamp)
  })
})

// ── AMBIGUOUS PAYLOAD ──────────────────────────────────────────────────────────

describe('Ambiguous Payload', () => {
  it('includes candidate details', () => {
    const pg = { externalGameId: '12345', homeTeamAbbr: 'KC', awayTeamAbbr: 'BUF', gameTime: '2026-09-10T20:20:00-05:00' }
    const candidates = [
      { id: 'mg-1', home_abbr: 'KC', away_abbr: 'BUF', game_time: '2026-09-10T20:20:00-05:00', week: 1, phase: 'regular', mapping_status: 'unmapped' },
      { id: 'mg-2', home_abbr: 'KC', away_abbr: 'BUF', game_time: '2026-09-10T21:00:00-05:00', week: 1, phase: 'regular', mapping_status: 'unmapped' },
    ]

    const payload = buildAmbiguousPayload({ providerGame: pg, candidates, provider: 'api-sports', actor: 'system' })

    assert.strictEqual(payload.action, 'reconciliation_ambiguous')
    assert.strictEqual(payload.candidates.length, 2)
    assert.ok(payload.provider_game)
  })
})

// ── UNMATCHED PAYLOAD ──────────────────────────────────────────────────────────

describe('Unmatched Payload', () => {
  it('includes provider game details', () => {
    const pg = { externalGameId: '12345', homeTeamAbbr: 'KC', awayTeamAbbr: 'BUF', gameTime: '2026-09-10T20:20:00-05:00', week: 1, phase: 'regular' }

    const payload = buildUnmatchedPayload({ providerGame: pg, provider: 'api-sports', actor: 'system' })

    assert.strictEqual(payload.action, 'reconciliation_unmatched')
    assert.strictEqual(payload.reason, 'no_candidate')
    assert.ok(payload.provider_game)
  })
})

// ── SKIPPED PAYLOAD ────────────────────────────────────────────────────────────

describe('Skipped Payload', () => {
  it('includes reason and before state', () => {
    const mg = makeMasterGame()

    const payload = buildSkippedPayload({
      masterGame: mg,
      provider: 'api-sports',
      externalGameId: '12345',
      reason: 'manual_override_protected',
      actor: 'system',
    })

    assert.strictEqual(payload.action, 'reconciliation_skipped')
    assert.strictEqual(payload.reason, 'manual_override_protected')
    assert.ok(payload.before_state)
  })
})

// ── MANUAL OVERRIDE PAYLOAD ────────────────────────────────────────────────────

describe('Manual Override Payload', () => {
  it('captures before/after state', () => {
    const before = makeMasterGame({ mapping_status: 'mapped', mapping_confidence: 'high' })
    const after = makeMasterGame({ mapping_status: 'manual_override', mapping_confidence: 'manual' })

    const payload = buildManualOverridePayload({ before, after, actor: 'user-1', reason: 'admin_set' })

    assert.strictEqual(payload.action, 'manual_override')
    assert.strictEqual(payload.mapping_status_before, 'mapped')
    assert.strictEqual(payload.mapping_status_after, 'manual_override')
    assert.strictEqual(payload.confidence, 'manual')
  })
})

// ── MANUAL REVERT PAYLOAD ──────────────────────────────────────────────────────

describe('Manual Revert Payload', () => {
  it('captures before/after state', () => {
    const before = makeMasterGame({ mapping_status: 'manual_override', mapping_confidence: 'manual' })
    const after = makeMasterGame({ mapping_status: 'mapped', mapping_confidence: 'high' })

    const payload = buildManualRevertPayload({ before, after, actor: 'user-1', reason: 'admin_revert' })

    assert.strictEqual(payload.action, 'manual_revert')
    assert.strictEqual(payload.mapping_status_before, 'manual_override')
    assert.strictEqual(payload.mapping_status_after, 'mapped')
  })
})

// ── ROLLBACK CONFLICT PAYLOAD ──────────────────────────────────────────────────

describe('Rollback Conflict Payload', () => {
  it('captures conflict details', () => {
    const mg = makeMasterGame()
    const auditRecord = { id: 'audit-1', field: 'home_score', before_value: 21 }

    const payload = buildRollbackConflictPayload({
      masterGame: mg,
      auditRecord,
      currentValue: 28,
      afterValue: 24,
      actor: 'user-1',
    })

    assert.strictEqual(payload.action, 'rollback_conflict')
    assert.strictEqual(payload.reason, 'current_value_differs_from_after')
    assert.strictEqual(payload.conflict_details.current_value, 28)
    assert.strictEqual(payload.conflict_details.recorded_after_value, 24)
    assert.strictEqual(payload.conflict_details.recorded_before_value, 21)
  })
})

// ── ROLLBACK APPLIED PAYLOAD ───────────────────────────────────────────────────

describe('Rollback Applied Payload', () => {
  it('captures before/after state', () => {
    const before = makeMasterGame({ home_score: 28 })
    const after = makeMasterGame({ home_score: 21 })
    const auditRecord = { id: 'audit-1' }

    const payload = buildRollbackAppliedPayload({ before, after, auditRecord, actor: 'user-1' })

    assert.strictEqual(payload.action, 'rollback_applied')
    assert.strictEqual(payload.original_audit_id, 'audit-1')
    assert.ok(payload.before_state)
    assert.ok(payload.after_state)
  })
})

// ── NO SECRETS ─────────────────────────────────────────────────────────────────

describe('Security', () => {
  it('payloads do not contain secrets', () => {
    const mg = makeMasterGame()
    const snapshot = snapshotMasterGame(mg)
    const json = JSON.stringify(snapshot)

    assert.ok(!json.includes('API_SPORTS_API_KEY'))
    assert.ok(!json.includes('service_role'))
    assert.ok(!json.includes('SUPABASE'))
    assert.ok(!json.includes('password'))
    assert.ok(!json.includes('secret'))
  })
})
