import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  ROLLBACK_RESULT,
  checkFieldRollback,
  evaluateMasterGameRollback,
  evaluatePropagationRollback,
  buildMasterGameRestorePayload,
  buildLeagueGamesRestorePayload,
} from '../src/domains/sports/reconciliation/rollback.js'

// ── FIELD ROLLBACK CHECK ───────────────────────────────────────────────────────

describe('checkFieldRollback', () => {
  it('can restore when current matches after', () => {
    const result = checkFieldRollback(24, 24, 21)
    assert.strictEqual(result.canRestore, true)
    assert.strictEqual(result.result, ROLLBACK_RESULT.APPLIED)
  })

  it('already rolled back when current matches before', () => {
    const result = checkFieldRollback(21, 24, 21)
    assert.strictEqual(result.canRestore, false)
    assert.strictEqual(result.result, ROLLBACK_RESULT.ALREADY_ROLLED_BACK)
  })

  it('conflict when current differs from after', () => {
    const result = checkFieldRollback(28, 24, 21)
    assert.strictEqual(result.canRestore, false)
    assert.strictEqual(result.result, ROLLBACK_RESULT.CONFLICT)
  })

  it('handles null values', () => {
    const result = checkFieldRollback(null, null, 'KC')
    assert.strictEqual(result.canRestore, true)
    assert.strictEqual(result.result, ROLLBACK_RESULT.APPLIED)
  })

  it('handles null current vs non-null after (conflict)', () => {
    // Current is null, after was 24, before was 10
    // Current doesn't match after (24) and doesn't match before (10)
    const result = checkFieldRollback(null, 24, 10)
    assert.strictEqual(result.canRestore, false)
    assert.strictEqual(result.result, ROLLBACK_RESULT.CONFLICT)
  })
})

// ── MASTER GAME ROLLBACK EVALUATION ────────────────────────────────────────────

describe('evaluateMasterGameRollback', () => {
  it('can rollback when all fields match after state', () => {
    const current = {
      id: 'mg-1', provider: 'api-sports', external_game_id: '12345',
      mapping_status: 'mapped', mapping_confidence: 'high',
      home_score: 24, away_score: 17, result: 'KC', finished: true,
    }
    const before = {
      provider: null, external_game_id: null,
      mapping_status: 'unmapped', mapping_confidence: null,
      home_score: null, away_score: null, result: null, finished: false,
    }
    const after = {
      provider: 'api-sports', external_game_id: '12345',
      mapping_status: 'mapped', mapping_confidence: 'high',
      home_score: 24, away_score: 17, result: 'KC', finished: true,
    }

    const result = evaluateMasterGameRollback(current, before, after)
    assert.strictEqual(result.canRollback, true)
    assert.strictEqual(result.conflicts.length, 0)
    assert.ok(Object.keys(result.restorableFields).length > 0)
  })

  it('detects conflict when current differs from after', () => {
    const current = {
      id: 'mg-1', provider: 'api-sports', external_game_id: '12345',
      mapping_status: 'mapped', mapping_confidence: 'high',
      home_score: 28, away_score: 17, result: 'KC', finished: true,
    }
    const before = {
      provider: null, external_game_id: null,
      mapping_status: 'unmapped', mapping_confidence: null,
      home_score: null, away_score: null, result: null, finished: false,
    }
    const after = {
      provider: 'api-sports', external_game_id: '12345',
      mapping_status: 'mapped', mapping_confidence: 'high',
      home_score: 24, away_score: 17, result: 'KC', finished: true,
    }

    const result = evaluateMasterGameRollback(current, before, after)
    assert.strictEqual(result.canRollback, false)
    assert.strictEqual(result.conflicts.length, 1)
    assert.strictEqual(result.conflicts[0].field, 'home_score')
    assert.strictEqual(result.conflicts[0].current_value, 28)
    assert.strictEqual(result.conflicts[0].recorded_after_value, 24)
  })

  it('detects already rolled back fields', () => {
    const current = {
      id: 'mg-1', provider: null, external_game_id: null,
      mapping_status: 'unmapped', mapping_confidence: null,
      home_score: null, away_score: null, result: null, finished: false,
    }
    const before = {
      provider: null, external_game_id: null,
      mapping_status: 'unmapped', mapping_confidence: null,
      home_score: null, away_score: null, result: null, finished: false,
    }
    const after = {
      provider: 'api-sports', external_game_id: '12345',
      mapping_status: 'mapped', mapping_confidence: 'high',
      home_score: 24, away_score: 17, result: 'KC', finished: true,
    }

    const result = evaluateMasterGameRollback(current, before, after)
    assert.ok(Object.keys(result.alreadyRestoredFields).length > 0)
  })
})

// ── PROPAGATION ROLLBACK EVALUATION ────────────────────────────────────────────

describe('evaluatePropagationRollback', () => {
  it('can rollback league_games when current matches after', () => {
    const currentLg = [
      { id: 'lg-1', home_score: 24, away_score: 17, result: 'KC', finished: true, game_time: '2026-09-10T20:20:00-05:00' },
    ]
    const changes = {
      changes: [
        {
          league_game_id: 'lg-1',
          before: { home_score: null, away_score: null, result: null, finished: false, game_time: '2026-09-10T20:20:00-05:00' },
          after: { home_score: 24, away_score: 17, result: 'KC', finished: true, game_time: '2026-09-10T20:20:00-05:00' },
        },
      ],
    }

    const result = evaluatePropagationRollback(currentLg, changes)
    assert.strictEqual(result.canRollback, true)
    assert.strictEqual(result.conflicts.length, 0)
    assert.ok(result.restorable.length > 0)
  })

  it('detects conflict when league_game was modified after propagation', () => {
    const currentLg = [
      { id: 'lg-1', home_score: 28, away_score: 17, result: 'KC', finished: true, game_time: '2026-09-10T20:20:00-05:00' },
    ]
    const changes = {
      changes: [
        {
          league_game_id: 'lg-1',
          before: { home_score: null, away_score: null, result: null, finished: false, game_time: '2026-09-10T20:20:00-05:00' },
          after: { home_score: 24, away_score: 17, result: 'KC', finished: true, game_time: '2026-09-10T20:20:00-05:00' },
        },
      ],
    }

    const result = evaluatePropagationRollback(currentLg, changes)
    assert.strictEqual(result.canRollback, false)
    assert.strictEqual(result.conflicts.length, 1)
    assert.strictEqual(result.conflicts[0].field, 'home_score')
  })

  it('handles missing league_game', () => {
    const currentLg = []
    const changes = {
      changes: [
        {
          league_game_id: 'lg-1',
          before: { home_score: null },
          after: { home_score: 24 },
        },
      ],
    }

    const result = evaluatePropagationRollback(currentLg, changes)
    assert.strictEqual(result.canRollback, false)
    assert.strictEqual(result.conflicts[0].reason, 'league_game_not_found')
  })

  it('handles null propagation changes', () => {
    const result = evaluatePropagationRollback([], null)
    assert.strictEqual(result.canRollback, true)
    assert.strictEqual(result.conflicts.length, 0)
  })
})

// ── RESTORE PAYLOAD BUILDERS ───────────────────────────────────────────────────

describe('Restore Payload Builders', () => {
  it('builds master_game restore payload', () => {
    const evaluation = {
      restorableFields: {
        provider: { before_value: null },
        home_score: { before_value: null },
        mapping_status: { before_value: 'unmapped' },
      },
    }

    const payload = buildMasterGameRestorePayload(evaluation)
    assert.strictEqual(payload.provider, null)
    assert.strictEqual(payload.home_score, null)
    assert.strictEqual(payload.mapping_status, 'unmapped')
  })

  it('builds league_games restore payload grouped by id', () => {
    const evaluation = {
      restorable: [
        { league_game_id: 'lg-1', field: 'home_score', before_value: null },
        { league_game_id: 'lg-1', field: 'away_score', before_value: null },
        { league_game_id: 'lg-2', field: 'home_score', before_value: null },
      ],
    }

    const payload = buildLeagueGamesRestorePayload(evaluation)
    assert.ok(payload['lg-1'])
    assert.ok(payload['lg-2'])
    assert.strictEqual(payload['lg-1'].home_score, null)
    assert.strictEqual(payload['lg-1'].away_score, null)
    assert.strictEqual(payload['lg-2'].home_score, null)
  })
})

// ── IDEMPOTENT ROLLBACK ────────────────────────────────────────────────────────

describe('Idempotent Rollback', () => {
  it('second rollback detects already restored state', () => {
    const before = { provider: null, home_score: null, mapping_status: 'unmapped' }
    const after = { provider: 'api-sports', home_score: 24, mapping_status: 'mapped' }

    const current = { id: 'mg-1', ...before }

    const result = evaluateMasterGameRollback(current, before, after)
    assert.ok(Object.keys(result.alreadyRestoredFields).length > 0)
    assert.strictEqual(Object.keys(result.restorableFields).length, 0)
  })
})
