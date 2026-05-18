// ─── Team config ────────────────────────────────────────────────────────────
export const TEAM_LOGOS = {
  KC: '🏈', BAL: '🦅', DAL: '⭐', PHI: '🦅', SF: '🔴', SEA: '🌊',
  BUF: '🐃', NYJ: '✈️', MIA: '🐬', NE: '⚓', GB: '🧀', CHI: '🐻',
  LAR: '🐏', DET: '🦁', CIN: '🐯', PIT: '🔨', MIN: '⚔️', NYG: '🏈',
  TB: '🏴‍☠️', ATL: '🦅', CAR: '🐈', NO: '⚜️', ARI: '🏜️', LAC: '⚡',
  LV: '☠️', DEN: '🐴', KC2: '🏈', HOU: '🤠', IND: '🐎', JAX: '🐆',
  TEN: '⚡', CLE: '🐶', NYG2: '🏈', WAS: '🦅',
}

export const teamLogo = (abbr) => TEAM_LOGOS[abbr] || '🏈'

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
