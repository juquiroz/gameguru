import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  PROVIDER_OWNED_FIELDS,
  LEAGUE_OWNED_FIELDS,
  isEligibleForPropagation,
  buildPropagationPayload,
  shouldPropagate,
  calculatePropagation,
} from '../src/domains/sports/reconciliation/propagation.js'

function makeMasterGame(overrides = {}) {
  return {
    id: 'mg-1',
    mapping_status: 'mapped',
    home_score: 24,
    away_score: 17,
    result: 'KC',
    finished: true,
    game_time: '2026-09-10T20:20:00-05:00',
    ...overrides,
  }
}

function makeLeagueGame(overrides = {}) {
  return {
    id: 'lg-1',
    master_game_id: 'mg-1',
    training_session_id: null,
    home_score: null,
    away_score: null,
    result: null,
    finished: false,
    game_time: '2026-09-10T20:20:00-05:00',
    active: true,
    ...overrides,
  }
}

// ── FIELD OWNERSHIP ────────────────────────────────────────────────────────────

describe('Field Ownership', () => {
  it('defines provider-owned fields', () => {
    assert.ok(PROVIDER_OWNED_FIELDS.includes('home_score'))
    assert.ok(PROVIDER_OWNED_FIELDS.includes('away_score'))
    assert.ok(PROVIDER_OWNED_FIELDS.includes('result'))
    assert.ok(PROVIDER_OWNED_FIELDS.includes('finished'))
    assert.ok(PROVIDER_OWNED_FIELDS.includes('game_time'))
  })

  it('defines league-owned fields', () => {
    assert.ok(LEAGUE_OWNED_FIELDS.includes('active'))
    assert.ok(LEAGUE_OWNED_FIELDS.includes('training_session_id'))
    assert.ok(LEAGUE_OWNED_FIELDS.includes('league_id'))
    assert.ok(LEAGUE_OWNED_FIELDS.includes('master_game_id'))
  })

  it('provider and league fields do not overlap', () => {
    const overlap = PROVIDER_OWNED_FIELDS.filter(f => LEAGUE_OWNED_FIELDS.includes(f))
    assert.strictEqual(overlap.length, 0)
  })
})

// ── ELIGIBILITY ────────────────────────────────────────────────────────────────

describe('Propagation Eligibility', () => {
  it('official league game is eligible', () => {
    const lg = makeLeagueGame({ training_session_id: null })
    assert.strictEqual(isEligibleForPropagation(lg), true)
  })

  it('simulation game is not eligible', () => {
    const lg = makeLeagueGame({ training_session_id: 'ts-1' })
    assert.strictEqual(isEligibleForPropagation(lg), false)
  })

  it('game without master_game_id is not eligible', () => {
    const lg = makeLeagueGame({ master_game_id: null })
    assert.strictEqual(isEligibleForPropagation(lg), false)
  })
})

// ── PROPAGATION PAYLOAD ────────────────────────────────────────────────────────

describe('Propagation Payload', () => {
  it('builds payload when scores differ', () => {
    const mg = makeMasterGame({ home_score: 24, away_score: 17 })
    const lg = makeLeagueGame({ home_score: null, away_score: null })

    const payload = buildPropagationPayload(mg, lg)
    assert.ok(payload)
    assert.strictEqual(payload.home_score, 24)
    assert.strictEqual(payload.away_score, 17)
  })

  it('returns null when no changes', () => {
    const mg = makeMasterGame({ home_score: 24, away_score: 17, result: 'KC', finished: true })
    const lg = makeLeagueGame({ home_score: 24, away_score: 17, result: 'KC', finished: true })

    const payload = buildPropagationPayload(mg, lg)
    assert.strictEqual(payload, null)
  })

  it('does not propagate for unmapped master_game', () => {
    const mg = makeMasterGame({ mapping_status: 'unmapped' })
    const lg = makeLeagueGame()

    const payload = buildPropagationPayload(mg, lg)
    assert.strictEqual(payload, null)
  })

  it('propagates for manual_override master_game', () => {
    const mg = makeMasterGame({ mapping_status: 'manual_override', home_score: 24 })
    const lg = makeLeagueGame({ home_score: null })

    const payload = buildPropagationPayload(mg, lg)
    assert.ok(payload)
    assert.strictEqual(payload.home_score, 24)
  })

  it('does not include league-owned fields', () => {
    const mg = makeMasterGame({ home_score: 24 })
    const lg = makeLeagueGame({ home_score: null, active: true })

    const payload = buildPropagationPayload(mg, lg)
    assert.ok(payload)
    assert.strictEqual(payload.active, undefined)
    assert.strictEqual(payload.training_session_id, undefined)
  })
})

// ── SHOULD PROPAGATE ───────────────────────────────────────────────────────────

describe('Should Propagate', () => {
  it('propagates for mapped', () => {
    const mg = makeMasterGame({ mapping_status: 'mapped' })
    const result = shouldPropagate(mg)
    assert.strictEqual(result.shouldPropagate, true)
  })

  it('propagates for manual_override', () => {
    const mg = makeMasterGame({ mapping_status: 'manual_override' })
    const result = shouldPropagate(mg)
    assert.strictEqual(result.shouldPropagate, true)
  })

  it('does not propagate for unmapped', () => {
    const mg = makeMasterGame({ mapping_status: 'unmapped' })
    const result = shouldPropagate(mg)
    assert.strictEqual(result.shouldPropagate, false)
  })

  it('does not propagate for ambiguous', () => {
    const mg = makeMasterGame({ mapping_status: 'ambiguous' })
    const result = shouldPropagate(mg)
    assert.strictEqual(result.shouldPropagate, false)
  })
})

// ── CALCULATE PROPAGATION ──────────────────────────────────────────────────────

describe('Calculate Propagation', () => {
  it('calculates updates for eligible games', () => {
    const mg = makeMasterGame({ home_score: 24, away_score: 17 })
    const leagueGames = [
      makeLeagueGame({ id: 'lg-1', home_score: null, away_score: null }),
      makeLeagueGame({ id: 'lg-2', home_score: null, away_score: null }),
    ]

    const result = calculatePropagation(mg, leagueGames)
    assert.strictEqual(result.updates.length, 2)
    assert.strictEqual(result.updates[0].leagueGameId, 'lg-1')
    assert.strictEqual(result.updates[1].leagueGameId, 'lg-2')
  })

  it('skips simulation games', () => {
    const mg = makeMasterGame({ home_score: 24 })
    const leagueGames = [
      makeLeagueGame({ id: 'lg-1', training_session_id: null }),
      makeLeagueGame({ id: 'lg-2', training_session_id: 'ts-1' }),
    ]

    const result = calculatePropagation(mg, leagueGames)
    assert.strictEqual(result.updates.length, 1)
    assert.strictEqual(result.skipped.length, 1)
    assert.strictEqual(result.skipped[0].reason, 'simulation_game')
  })

  it('records before/after state', () => {
    const mg = makeMasterGame({ home_score: 24, away_score: 17, result: 'KC', finished: true })
    const leagueGames = [
      makeLeagueGame({ id: 'lg-1', home_score: null, away_score: null, result: null, finished: false }),
    ]

    const result = calculatePropagation(mg, leagueGames)
    assert.strictEqual(result.updates.length, 1)
    assert.strictEqual(result.updates[0].before.home_score, null)
    assert.strictEqual(result.updates[0].after.home_score, 24)
  })

  it('reports no changes when values match', () => {
    const mg = makeMasterGame({ home_score: 24, away_score: 17, result: 'KC', finished: true })
    const leagueGames = [
      makeLeagueGame({ id: 'lg-1', home_score: 24, away_score: 17, result: 'KC', finished: true }),
    ]

    const result = calculatePropagation(mg, leagueGames)
    assert.strictEqual(result.updates.length, 0)
    assert.strictEqual(result.noChanges.length, 1)
  })
})
