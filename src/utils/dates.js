export const getWeekDeadline = (games) => {
  if (!games?.length) return null
  const times = games
    .map(g => g.game_time || g.time)
    .filter(Boolean)
    .map(t => new Date(t))
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b)
  if (times.length === 0) return null
  return new Date(times[0].getTime() - 5 * 60 * 1000)
}

export const getCurrentWeek = (games) => {
  if (!games?.length) return null
  const weeks = [...new Set(games.map(g => g.week))].sort((a, b) => a - b)
  const now = new Date()
  const open = weeks.find(w => {
    const wg = games.filter(g => g.week === w)
    const deadline = getWeekDeadline(wg)
    return !wg.every(g => g.finished) && (!deadline || now < deadline)
  })
  return open ?? weeks[weeks.length - 1]
}

export const isWeekLocked = (games) => {
  if (!games?.length) return false
  if (games.every(g => g.finished)) return true
  const deadline = getWeekDeadline(games)
  return deadline ? new Date() >= deadline : false
}

export const isGameLocked = (game, weekGames) => {
  if (game?.finished) return true
  return isWeekLocked(weekGames)
}

export const localTZOffset = () => {
  const off = -new Date().getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const h = Math.floor(Math.abs(off) / 60)
  const m = Math.abs(off) % 60
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
