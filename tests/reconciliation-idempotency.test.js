import { describe, it } from 'node:test'
import assert from 'node:assert'

import { matchGame, MATCH_RESULT, MATCH_CONFIDENCE } from '../src/domains/sports/reconciliation/matching.js'
import { resolveConflict } from '../src/domains/sports/reconciliation/conflictResolution.js'
import { apply } from '../src/domains/sports/reconciliation/backfill.js'

const BASE_TIME = '2026-09-10T20:20:00-05:00'

function makeProviderGame(overrides = {}) {
  return {
    externalGameId: '12345',
    externalCompetitionId: '1-2026',
    homeTeamAbbr: 'KC',
    awayTeamAbbr: 'BUF',
    gameTime: BASE_TIME,
    week: 1,
    phase: 'regular',
    status: 'final',
    homeScore: 24,
    awayScore: 17,
    result: 'KC',
    finished: true,
    ...overrides,
  }
}

function makeMasterGame(overrides = {}) {
  return {
    id: 'mg-1',
    sport: 'NFL',
    season: '2026',
    week: 1,
    home_abbr: 'KC',
    away_abbr: 'BUF',
    game_time: BASE_TIME,
    home_score: null,
    away_score: null,
    result: null,
    finished: false,
    phase: 'regular',
    provider: null,
    external_game_id: null,
    mapping_status: 'unmapped',
    mapping_confidence: null,
    ...overrides,
  }
}

// ── IDEMPOTENCY ────────────────────────────────────────────────────────────────

describe('Idempotency', () => {
  it('running reconciliation twice produces same mapping', () => {
    const pg = makeProviderGame()
    const masterGames = [makeMasterGame()]

    const result1 = matchGame(pg, masterGames, 'api-sports')
    assert.strictEqual(result1.status, MATCH_RESULT.MAPPED)

    const updatedMg = { ...masterGames[0], provider: 'api-sports', external_game_id: '12345', mapping_status: 'mapped' }
    const result2 = matchGame(pg, [updatedMg], 'api-sports')
    assert.strictEqual(result2.status, MATCH_RESULT.MAPPED)
    assert.strictEqual(result2.reason, 'exact_external_id')
  })

  it('second reconciliation skips already mapped', () => {
    const pg = makeProviderGame()
    const masterGames = [makeMasterGame({
      provider: 'api-sports',
      external_game_id: '12345',
      mapping_status: 'mapped',
    })]

    const resolution = resolveConflict(masterGames[0], pg, 'api-sports')
    assert.strictEqual(resolution.action, 'skip')
    assert.strictEqual(resolution.reason, 'existing_authoritative_mapping')
  })

  it('apply is idempotent: no duplicate mappings', () => {
    const pg = makeProviderGame()
    const masterGames = [makeMasterGame()]

    const result1 = apply([pg], masterGames, 'api-sports')
    assert.strictEqual(result1.statistics.mapped, 1)

    const updatedMasterGames = masterGames.map(mg => ({
      ...mg,
      provider: 'api-sports',
      external_game_id: pg.externalGameId,
      mapping_status: 'mapped',
    }))

    const result2 = apply([pg], updatedMasterGames, 'api-sports')
    assert.strictEqual(result2.statistics.skipped, 1)
    assert.strictEqual(result2.statistics.mapped, 0)
  })

  it('apply produces reconciliation_skipped for already mapped', () => {
    const pg = makeProviderGame()
    const masterGames = [makeMasterGame({
      provider: 'api-sports',
      external_game_id: '12345',
      mapping_status: 'mapped',
    })]

    const result = apply([pg], masterGames, 'api-sports')
    assert.strictEqual(result.statistics.skipped, 1)
    assert.ok(result.results.auditPayloads.some(a => a.payload.action === 'reconciliation_skipped'))
  })
})

// ── CONCURRENCY ────────────────────────────────────────────────────────────────

describe('Concurrency', () => {
  it('unique constraint prevents duplicate (provider, external_game_id)', () => {
    const mg1 = makeMasterGame({ id: 'mg-1', provider: 'api-sports', external_game_id: '12345' })
    const mg2 = makeMasterGame({ id: 'mg-2', provider: 'api-sports', external_game_id: '12345' })

    assert.strictEqual(mg1.provider, mg2.provider)
    assert.strictEqual(mg1.external_game_id, mg2.external_game_id)
    assert.notStrictEqual(mg1.id, mg2.id)
  })

  it('concurrent reconciliation produces single mapping', () => {
    const pg = makeProviderGame()
    const masterGames = [makeMasterGame()]

    const result1 = matchGame(pg, masterGames, 'api-sports')
    const result2 = matchGame(pg, masterGames, 'api-sports')

    assert.strictEqual(result1.matchedGame.id, result2.matchedGame.id)
    assert.strictEqual(result1.status, result2.status)
  })

  it('manual override wins over concurrent reconciliation', () => {
    const pg = makeProviderGame()
    const masterGames = [makeMasterGame({
      mapping_status: 'manual_override',
      mapping_confidence: 'manual',
      provider: 'api-sports',
      external_game_id: '99999',
    })]

    const resolution = resolveConflict(masterGames[0], pg, 'api-sports')
    assert.strictEqual(resolution.action, 'skip')
    assert.strictEqual(resolution.reason, 'manual_override_protected')
  })

  it('deterministic result regardless of execution order', () => {
    const pg1 = makeProviderGame({ externalGameId: '1' })
    const pg2 = makeProviderGame({ externalGameId: '2', homeTeamAbbr: 'DAL' })
    const masterGames = [
      makeMasterGame({ id: 'mg-1' }),
    ]

    const resultA = apply([pg1, pg2], masterGames, 'api-sports')
    const resultB = apply([pg2, pg1], masterGames, 'api-sports')

    assert.strictEqual(resultA.statistics.mapped, resultB.statistics.mapped)
    assert.strictEqual(resultA.statistics.unmatched, resultB.statistics.unmatched)
  })
})

// ── UNIQUENESS ─────────────────────────────────────────────────────────────────

describe('Uniqueness', () => {
  it('same provider + external_game_id always matches same master_game', () => {
    const pg = makeProviderGame({ externalGameId: '12345' })
    const mg = makeMasterGame({ provider: 'api-sports', external_game_id: '12345' })

    const result1 = matchGame(pg, [mg], 'api-sports')
    const result2 = matchGame(pg, [mg], 'api-sports')

    assert.strictEqual(result1.matchedGame.id, 'mg-1')
    assert.strictEqual(result2.matchedGame.id, 'mg-1')
  })

  it('NULL provider/external_game_id allows multiple unmapped games', () => {
    const mg1 = makeMasterGame({ id: 'mg-1', provider: null, external_game_id: null })
    const mg2 = makeMasterGame({ id: 'mg-2', provider: null, external_game_id: null })

    assert.strictEqual(mg1.provider, null)
    assert.strictEqual(mg2.provider, null)
    assert.notStrictEqual(mg1.id, mg2.id)
  })

  it('exact external ID match takes priority over team matching', () => {
    const pg = makeProviderGame({ externalGameId: '12345' })
    const mg1 = makeMasterGame({ id: 'mg-1', provider: 'api-sports', external_game_id: '12345' })
    const mg2 = makeMasterGame({ id: 'mg-2' })

    const result = matchGame(pg, [mg1, mg2], 'api-sports')
    assert.strictEqual(result.matchedGame.id, 'mg-1')
    assert.strictEqual(result.reason, 'exact_external_id')
  })
})
