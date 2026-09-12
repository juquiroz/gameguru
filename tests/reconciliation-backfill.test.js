import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  dryRun,
  reconcileSingle,
  apply,
} from '../src/domains/sports/reconciliation/backfill.js'

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

// ── DRY RUN ────────────────────────────────────────────────────────────────────

describe('Dry Run', () => {
  it('returns statistics without modifying data', () => {
    const providerGames = [makeProviderGame()]
    const masterGames = [makeMasterGame()]

    const result = dryRun(providerGames, masterGames, 'api-sports')

    assert.strictEqual(result.dry_run, true)
    assert.strictEqual(result.statistics.total_candidates, 1)
    assert.ok(result.statistics.high_confidence_matches >= 0)
    assert.ok(result.details)
    assert.strictEqual(result.details.length, 1)
  })

  it('counts high confidence matches', () => {
    const providerGames = [makeProviderGame()]
    const masterGames = [makeMasterGame()]

    const result = dryRun(providerGames, masterGames, 'api-sports')
    assert.strictEqual(result.statistics.high_confidence_matches, 1)
  })

  it('counts ambiguous matches', () => {
    const providerGames = [makeProviderGame()]
    const masterGames = [makeMasterGame({ id: 'mg-1' }), makeMasterGame({ id: 'mg-2' })]

    const result = dryRun(providerGames, masterGames, 'api-sports')
    assert.strictEqual(result.statistics.ambiguous, 1)
  })

  it('counts unmatched', () => {
    const providerGames = [makeProviderGame({ homeTeamAbbr: 'DAL' })]
    const masterGames = [makeMasterGame()]

    const result = dryRun(providerGames, masterGames, 'api-sports')
    assert.strictEqual(result.statistics.unmatched, 1)
  })

  it('counts manual overrides', () => {
    const providerGames = [makeProviderGame()]
    const masterGames = [makeMasterGame({ mapping_status: 'manual_override', mapping_confidence: 'manual' })]

    const result = dryRun(providerGames, masterGames, 'api-sports')
    assert.strictEqual(result.statistics.manual_overrides, 1)
  })

  it('counts skipped already mapped', () => {
    const providerGames = [makeProviderGame({ externalGameId: '12345' })]
    const masterGames = [makeMasterGame({
      provider: 'api-sports',
      external_game_id: '12345',
      mapping_status: 'mapped',
    })]

    const result = dryRun(providerGames, masterGames, 'api-sports')
    assert.strictEqual(result.statistics.skipped_already_mapped, 1)
  })

  it('does not modify input arrays', () => {
    const providerGames = [makeProviderGame()]
    const masterGames = [makeMasterGame()]
    const pgBefore = JSON.stringify(providerGames)
    const mgBefore = JSON.stringify(masterGames)

    dryRun(providerGames, masterGames, 'api-sports')

    assert.strictEqual(JSON.stringify(providerGames), pgBefore)
    assert.strictEqual(JSON.stringify(masterGames), mgBefore)
  })

  it('handles multiple provider games', () => {
    const providerGames = [
      makeProviderGame({ externalGameId: '1', homeTeamAbbr: 'KC' }),
      makeProviderGame({ externalGameId: '2', homeTeamAbbr: 'DAL' }),
      makeProviderGame({ externalGameId: '3', homeTeamAbbr: 'NE' }),
    ]
    const masterGames = [
      makeMasterGame({ id: 'mg-1', home_abbr: 'KC' }),
    ]

    const result = dryRun(providerGames, masterGames, 'api-sports')
    assert.strictEqual(result.statistics.total_candidates, 3)
    assert.strictEqual(result.details.length, 3)
  })
})

// ── RECONCILE SINGLE ───────────────────────────────────────────────────────────

describe('reconcileSingle', () => {
  it('returns mapped action for valid match', () => {
    const pg = makeProviderGame()
    const masterGames = [makeMasterGame()]

    const result = reconcileSingle(pg, masterGames, 'api-sports')
    assert.strictEqual(result.action, 'mapped')
    assert.ok(result.before)
    assert.ok(result.after)
    assert.strictEqual(result.after.provider, 'api-sports')
    assert.strictEqual(result.after.external_game_id, '12345')
    assert.strictEqual(result.after.mapping_status, 'mapped')
  })

  it('returns unmatched action for no match', () => {
    const pg = makeProviderGame({ homeTeamAbbr: 'DAL' })
    const masterGames = [makeMasterGame()]

    const result = reconcileSingle(pg, masterGames, 'api-sports')
    assert.strictEqual(result.action, 'unmatched')
    assert.ok(result.auditPayload)
  })

  it('returns ambiguous action for multiple matches', () => {
    const pg = makeProviderGame()
    const masterGames = [makeMasterGame({ id: 'mg-1' }), makeMasterGame({ id: 'mg-2' })]

    const result = reconcileSingle(pg, masterGames, 'api-sports')
    assert.strictEqual(result.action, 'ambiguous')
    assert.ok(result.auditPayload)
  })

  it('returns skipped action for manual override', () => {
    const pg = makeProviderGame()
    const masterGames = [makeMasterGame({ mapping_status: 'manual_override' })]

    const result = reconcileSingle(pg, masterGames, 'api-sports')
    assert.strictEqual(result.action, 'skipped')
  })

  it('returns skipped action for existing mapping', () => {
    const pg = makeProviderGame({ externalGameId: '12345' })
    const masterGames = [makeMasterGame({
      provider: 'api-sports',
      external_game_id: '12345',
      mapping_status: 'mapped',
    })]

    const result = reconcileSingle(pg, masterGames, 'api-sports')
    assert.strictEqual(result.action, 'skipped')
  })
})

// ── APPLY ──────────────────────────────────────────────────────────────────────

describe('Apply', () => {
  it('returns statistics and audit payloads', () => {
    const providerGames = [makeProviderGame()]
    const masterGames = [makeMasterGame()]

    const result = apply(providerGames, masterGames, 'api-sports', { actor: 'user-1' })

    assert.strictEqual(result.dry_run, false)
    assert.strictEqual(result.statistics.total_candidates, 1)
    assert.strictEqual(result.statistics.mapped, 1)
    assert.ok(result.results.auditPayloads.length > 0)
  })

  it('generates audit payloads for all actions', () => {
    const providerGames = [
      makeProviderGame({ externalGameId: '1', homeTeamAbbr: 'KC' }),
      makeProviderGame({ externalGameId: '2', homeTeamAbbr: 'DAL' }),
    ]
    const masterGames = [
      makeMasterGame({ id: 'mg-1', home_abbr: 'KC' }),
    ]

    const result = apply(providerGames, masterGames, 'api-sports')
    assert.ok(result.results.auditPayloads.length >= 2)
  })

  it('tracks propagation updates', () => {
    const providerGames = [makeProviderGame({ homeScore: 24, awayScore: 17 })]
    const masterGames = [makeMasterGame()]
    const leagueGames = [
      { id: 'lg-1', master_game_id: 'mg-1', training_session_id: null, home_score: null, away_score: null, result: null, finished: false, game_time: BASE_TIME },
    ]

    const result = apply(providerGames, masterGames, 'api-sports', { leagueGames })
    assert.strictEqual(result.statistics.propagation_updates, 1)
  })

  it('does not propagate to simulation games', () => {
    const providerGames = [makeProviderGame()]
    const masterGames = [makeMasterGame()]
    const leagueGames = [
      { id: 'lg-1', master_game_id: 'mg-1', training_session_id: 'ts-1', home_score: null },
    ]

    const result = apply(providerGames, masterGames, 'api-sports', { leagueGames })
    assert.strictEqual(result.statistics.propagation_updates, 0)
  })

  it('is idempotent: running twice produces same result', () => {
    const providerGames = [makeProviderGame()]
    const masterGames = [makeMasterGame()]

    const result1 = apply(providerGames, masterGames, 'api-sports')
    const result2 = apply(providerGames, masterGames, 'api-sports')

    assert.strictEqual(result1.statistics.mapped, result2.statistics.mapped)
    assert.strictEqual(result1.statistics.unmatched, result2.statistics.unmatched)
  })
})

// ── BACKFILL STATISTICS ────────────────────────────────────────────────────────

describe('Backfill Statistics', () => {
  it('produces all required metrics', () => {
    const providerGames = [
      makeProviderGame({ externalGameId: '1' }),
      makeProviderGame({ externalGameId: '2', homeTeamAbbr: 'DAL' }),
      makeProviderGame({ externalGameId: '3', homeTeamAbbr: 'KC', awayTeamAbbr: 'BUF' }),
    ]
    const masterGames = [
      makeMasterGame({ id: 'mg-1' }),
      makeMasterGame({ id: 'mg-2' }),
    ]

    const result = dryRun(providerGames, masterGames, 'api-sports')
    const stats = result.statistics

    assert.ok('total_candidates' in stats)
    assert.ok('high_confidence_matches' in stats)
    assert.ok('medium_confidence_matches' in stats)
    assert.ok('low_confidence_matches' in stats)
    assert.ok('ambiguous' in stats)
    assert.ok('unmatched' in stats)
    assert.ok('conflicts' in stats)
    assert.ok('manual_overrides' in stats)
    assert.ok('skipped_already_mapped' in stats)
  })

  it('total_candidates equals provider games length', () => {
    const providerGames = [
      makeProviderGame({ externalGameId: '1' }),
      makeProviderGame({ externalGameId: '2' }),
      makeProviderGame({ externalGameId: '3' }),
    ]

    const result = dryRun(providerGames, [], 'api-sports')
    assert.strictEqual(result.statistics.total_candidates, 3)
  })
})
