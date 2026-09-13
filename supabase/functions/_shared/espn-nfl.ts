const API_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

const TEAM_MAP: Record<string, string> = {
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

const STATUS_MAP: Record<string, string> = {
  STATUS_SCHEDULED: 'scheduled',
  STATUS_PRE_GAME: 'scheduled',
  STATUS_IN_PROGRESS: 'live',
  STATUS_HALFTIME: 'live',
  STATUS_FINAL: 'final',
  STATUS_POSTPONED: 'postponed',
  STATUS_DELAYED: 'delayed',
  STATUS_CANCELED: 'cancelled',
  STATUS_CANCELLED: 'cancelled',
  STATUS_SUSPENDED: 'suspended',
}

export function apiErrorList(d: any): string[] {
  if (!d || typeof d !== 'object') return []
  if (Array.isArray(d.errors)) return d.errors.filter(Boolean)
  if (d.errors && typeof d.errors === 'object') return Object.values(d.errors).filter(Boolean)
  return []
}

export function toNumScore(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function normalize(event: any) {
  const comp = event?.competitions?.[0]
  if (!comp) return null
  if (!Array.isArray(comp.competitors) || comp.competitors.length < 2) return null

  const home = comp.competitors.find((c: any) => c.homeAway === 'home')
  const away = comp.competitors.find((c: any) => c.homeAway === 'away')
  const hAbbr = TEAM_MAP[home?.team?.displayName]
  const aAbbr = TEAM_MAP[away?.team?.displayName]
  if (!hAbbr || !aAbbr) return null

  const statusName = comp.status?.type?.name || event.status?.type?.name || 'STATUS_SCHEDULED'
  const status = STATUS_MAP[statusName] || 'scheduled'
  const finished = status === 'final'
  const hs = toNumScore(home?.score)
  const as_ = toNumScore(away?.score)
  let result: string | null = null
  if (hs !== null && as_ !== null && finished) result = hs > as_ ? hAbbr : as_ > hs ? aAbbr : null

  const seasonType = event?.season?.type
  let phase = 'regular'
  if (seasonType === 1) phase = 'preseason'
  else if (seasonType === 3) phase = 'postseason'

  return {
    externalGameId: String(event.id),
    externalCompetitionId: `nfl-${event?.season?.year ?? ''}`,
    homeTeamAbbr: hAbbr,
    awayTeamAbbr: aAbbr,
    gameTime: event.date ?? comp.date ?? null,
    status,
    homeScore: hs,
    awayScore: as_,
    result,
    finished,
    week: event?.week?.number ?? null,
    phase,
  }
}

async function fetchScoreboard(params: Record<string, string>) {
  const p = new URLSearchParams(params)
  const r = await fetch(`${API_URL}?${p}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'curl/8.5.0',
    },
  })
  if (!r.ok) throw new Error(`ESPN ${r.status}`)
  const raw = await r.text()
  let d: any = null
  try {
    d = JSON.parse(raw)
  } catch {
    console.log('[ESPN] scoreboard NON-JSON RESPONSE', {
      parameters: params,
      prefix: raw.slice(0, 500),
    })
    throw new Error(`ESPN non-JSON response for ${API_URL}`)
  }
  const errors = apiErrorList(d)
  const eventsCount = Array.isArray(d.events) ? d.events.length : 0
  console.log('[ESPN] scoreboard respond', {
    parameters: params,
    errors,
    events: eventsCount,
    hasEventsField: Object.prototype.hasOwnProperty.call(d, 'events'),
    keys: Object.keys(d).slice(0, 15),
    samples: (d.events || []).slice(0, 2).map((e: any) => ({
      id: e.id, date: e.date, week: e.week?.number, season: e.season,
      teams: (e.competitions?.[0]?.competitors || []).map((c: any) => `${c.team?.displayName}=${c.score}`),
      status: e.competitions?.[0]?.status?.type?.name,
    })),
  })
  if (errors.length) throw new Error(`ESPN: ${errors.join(' | ')}`)
  return (d.events || []).map(normalize).filter(Boolean)
}

export async function fetchGamesByDate(date: string) {
  const key = date.replace(/[-]/g, '')
  return fetchScoreboard({ dates: key })
}

export async function fetchGamesBySeason(season: string, phase: string) {
  const seasonType = phase === 'preseason' ? '1' : phase === 'postseason' ? '3' : '2'
  const seen = new Set<string>()
  const all: any[] = []
  // Football seasons span semanas 1..25 (incluye postseason). Dedup por id.
  for (let w = 1; w <= 25; w++) {
    const games = await fetchScoreboard({ season, seasonType, week: String(w) })
    for (const g of games) {
      if (!seen.has(g.externalGameId)) {
        seen.add(g.externalGameId)
        all.push(g)
      }
    }
  }
  return all
}