export const DEFAULT_SEASON = '2026'

export const LEAGUE_MODES = {
  practice:  { id: 'practice',  icon: '🎓', label: 'Práctica' },
  preseason: { id: 'preseason', icon: '🏈', label: 'Pretemporada' },
  regular:   { id: 'regular',   icon: '🏆', label: 'Temporada Oficial' },
}

export const LEAGUE_MODES_LIST = Object.values(LEAGUE_MODES)

export const OFFICIAL_MODES = ['preseason', 'regular']

export const isValidMode = (mode) =>
  mode === 'practice' || mode === 'preseason' || mode === 'regular'

export const isOfficialMode = (mode) => OFFICIAL_MODES.includes(mode)

export const getLeagueMode = (league = {}) => {
  if (isValidMode(league.league_mode)) return league.league_mode
  return league.simulation ? 'practice' : 'regular'
}

export const getLeagueSeason = (league = {}) => league.season || DEFAULT_SEASON
