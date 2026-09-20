/**
 * API-Sports NFL Adapter
 * 
 * Implementa SportsDataProvider para NFL usando API-Sports (api-sports.io)
 * API Reference: https://www.api-sports.com/documentation/american-football/v1
 * 
 * MVP: Solo NFL
 * POST-MVP: MLB, NBA con adapters adicionales
 */

import { SPORTS_PROVIDER_STATUS } from './SportsDataProvider.js'

const API_FOOTBALL_BASE_URL = 'https://v1.american-football.api-sports.io'

const STATUS_MAPPING = {
  'NS': SPORTS_PROVIDER_STATUS.SCHEDULED,
  '1H': SPORTS_PROVIDER_STATUS.LIVE,
  'HT': SPORTS_PROVIDER_STATUS.LIVE,
  '2H': SPORTS_PROVIDER_STATUS.LIVE,
  'ET': SPORTS_PROVIDER_STATUS.LIVE,
  'P': SPORTS_PROVIDER_STATUS.POSTPONED,
  'CANC': SPORTS_PROVIDER_STATUS.CANCELLED,
  'SUSP': SPORTS_PROVIDER_STATUS.SUSPENDED,
  'INT': SPORTS_PROVIDER_STATUS.DELAYED,
  'FT': SPORTS_PROVIDER_STATUS.FINAL,
  'AET': SPORTS_PROVIDER_STATUS.FINAL,
  'PEN': SPORTS_PROVIDER_STATUS.FINAL,
}

const TEAM_MAPPING = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS',
  'Washington Football Team': 'WAS',
}

const SEASON_TYPE_MAPPING = {
  1: 'preseason',
  2: 'regular',
  3: 'postseason',
}

export function createApiSportsNflAdapter(apiKey) {
  if (!apiKey) {
    throw new Error('API-Sports API key is required')
  }

  async function apiRequest(endpoint, params = {}) {
    const url = new URL(`${API_FOOTBALL_BASE_URL}${endpoint}`)
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value))
      }
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`API-Sports request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.errors && Object.keys(data.errors).length > 0) {
      throw new Error(`API-Sports API error: ${JSON.stringify(data.errors)}`)
    }

    return data
  }

  function normalizeGame(game) {
    const homeTeamName = game.teams.home.name
    const awayTeamName = game.teams.away.name
    
    const homeTeamAbbr = TEAM_MAPPING[homeTeamName]
    const awayTeamAbbr = TEAM_MAPPING[awayTeamName]

    if (!homeTeamAbbr || !awayTeamAbbr) {
      console.warn(`[API-Sports] Unknown team: ${homeTeamName} or ${awayTeamName}`)
      return null
    }

    const status = STATUS_MAPPING[game.fixture.status.short] || SPORTS_PROVIDER_STATUS.SCHEDULED
    const isFinal = status === SPORTS_PROVIDER_STATUS.FINAL

    let homeScore = null
    let awayScore = null
    let result = null

    if (game.scores.home.total !== null && game.scores.away.total !== null) {
      homeScore = game.scores.home.total
      awayScore = game.scores.away.total

      if (isFinal) {
        if (homeScore > awayScore) {
          result = homeTeamAbbr
        } else if (awayScore > homeScore) {
          result = awayTeamAbbr
        }
      }
    }

    const phase = SEASON_TYPE_MAPPING[game.league.season_type] || 'regular'

    return {
      externalGameId: String(game.fixture.id),
      externalCompetitionId: `${game.league.id}-${game.league.season}`,
      homeTeamAbbr,
      awayTeamAbbr,
      gameTime: game.fixture.date,
      status,
      homeScore,
      awayScore,
      result,
      finished: isFinal,
      week: game.fixture.week || null,
      phase,
    }
  }

  return {
    async getGames({ sport, season, phase }) {
      if (sport !== 'NFL') {
        throw new Error(`API-Sports NFL adapter only supports NFL, got: ${sport}`)
      }

      const seasonType = Object.entries(SEASON_TYPE_MAPPING).find(
        ([, value]) => value === phase
      )?.[0]

      const params = {
        league: 1,
        season: season,
      }

      if (seasonType) {
        params.season_type = seasonType
      }

      const data = await apiRequest('/games', params)
      
      const games = (data.response || [])
        .map(normalizeGame)
        .filter(Boolean)

      return games
    },

    async getGamesByDate({ sport, season, date }) {
      if (sport !== 'NFL') {
        throw new Error(`API-Sports NFL adapter only supports NFL, got: ${sport}`)
      }

      if (!date || typeof date !== 'string') {
        throw new Error('date is required and must be a string (YYYY-MM-DD)')
      }

      const params = {
        league: 1,
        season: season,
        date: date,
      }

      const data = await apiRequest('/games', params)

      const games = (data.response || [])
        .map(normalizeGame)
        .filter(Boolean)

      return games
    },

    async getGameStatus(externalGameId) {
      const data = await apiRequest('/games', { id: externalGameId })
      
      if (!data.response || data.response.length === 0) {
        return null
      }

      return normalizeGame(data.response[0])
    },

    async getCompetitions(sport) {
      if (sport !== 'NFL') {
        return []
      }

      return [
        {
          id: '1',
          name: 'NFL',
          season: new Date().getFullYear().toString(),
        }
      ]
    },
  }
}

export { TEAM_MAPPING, STATUS_MAPPING, SEASON_TYPE_MAPPING }
