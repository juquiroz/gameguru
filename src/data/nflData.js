// ─── Team config ────────────────────────────────────────────────────────────
export const TEAM_LOGOS = {
  KC: '🏈', BAL: '🦅', DAL: '⭐', PHI: '🦅', SF: '🔴', SEA: '🌊',
  BUF: '🐃', NYJ: '✈️', MIA: '🐬', NE: '⚓', GB: '🧀', CHI: '🐻',
  LAR: '🐏', DET: '🦁', CIN: '🐯', PIT: '🔨', MIN: '⚔️', NYG: '🏈',
  TB: '🏴‍☠️', ATL: '🦅', CAR: '🐈', NO: '⚜️', ARI: '🏜️', LAC: '⚡',
  LV: '☠️', DEN: '🐴', HOU: '🤠', IND: '🐎', JAX: '🐆',
  TEN: '⚡', CLE: '🐶', WAS: '🦅',
}

export const teamLogo = (abbr) => TEAM_LOGOS[abbr] || '🏈'

export const NFL_TEAMS = {
  ARI: { name: 'Arizona Cardinals',     division: 'NFC West'  },
  ATL: { name: 'Atlanta Falcons',       division: 'NFC South' },
  BAL: { name: 'Baltimore Ravens',      division: 'AFC North' },
  BUF: { name: 'Buffalo Bills',         division: 'AFC East'  },
  CAR: { name: 'Carolina Panthers',     division: 'NFC South' },
  CHI: { name: 'Chicago Bears',         division: 'NFC North' },
  CIN: { name: 'Cincinnati Bengals',    division: 'AFC North' },
  CLE: { name: 'Cleveland Browns',      division: 'AFC North' },
  DAL: { name: 'Dallas Cowboys',        division: 'NFC East'  },
  DEN: { name: 'Denver Broncos',        division: 'AFC West'  },
  DET: { name: 'Detroit Lions',         division: 'NFC North' },
  GB:  { name: 'Green Bay Packers',     division: 'NFC North' },
  HOU: { name: 'Houston Texans',        division: 'AFC South' },
  IND: { name: 'Indianapolis Colts',    division: 'AFC South' },
  JAX: { name: 'Jacksonville Jaguars',  division: 'AFC South' },
  KC:  { name: 'Kansas City Chiefs',    division: 'AFC West'  },
  LAC: { name: 'Los Angeles Chargers',  division: 'AFC West'  },
  LAR: { name: 'Los Angeles Rams',      division: 'NFC West'  },
  LV:  { name: 'Las Vegas Raiders',     division: 'AFC West'  },
  MIA: { name: 'Miami Dolphins',        division: 'AFC East'  },
  MIN: { name: 'Minnesota Vikings',     division: 'NFC North' },
  NE:  { name: 'New England Patriots',  division: 'AFC East'  },
  NO:  { name: 'New Orleans Saints',    division: 'NFC South' },
  NYG: { name: 'New York Giants',       division: 'NFC East'  },
  NYJ: { name: 'New York Jets',         division: 'AFC East'  },
  PHI: { name: 'Philadelphia Eagles',   division: 'NFC East'  },
  PIT: { name: 'Pittsburgh Steelers',   division: 'AFC North' },
  SEA: { name: 'Seattle Seahawks',      division: 'NFC West'  },
  SF:  { name: 'San Francisco 49ers',   division: 'NFC West'  },
  TB:  { name: 'Tampa Bay Buccaneers',  division: 'NFC South' },
  TEN: { name: 'Tennessee Titans',      division: 'AFC South' },
  WAS: { name: 'Washington Commanders', division: 'NFC East'  },
}

const DIVISIONS = {
  'AFC East':  ['BUF', 'MIA', 'NE', 'NYJ'],
  'AFC North': ['BAL', 'CIN', 'CLE', 'PIT'],
  'AFC South': ['HOU', 'IND', 'JAX', 'TEN'],
  'AFC West':  ['DEN', 'KC',  'LV',  'LAC'],
  'NFC East':  ['DAL', 'NYG', 'PHI', 'WAS'],
  'NFC North': ['CHI', 'DET', 'GB',  'MIN'],
  'NFC South': ['ATL', 'CAR', 'NO',  'TB'],
  'NFC West':  ['ARI', 'LAR', 'SF',  'SEA'],
}

// 2026 rotations: NFC East vs AFC East, NFC North vs AFC North, etc.
const INTER_CONF = {
  'NFC East':  'AFC East',
  'NFC North': 'AFC North',
  'NFC South': 'AFC South',
  'NFC West':  'AFC West',
}
const INTRA_CONF = {
  'NFC East':  'NFC North',
  'NFC North': 'NFC East',
  'NFC South': 'NFC West',
  'NFC West':  'NFC South',
  'AFC East':  'AFC North',
  'AFC North': 'AFC East',
  'AFC South': 'AFC West',
  'AFC West':  'AFC South',
}

export function generateNFLSchedule(season = '2026') {
  const games = []
  let gid = 1

  // Division games: each team plays 3 division opponents home & away
  const divGames = []
  for (const [div, teams] of Object.entries(DIVISIONS)) {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        divGames.push({ away: teams[i], home: teams[j] })
        divGames.push({ away: teams[j], home: teams[i] })
      }
    }
  }
  divGames.forEach(g => games.push({ ...g, type: 'division' }))

  // Inter-conference games: NFC div vs paired AFC div
  for (const [nfcDiv, afcDiv] of Object.entries(INTER_CONF)) {
    const nfcTeams = DIVISIONS[nfcDiv]
    const afcTeams = DIVISIONS[afcDiv]
    for (let i = 0; i < 4; i++) {
      games.push({ away: nfcTeams[i], home: afcTeams[i], type: 'inter' })
      games.push({ away: afcTeams[i], home: nfcTeams[(i + 1) % 4], type: 'inter' })
    }
  }

  // Intra-conference cross-division games
  for (const [divA, divB] of Object.entries(INTRA_CONF)) {
    const teamsA = DIVISIONS[divA]
    const teamsB = DIVISIONS[divB]
    for (let i = 0; i < 4; i++) {
      games.push({ away: teamsA[i], home: teamsB[i], type: 'intra' })
      games.push({ away: teamsB[i], home: teamsA[(i + 1) % 4], type: 'intra' })
    }
  }

  // Shuffle and distribute across 18 weeks
  const shuffled = [...games].sort(() => Math.random() - 0.5)
  const weeks = {}
  let week = 1
  let weekGames = []
  const usedTeamsWeek = {}

  for (const g of shuffled) {
    const canAdd = !usedTeamsWeek[g.away] && !usedTeamsWeek[g.home]
    if (canAdd && weekGames.length < 16) {
      weekGames.push(g)
      usedTeamsWeek[g.away] = true
      usedTeamsWeek[g.home] = true
    } else {
      if (!weeks[week]) weeks[week] = []
      weeks[week].push(...weekGames)
      week++
      weekGames = [g]
      Object.keys(usedTeamsWeek).forEach(k => delete usedTeamsWeek[k])
      usedTeamsWeek[g.away] = true
      usedTeamsWeek[g.home] = true
      if (week > 18) week = 18
    }
  }
  if (weekGames.length) {
    if (!weeks[week]) weeks[week] = []
    weeks[week].push(...weekGames)
  }

  // Build final game objects
  const DAYS = ['Jue 8:20 PM', 'Vie 8:15 PM', 'Dom 1:00 PM', 'Dom 4:05 PM', 'Dom 4:25 PM', 'Dom 8:20 PM', 'Lun 8:15 PM', 'Sáb 4:30 PM', 'Sáb 8:15 PM']
  const result = []
  for (let w = 1; w <= 18; w++) {
    const wGames = weeks[w] || []
    wGames.forEach((g, idx) => {
      const tm = NFL_TEAMS[g.home]
      const ta = NFL_TEAMS[g.away]
      result.push({
        sport: 'NFL',
        season,
        week: w,
        game_id: `w${w}g${idx + 1}`,
        home_team: tm.name,
        away_team: ta.name,
        home_abbr: g.home,
        away_abbr: g.away,
        game_time: DAYS[idx % DAYS.length],
      })
    })
  }
  return result
}

// ─── Sport config ────────────────────────────────────────────────────────────
export const SPORTS = [
  { id: 'NFL',    label: 'NFL',    icon: '🏈' },
  { id: 'MLB',    label: 'MLB',    icon: '⚾' },
  { id: 'NBA',    label: 'NBA',    icon: '🏀' },
  { id: 'Custom', label: 'Custom', icon: '⚙️' },
]

// ─── NFL Weeks ───────────────────────────────────────────────────────────────
export const NFL_WEEKS = {
  1: {
    label: 'Semana 1',
    deadline: '2025-09-07T17:00:00',
    finished: true,
    games: [
      { id: 'g1',  home: 'Kansas City Chiefs',     away: 'Baltimore Ravens',      hA: 'KC',  aA: 'BAL', time: 'Dom 8:20 PM' },
      { id: 'g2',  home: 'Dallas Cowboys',         away: 'Philadelphia Eagles',   hA: 'DAL', aA: 'PHI', time: 'Dom 4:25 PM' },
      { id: 'g3',  home: 'San Francisco 49ers',    away: 'Seattle Seahawks',      hA: 'SF',  aA: 'SEA', time: 'Dom 1:00 PM' },
      { id: 'g4',  home: 'Buffalo Bills',          away: 'New York Jets',         hA: 'BUF', aA: 'NYJ', time: 'Dom 1:00 PM' },
      { id: 'g5',  home: 'Miami Dolphins',         away: 'New England Patriots',  hA: 'MIA', aA: 'NE',  time: 'Dom 1:00 PM' },
      { id: 'g6',  home: 'Green Bay Packers',      away: 'Chicago Bears',         hA: 'GB',  aA: 'CHI', time: 'Sáb 8:15 PM' },
      { id: 'g7',  home: 'Los Angeles Rams',       away: 'Detroit Lions',         hA: 'LAR', aA: 'DET', time: 'Jue 8:20 PM' },
      { id: 'g8',  home: 'Cincinnati Bengals',     away: 'Pittsburgh Steelers',   hA: 'CIN', aA: 'PIT', time: 'Dom 1:00 PM' },
    ],
    results: { g1: 'KC', g2: 'PHI', g3: 'SF', g4: 'BUF', g5: 'MIA', g6: 'GB', g7: 'DET', g8: 'CIN' },
  },
  2: {
    label: 'Semana 2',
    deadline: '2025-09-14T17:00:00',
    finished: false,
    games: [
      { id: 'g9',  home: 'Kansas City Chiefs',     away: 'Cincinnati Bengals',    hA: 'KC',  aA: 'CIN', time: 'Dom 8:20 PM' },
      { id: 'g10', home: 'Philadelphia Eagles',    away: 'Minnesota Vikings',     hA: 'PHI', aA: 'MIN', time: 'Dom 4:25 PM' },
      { id: 'g11', home: 'San Francisco 49ers',    away: 'Los Angeles Rams',      hA: 'SF',  aA: 'LAR', time: 'Dom 4:05 PM' },
      { id: 'g12', home: 'Buffalo Bills',          away: 'Miami Dolphins',        hA: 'BUF', aA: 'MIA', time: 'Dom 1:00 PM' },
      { id: 'g13', home: 'Dallas Cowboys',         away: 'New York Giants',       hA: 'DAL', aA: 'NYG', time: 'Dom 1:00 PM' },
      { id: 'g14', home: 'Detroit Lions',          away: 'Tampa Bay Buccaneers',  hA: 'DET', aA: 'TB',  time: 'Dom 1:00 PM' },
    ],
    results: null,
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const genInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const translateAuthError = (msg = '') => {
  const m = msg.toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid credentials'))
    return 'Email o contraseña incorrectos.'
  if (m.includes('email not confirmed'))
    return 'Confirma tu email antes de entrar. Revisa tu bandeja de entrada.'
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Este email ya está registrado. Intenta entrar.'
  if (m.includes('password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('unable to validate email'))
    return 'El formato del email no es válido.'
  if (m.includes('signup is disabled'))
    return 'El registro está desactivado temporalmente.'
  if (m.includes('email rate limit'))
    return 'Demasiados intentos. Espera unos minutos.'
  return msg
}
