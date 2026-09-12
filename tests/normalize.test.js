import { describe, it } from 'node:test'
import assert from 'node:assert'

const STATUS_MAP = {
  NS: 'scheduled', '1H': 'live', HT: 'live', '2H': 'live', ET: 'live',
  P: 'postponed', CANC: 'cancelled', SUSP: 'suspended', INT: 'delayed',
  FT: 'final', AET: 'final', PEN: 'final',
}

const TEAM_MAP = {
  'Arizona Cardinals': 'ARI', 'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF', 'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE', 'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC', 'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR', 'Miami Dolphins': 'MIA', 'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE', 'New Orleans Saints': 'NO', 'New York Giants': 'NYG',
  'New York Jets': 'NYJ', 'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF', 'Seattle Seahawks': 'SEA', 'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN', 'Washington Commanders': 'WAS',
}

const SEASON_TYPE_MAP = { 1: 'preseason', 2: 'regular', 3: 'postseason' }

function normalize(g) {
  const h = TEAM_MAP[g.teams?.home?.name], a = TEAM_MAP[g.teams?.away?.name]
  if (!h || !a) return null
  const st = STATUS_MAP[g.fixture?.status?.short] || 'scheduled'
  const fin = st === 'final'
  let hs = g.scores?.home?.total ?? null, as_ = g.scores?.away?.total ?? null, res = null
  if (hs !== null && as_ !== null && fin) res = hs > as_ ? h : as_ > hs ? a : null
  return {
    externalGameId: String(g.fixture?.id),
    externalCompetitionId: `${g.league?.id}-${g.league?.season}`,
    homeTeamAbbr: h, awayTeamAbbr: a, gameTime: g.fixture?.date,
    status: st, homeScore: hs, awayScore: as_, result: res,
    finished: fin, week: g.fixture?.week || null,
    phase: SEASON_TYPE_MAP[g.league?.season_type] || 'regular',
  }
}

describe('Game Normalization', () => {
  it('should normalize a scheduled game', () => {
    const apiGame = {
      fixture: { id: 12345, date: '2026-09-10T20:20:00-05:00', status: { short: 'NS' }, week: 1 },
      league: { id: 1, season: 2026, season_type: 2 },
      teams: { home: { name: 'Kansas City Chiefs' }, away: { name: 'Dallas Cowboys' } },
      scores: { home: { total: null }, away: { total: null } },
    }

    const result = normalize(apiGame)

    assert.strictEqual(result.externalGameId, '12345')
    assert.strictEqual(result.homeTeamAbbr, 'KC')
    assert.strictEqual(result.awayTeamAbbr, 'DAL')
    assert.strictEqual(result.status, 'scheduled')
    assert.strictEqual(result.finished, false)
    assert.strictEqual(result.homeScore, null)
    assert.strictEqual(result.awayScore, null)
    assert.strictEqual(result.result, null)
    assert.strictEqual(result.week, 1)
    assert.strictEqual(result.phase, 'regular')
  })

  it('should normalize a final game with winner', () => {
    const apiGame = {
      fixture: { id: 12346, date: '2026-09-10T20:20:00-05:00', status: { short: 'FT' }, week: 1 },
      league: { id: 1, season: 2026, season_type: 2 },
      teams: { home: { name: 'Kansas City Chiefs' }, away: { name: 'Dallas Cowboys' } },
      scores: { home: { total: 24 }, away: { total: 17 } },
    }

    const result = normalize(apiGame)

    assert.strictEqual(result.status, 'final')
    assert.strictEqual(result.finished, true)
    assert.strictEqual(result.homeScore, 24)
    assert.strictEqual(result.awayScore, 17)
    assert.strictEqual(result.result, 'KC')
  })

  it('should normalize a final game with tie', () => {
    const apiGame = {
      fixture: { id: 12347, date: '2026-09-10T20:20:00-05:00', status: { short: 'FT' }, week: 1 },
      league: { id: 1, season: 2026, season_type: 2 },
      teams: { home: { name: 'Kansas City Chiefs' }, away: { name: 'Dallas Cowboys' } },
      scores: { home: { total: 20 }, away: { total: 20 } },
    }

    const result = normalize(apiGame)

    assert.strictEqual(result.finished, true)
    assert.strictEqual(result.homeScore, 20)
    assert.strictEqual(result.awayScore, 20)
    assert.strictEqual(result.result, null)
  })

  it('should normalize a live game', () => {
    const apiGame = {
      fixture: { id: 12348, date: '2026-09-10T20:20:00-05:00', status: { short: '2H' }, week: 1 },
      league: { id: 1, season: 2026, season_type: 2 },
      teams: { home: { name: 'Kansas City Chiefs' }, away: { name: 'Dallas Cowboys' } },
      scores: { home: { total: 14 }, away: { total: 10 } },
    }

    const result = normalize(apiGame)

    assert.strictEqual(result.status, 'live')
    assert.strictEqual(result.finished, false)
    assert.strictEqual(result.homeScore, 14)
    assert.strictEqual(result.awayScore, 10)
    assert.strictEqual(result.result, null)
  })

  it('should normalize a postponed game', () => {
    const apiGame = {
      fixture: { id: 12349, date: '2026-09-10T20:20:00-05:00', status: { short: 'P' }, week: 1 },
      league: { id: 1, season: 2026, season_type: 2 },
      teams: { home: { name: 'Kansas City Chiefs' }, away: { name: 'Dallas Cowboys' } },
      scores: { home: { total: null }, away: { total: null } },
    }

    const result = normalize(apiGame)

    assert.strictEqual(result.status, 'postponed')
    assert.strictEqual(result.finished, false)
  })

  it('should return null for unknown team', () => {
    const apiGame = {
      fixture: { id: 12350, date: '2026-09-10T20:20:00-05:00', status: { short: 'NS' }, week: 1 },
      league: { id: 1, season: 2026, season_type: 2 },
      teams: { home: { name: 'Unknown Team' }, away: { name: 'Dallas Cowboys' } },
      scores: { home: { total: null }, away: { total: null } },
    }

    const result = normalize(apiGame)

    assert.strictEqual(result, null)
  })

  it('should map preseason correctly', () => {
    const apiGame = {
      fixture: { id: 12351, date: '2026-08-10T20:20:00-05:00', status: { short: 'FT' }, week: 1 },
      league: { id: 1, season: 2026, season_type: 1 },
      teams: { home: { name: 'Kansas City Chiefs' }, away: { name: 'Dallas Cowboys' } },
      scores: { home: { total: 24 }, away: { total: 17 } },
    }

    const result = normalize(apiGame)

    assert.strictEqual(result.phase, 'preseason')
  })

  it('should map postseason correctly', () => {
    const apiGame = {
      fixture: { id: 12352, date: '2027-01-15T20:20:00-05:00', status: { short: 'FT' }, week: 1 },
      league: { id: 1, season: 2026, season_type: 3 },
      teams: { home: { name: 'Kansas City Chiefs' }, away: { name: 'Dallas Cowboys' } },
      scores: { home: { total: 24 }, away: { total: 17 } },
    }

    const result = normalize(apiGame)

    assert.strictEqual(result.phase, 'postseason')
  })
})
