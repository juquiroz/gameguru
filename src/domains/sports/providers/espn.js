/**
 * ESPN NFL Adapter
 *
 * Implementa SportsDataProvider para NFL usando el scoreboard público de ESPN
 * (site.api.espn.com) — sin API key.
 *
 * PLAN-021: reemplaza a API-Sports (free sin temporada 2026) como fuente de
 * resultados. Endpoint validado: /apis/site/v2/sports/football/nfl/scoreboard
 * con parámetros dates|week+seasonType+season.
 *
 * MVP: Solo NFL
 * POST-MVP: MLB, NBA con adapters adicionales
 */

import { SPORTS_PROVIDER_STATUS } from './SportsDataProvider.js'

const ESPN_NFL_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

const STATUS_MAPPING = {
  STATUS_SCHEDULED: SPORTS_PROVIDER_STATUS.SCHEDULED,
  STATUS_PRE_GAME: SPORTS_PROVIDER_STATUS.SCHEDULED,
  STATUS_IN_PROGRESS: SPORTS_PROVIDER_STATUS.LIVE,
  STATUS_HALFTIME: SPORTS_PROVIDER_STATUS.LIVE,
  STATUS_FINAL: SPORTS_PROVIDER_STATUS.FINAL,
  STATUS_POSTPONED: SPORTS_PROVIDER_STATUS.POSTPONED,
  STATUS_DELAYED: SPORTS_PROVIDER_STATUS.DELAYED,
  STATUS_CANCELED: SPORTS_PROVIDER_STATUS.CANCELLED,
  STATUS_CANCELLED: SPORTS_PROVIDER_STATUS.CANCELLED,
  STATUS_SUSPENDED: SPORTS_PROVIDER_STATUS.SUSPENDED,
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
}

const SEASON_TYPE_MAPPING = {
  1: 'preseason',
  2: 'regular',
  3: 'postseason',
}

function apiErrorList(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data.errors)) return data.errors.filter(Boolean)
  if (data.errors && typeof data.errors === 'object') return Object.values(data.errors).filter(Boolean)
  return []
}

function toNumScore(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeGame(event) {
  const comp = event?.competitions?.[0]
  if (!comp) return null
  if (!Array.isArray(comp.competitors) || comp.competitors.length < 2) return null

  const home = comp.competitors.find((c) => c.homeAway === 'home')
  const away = comp.competitors.find((c) => c.homeAway === 'away')

  const homeTeamAbbr = TEAM_MAPPING[home?.team?.displayName]
  const awayTeamAbbr = TEAM_MAPPING[away?.team?.displayName]

  if (!homeTeamAbbr || !awayTeamAbbr) {
    console.warn(`[ESPN] Unknown team: ${home?.team?.displayName} or ${away?.team?.displayName}`)
    return null
  }

  const statusName = comp.status?.type?.name || event.status?.type?.name || 'STATUS_SCHEDULED'
  const status = STATUS_MAPPING[statusName] || SPORTS_PROVIDER_STATUS.SCHEDULED
  const isFinal = status === SPORTS_PROVIDER_STATUS.FINAL

  const homeScore = toNumScore(home?.score)
  const awayScore = toNumScore(away?.score)

  let result = null
  if (homeScore !== null && awayScore !== null && isFinal) {
    if (homeScore > awayScore) result = homeTeamAbbr
    else if (awayScore > homeScore) result = awayTeamAbbr
  }

  const seasonType = event?.season?.type
  const phase = SEASON_TYPE_MAPPING[seasonType] || 'regular'

  return {
    externalGameId: String(event.id),
    externalCompetitionId: `nfl-${event?.season?.year ?? ''}`,
    homeTeamAbbr,
    awayTeamAbbr,
    gameTime: event.date ?? comp.date ?? null,
    status,
    homeScore,
    awayScore,
    result,
    finished: isFinal,
    week: event?.week?.number ?? null,
    phase,
  }
}

export function createEspnNflAdapter() {
  async function apiRequest(endpoint, params = {}) {
    const url = new URL(`${ESPN_NFL_BASE_URL}${endpoint}`)

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value))
      }
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`ESPN request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    const errors = apiErrorList(data)
    if (errors.length > 0) {
      throw new Error(`ESPN API error: ${JSON.stringify(errors)}`)
    }

    return data
  }

  return {
    async getGames({ sport, season, phase }) {
      if (sport !== 'NFL') {
        throw new Error(`ESPN NFL adapter only supports NFL, got: ${sport}`)
      }

      const seasonType = Object.entries(SEASON_TYPE_MAPPING).find(
        ([, value]) => value === phase
      )?.[0]

      // ESPN scoreboard sin semana devuelve la semana actual; para temporada
      // completa iteramos semanas y dedup.
      const seen = new Set()
      const games = []
      for (let w = 1; w <= 25; w++) {
        const params = { season, week: w }
        if (seasonType) params.seasonType = seasonType
        const data = await apiRequest('/scoreboard', params)
        for (const event of data.events || []) {
          const game = normalizeGame(event)
          if (game && !seen.has(game.externalGameId)) {
            seen.add(game.externalGameId)
            games.push(game)
          }
        }
      }
      return games
    },

    async getGamesByDate({ sport, season, date }) {
      if (sport !== 'NFL') {
        throw new Error(`ESPN NFL adapter only supports NFL, got: ${sport}`)
      }

      if (!date || typeof date !== 'string') {
        throw new Error('date is required and must be a string (YYYY-MM-DD)')
      }

      const data = await apiRequest('/scoreboard', { dates: date.replace(/-/g, '') })

      const games = (data.events || [])
        .map(normalizeGame)
        .filter(Boolean)

      return games
    },

    async getGameStatus(externalGameId) {
      const data = await apiRequest('/summary', { event: externalGameId })

      const comp = data.header?.competitions?.[0]
      if (!comp) {
        return null
      }

      const event = {
        id: externalGameId,
        date: comp.date,
        week: data.header.week && typeof data.header.week === 'object'
          ? data.header.week
          : { number: data.header.week ?? null },
        season: data.header.season,
        status: comp.status,
        competitions: [comp],
      }

      return normalizeGame(event)
    },

    async getCompetitions(sport) {
      if (sport !== 'NFL') {
        return []
      }

      return [
        {
          id: 'nfl',
          name: 'NFL',
          season: new Date().getFullYear().toString(),
        }
      ]
    },
  }
}

export const espnProvider = createEspnNflAdapter()

export { normalizeGame, TEAM_MAPPING, STATUS_MAPPING, SEASON_TYPE_MAPPING }