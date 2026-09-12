import { DEFAULT_SEASON } from './modes'

export const SEASONS = [
  { season: DEFAULT_SEASON, label: '2026', provider: { available: false } },
]

export const getSeason = (season) =>
  SEASONS.find(s => s.season === season) || null

export const providerAvailable = (sport, season = DEFAULT_SEASON, phase = 'regular') => {
  const config = getSeason(season)
  return Boolean(config?.provider?.available)
}
