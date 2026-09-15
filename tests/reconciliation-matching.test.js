import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
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
} from '../src/domains/sports/reconciliation/matching.js'

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
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    result: null,
    finished: false,
    ...overrides,
  }
}

function makeMasterGame(overrides = {}) {
  return {
    id: 'mg-1',
    sport: 'NFL',
    season: '2026',
    week: 1,
    game_id: 'w1g1',
    home_team: 'Kansas City Chiefs',
    away_team: 'Buffalo Bills',
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
    external_competition_id: null,
    mapping_status: 'unmapped',
    mapping_confidence: null,
    reconciliation_source: null,
    mapped_at: null,
    mapped_by: null,
    ...overrides,
  }
}

// ── TIME UTILITIES ─────────────────────────────────────────────────────────────

describe('Time Utilities', () => {
  it('parseGameTime handles ISO strings', () => {
    const d = parseGameTime('2026-09-10T20:20:00-05:00')
    assert.ok(d instanceof Date)
    assert.ok(!isNaN(d.getTime()))
  })

  it('parseGameTime returns null for invalid input', () => {
    assert.strictEqual(parseGameTime(null), null)
    assert.strictEqual(parseGameTime('invalid'), null)
  })

  it('timeDiffMs calculates correct difference', () => {
    const a = '2026-09-10T20:20:00-05:00'
    const b = '2026-09-10T21:20:00-05:00'
    const diff = timeDiffMs(a, b)
    assert.strictEqual(diff, 60 * 60 * 1000)
  })

  it('timeDiffMs returns Infinity for null', () => {
    assert.strictEqual(timeDiffMs(null, BASE_TIME), Infinity)
    assert.strictEqual(timeDiffMs(BASE_TIME, null), Infinity)
  })

  it('TIME_TOLERANCE_MS is 2 hours', () => {
    assert.strictEqual(TIME_TOLERANCE_MS, 2 * 60 * 60 * 1000)
  })
})

// ── PRIORITY 1: EXACT EXTERNAL ID ──────────────────────────────────────────────

describe('Priority 1: Exact External ID', () => {
  it('matches by exact provider + external_game_id', () => {
    const pg = makeProviderGame({ externalGameId: '99999' })
    const mg = makeMasterGame({ provider: 'api-sports', external_game_id: '99999' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.MAPPED)
    assert.strictEqual(result.confidence, MATCH_CONFIDENCE.HIGH)
    assert.strictEqual(result.reason, 'exact_external_id')
    assert.strictEqual(result.matchedGame.id, 'mg-1')
  })

  it('does not match different provider', () => {
    const pg = makeProviderGame({ externalGameId: '99999' })
    const mg = makeMasterGame({ provider: 'other-provider', external_game_id: '99999' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.notStrictEqual(result.reason, 'exact_external_id')
  })

  it('does not match different external_game_id', () => {
    const pg = makeProviderGame({ externalGameId: '99999' })
    const mg = makeMasterGame({ provider: 'api-sports', external_game_id: '88888' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.notStrictEqual(result.reason, 'exact_external_id')
  })
})

// ── PRIORITY 2: TEAM + WEEK/PHASE + TIME ──────────────────────────────────────

describe('Priority 2: Team + Week/Phase + Time ±2h', () => {
  it('matches exact team + week + phase + time', () => {
    const pg = makeProviderGame()
    const mg = makeMasterGame()

    const result = matchGame(pg, [mg], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.MAPPED)
    assert.strictEqual(result.confidence, MATCH_CONFIDENCE.HIGH)
    assert.strictEqual(result.reason, 'team_week_time')
  })

  it('matches within ±2h tolerance', () => {
    const pg = makeProviderGame({ gameTime: '2026-09-10T22:00:00-05:00' })
    const mg = makeMasterGame({ game_time: '2026-09-10T20:20:00-05:00' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.MAPPED)
    assert.strictEqual(result.confidence, MATCH_CONFIDENCE.HIGH)
  })

  it('does not match outside ±2h tolerance', () => {
    const pg = makeProviderGame({ gameTime: '2026-09-11T00:00:00-05:00' })
    const mg = makeMasterGame({ game_time: '2026-09-10T20:20:00-05:00' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.notStrictEqual(result.confidence, MATCH_CONFIDENCE.HIGH)
  })

  it('does not match different home team', () => {
    const pg = makeProviderGame({ homeTeamAbbr: 'DAL' })
    const mg = makeMasterGame()

    const result = matchGame(pg, [mg], 'api-sports')
    assert.notStrictEqual(result.reason, 'team_week_time')
  })

  it('does not match different away team', () => {
    const pg = makeProviderGame({ awayTeamAbbr: 'NE' })
    const mg = makeMasterGame()

    const result = matchGame(pg, [mg], 'api-sports')
    assert.notStrictEqual(result.reason, 'team_week_time')
  })

  it('does not match different phase', () => {
    const pg = makeProviderGame({ phase: 'preseason' })
    const mg = makeMasterGame({ phase: 'regular' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.notStrictEqual(result.reason, 'team_week_time')
  })

  it('does not match different week when both have week', () => {
    const pg = makeProviderGame({ week: 2 })
    const mg = makeMasterGame({ week: 1 })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.notStrictEqual(result.reason, 'team_week_time')
  })

  it('matches when week is null on master_game', () => {
    const pg = makeProviderGame({ week: 1 })
    const mg = makeMasterGame({ week: null })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.MAPPED)
  })
})

// ── PRIORITY 3: TEAM + TIME (NO WEEK) ─────────────────────────────────────────

describe('Priority 3: Team + Time (no week constraint)', () => {
  it('matches with different week but same team + time', () => {
    const pg = makeProviderGame({ week: 2 })
    const mg = makeMasterGame({ week: 1 })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.MAPPED)
    assert.strictEqual(result.confidence, MATCH_CONFIDENCE.MEDIUM)
    assert.strictEqual(result.reason, 'team_time')
  })
})

// ── PRIORITY 4: FUZZY FALLBACK ────────────────────────────────────────────────

describe('Priority 4: Fuzzy Fallback', () => {
  it('matches with different phase but same team + time', () => {
    const pg = makeProviderGame({ phase: 'postseason' })
    const mg = makeMasterGame({ phase: 'regular' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.MAPPED)
    assert.strictEqual(result.confidence, MATCH_CONFIDENCE.LOW)
    assert.strictEqual(result.reason, 'fuzzy')
  })
})

// ── AMBIGUOUS ──────────────────────────────────────────────────────────────────

describe('Ambiguous Matching', () => {
  it('marks ambiguous when multiple team+week+time matches', () => {
    const pg = makeProviderGame()
    const mg1 = makeMasterGame({ id: 'mg-1' })
    const mg2 = makeMasterGame({ id: 'mg-2' })

    const result = matchGame(pg, [mg1, mg2], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.AMBIGUOUS)
    assert.strictEqual(result.confidence, MATCH_CONFIDENCE.CONFLICT)
    assert.strictEqual(result.candidates.length, 2)
  })

  it('marks ambiguous when multiple team+time matches', () => {
    const pg = makeProviderGame({ week: 2 })
    const mg1 = makeMasterGame({ id: 'mg-1', week: 1 })
    const mg2 = makeMasterGame({ id: 'mg-2', week: 3 })

    const result = matchGame(pg, [mg1, mg2], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.AMBIGUOUS)
  })

  it('never auto-maps ambiguous results', () => {
    const pg = makeProviderGame()
    const mg1 = makeMasterGame({ id: 'mg-1' })
    const mg2 = makeMasterGame({ id: 'mg-2' })

    const result = matchGame(pg, [mg1, mg2], 'api-sports')
    assert.strictEqual(result.matchedGame, null)
    assert.strictEqual(result.status, 'ambiguous')
  })
})

// ── UNMATCHED ──────────────────────────────────────────────────────────────────

describe('Unmatched', () => {
  it('marks unmatched when no candidates', () => {
    const pg = makeProviderGame({ homeTeamAbbr: 'DAL', awayTeamAbbr: 'NYG' })
    const mg = makeMasterGame({ home_abbr: 'KC', away_abbr: 'BUF' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.UNMATCHED)
    assert.strictEqual(result.reason, 'no_candidate')
  })

  it('marks unmatched when time is too far', () => {
    const pg = makeProviderGame({ gameTime: '2026-10-10T20:20:00-05:00' })
    const mg = makeMasterGame({ game_time: '2026-09-10T20:20:00-05:00' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.UNMATCHED)
  })

  it('never creates master_game for unmatched', () => {
    const pg = makeProviderGame({ homeTeamAbbr: 'DAL' })
    const mg = makeMasterGame()

    const result = matchGame(pg, [mg], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.UNMATCHED)
    assert.strictEqual(result.matchedGame, null)
  })
})

// ── POSTPONED / RESCHEDULED ───────────────────────────────────────────────────

describe('Postponed / Rescheduled Games', () => {
  it('matches postponed game within ±2h of new time', () => {
    const pg = makeProviderGame({ gameTime: '2026-09-11T20:20:00-05:00' })
    const mg = makeMasterGame({ game_time: '2026-09-11T19:00:00-05:00' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.strictEqual(result.status, MATCH_RESULT.MAPPED)
  })

  it('does not match rescheduled game beyond ±2h', () => {
    const pg = makeProviderGame({ gameTime: '2026-09-15T20:20:00-05:00' })
    const mg = makeMasterGame({ game_time: '2026-09-10T20:20:00-05:00' })

    const result = matchGame(pg, [mg], 'api-sports')
    assert.notStrictEqual(result.status, MATCH_RESULT.MAPPED)
  })
})
