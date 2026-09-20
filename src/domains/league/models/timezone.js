export const DEFAULT_TIMEZONE = 'America/Panama'

export const isValidTimezone = (tz) => {
  if (typeof tz !== 'string' || !tz.trim()) return false
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const detectBrowserTimezone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE
  } catch {
    return DEFAULT_TIMEZONE
  }
}

export const getLeagueTimezone = (league) => {
  if (league && isValidTimezone(league.timezone)) return league.timezone
  return detectBrowserTimezone()
}
