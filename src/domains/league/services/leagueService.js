import { getLeagueMode, getLeagueSeason } from '../models/modes'

export function hydrateLeague(league) {
  if (!league || typeof league !== 'object') return league
  return {
    ...league,
    mode: getLeagueMode(league),
    season: getLeagueSeason(league),
  }
}
