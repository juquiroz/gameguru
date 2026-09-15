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
  const now = Date.now()
  // Default por fechas: la semana en juego es la primera (en orden) cuyo
  // último partido todavía no pasó. Si aún no arrancó la temporada, cae en la
  // primera semana; al cerrar cada semana avanza a la siguiente.
  for (const w of weeks) {
    const wg = games.filter(g => g.week === w)
    if (wg.every(g => g.finished)) continue
    const times = wg
      .map(g => g.game_time || g.time)
      .filter(Boolean)
      .map(t => new Date(t).getTime())
      .filter(t => !isNaN(t))
      .sort((a, b) => a - b)
    const last = times.length ? times[times.length - 1] : null
    if (last == null || now <= last) return w
  }
  return weeks[weeks.length - 1]
}

export const isWeekLocked = (games) => {
  if (!games?.length) return false
  if (games.every(g => g.finished)) return true
  const deadline = getWeekDeadline(games)
  return deadline ? new Date() >= deadline : false
}

// cierre POR PARTIDO (BUILD-016.1): cada juego se bloquea 5 min antes de su
// propio kickoff (o al marcar finished). A diferencia de isWeekLocked (que
// congela la semana entera en el deadline del primer partido), esto permite
// cargar picks de los juegos aún abiertos aunque la semana ya haya arrancado —
// clave para participantes que se suman con la liga iniciada.
export const isGameLocked = (game) => {
  if (!game) return true
  if (game.finished) return true
  const t = game.game_time || game.time
  if (!t) return false
  const time = new Date(t).getTime()
  if (Number.isNaN(time)) return false
  return Date.now() >= time - 5 * 60 * 1000
}

export const localTZOffset = () => {
  const off = -new Date().getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const h = Math.floor(Math.abs(off) / 60)
  const m = Math.abs(off) % 60
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
