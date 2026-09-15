import { getLeagueMode } from '../../league/models/modes'
import { DEFAULT_TIMEZONE, isValidTimezone } from '../../league/models/timezone'

// ─── Utilidades puras del Overview de plataforma (SUP-001, read-only) ───────
// Toda métrica vive aquí (dominio), NO en el componente. La consola agrega con
// service/anónimo + claim JWT de platform admin; estas funciones son puras y
// testeables.

export function countBy(list, keyFn) {
  const out = {}
  for (const item of list) {
    const key = keyFn(item)
    out[key] = (out[key] || 0) + 1
  }
  return out
}

const resolveTimezone = (league) =>
  isValidTimezone(league && league.timezone) ? league.timezone : DEFAULT_TIMEZONE

// 'YYYY-MM-DD' del instante `date` visto en la timezone de la liga.
export function dateKeyInTimezone(date, timezone) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
    return parts
  } catch {
    return null
  }
}

// Normaliza game_time (Date | ISO string | number) → Date (instante absoluto).
export function gameTimeToDate(gameTime) {
  if (!gameTime) return null
  if (gameTime instanceof Date) return Number.isNaN(gameTime.getTime()) ? null : gameTime
  const d = new Date(gameTime)
  return Number.isNaN(d.getTime()) ? null : d
}

export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  ERROR: 'error',
}

// Agregados principales del Overview.
export function computeOverviewMetrics(rows = {}) {
  const {
    leagues = [],
    leagueMembers = [],
    pickSubmissions = [],
    profiles = [],
    trainingSessions = [],
    gameWeeks = [],
    leagueGames = [],
    masterGames = [],
    now = new Date(),
  } = rows

  const totalLeagues = leagues.length
  const leaguesBySport = countBy(leagues, (l) => l.sport || 'unknown')
  const leaguesBySeason = countBy(leagues, (l) => l.season || 'unknown')
  const leaguesByMode = countBy(leagues, (l) => getLeagueMode(l))

  const totalUsers = profiles.length

  // Proxy de usuarios activos (no hay last_seen_at): usuario con ≥1 pick
  // submission o ≥1 membresía. Definición de dominio, no del componente.
  const activeUserIds = new Set()
  pickSubmissions.forEach((p) => p && p.user_id && activeUserIds.add(p.user_id))
  leagueMembers.forEach((m) => m && m.user_id && activeUserIds.add(m.user_id))

  // Proxy de ligas activas: ≥1 miembro, ≥1 pick submission, ≥1 game_week o
  // ≥1 training session. Definición de dominio, no del componente.
  const memberCountByLeague = {}
  leagueMembers.forEach((m) => {
    if (m && m.league_id) memberCountByLeague[m.league_id] = (memberCountByLeague[m.league_id] || 0) + 1
  })
  const pickCountByLeague = {}
  pickSubmissions.forEach((p) => {
    if (p && p.league_id) pickCountByLeague[p.league_id] = (pickCountByLeague[p.league_id] || 0) + 1
  })
  const weekCountByLeague = {}
  gameWeeks.forEach((w) => {
    if (w && w.league_id) weekCountByLeague[w.league_id] = (weekCountByLeague[w.league_id] || 0) + 1
  })
  const sessionCountByLeague = {}
  trainingSessions.forEach((s) => {
    if (s && s.league_id) sessionCountByLeague[s.league_id] = (sessionCountByLeague[s.league_id] || 0) + 1
  })

  const activeLeagues = leagues.filter((l) =>
    (memberCountByLeague[l.id] || 0) >= 1 ||
    (pickCountByLeague[l.id] || 0) >= 1 ||
    (weekCountByLeague[l.id] || 0) >= 1 ||
    (sessionCountByLeague[l.id] || 0) >= 1
  ).length

  return {
    totalLeagues,
    leaguesBySport,
    leaguesBySeason,
    leaguesByMode,
    totalUsers,
    activeUsers: activeUserIds.size,
    activeLeagues,
    totalMemberships: leagueMembers.length,
    totalPickSubmissions: pickSubmissions.length,
    totalTrainingSessions: trainingSessions.length,
    totalGameWeeks: gameWeeks.length,
    totalMasterGames: masterGames.length,
    todayGames: computeTodayGames({ leagueGames, leagues, now }).total,
  }
}

// Partidos de HOY (por timezone de cada liga). Suma los partidos de todas las
// ligas cuyo juego cae en la fecha local de hoy en su timezone.
export function computeTodayGames({ leagueGames = [], leagues = [], now = new Date() } = {}) {
  const byLeague = {}
  for (const game of leagueGames) {
    const league = leagues.find((l) => l.id === game.league_id)
    if (!league) continue
    const timezone = resolveTimezone(league)
    const date = gameTimeToDate(game.game_time)
    if (!date) continue
    const key = dateKeyInTimezone(date, timezone)
    if (!key) continue
    const todayKey = dateKeyInTimezone(now, timezone)
    if (key !== todayKey) continue
    if (!byLeague[league.id]) {
      byLeague[league.id] = { leagueId: league.id, name: league.name, timezone, count: 0 }
    }
    byLeague[league.id].count += 1
  }
  return { total: Object.values(byLeague).reduce((n, l) => n + l.count, 0), byLeague }
}

// Resumen de salud de la plataforma (Healthy / Warnings / Errors).
export function computeHealthSummary(rows = {}) {
  const {
    leagues = [],
    leagueGames = [],
    masterGames = [],
    trainingSessions = [],
    gameWeeks = [],
    profiles = [],
  } = rows

  const warnings = []
  const errors = []

  leagues.forEach((l) => {
    const mode = getLeagueMode(l)
    if (mode !== 'practice') {
      const hasGames = leagueGames.some((g) => g.league_id === l.id)
      if (!hasGames) {
        errors.push({ leagueId: l.id, name: l.name, message: 'official_league_without_games' })
      }
    }
  })

  leagues.forEach((l) => {
    const hasWeek = gameWeeks.some((w) => w.league_id === l.id)
    const hasSession = trainingSessions.some((s) => s.league_id === l.id)
    if (!hasWeek && !hasSession) {
      warnings.push({ leagueId: l.id, name: l.name, message: 'league_without_activity' })
    }
  })

  const masterNoTime = masterGames.filter((g) => !g.game_time).length
  if (masterNoTime > 0) {
    warnings.push({ message: 'master_games_without_time', count: masterNoTime })
  }

  const noUsername = profiles.filter((p) => !p.username).length
  if (noUsername > 0) {
    errors.push({ message: 'profiles_without_username', count: noUsername })
  }

  if (errors.length > 0) return { status: HEALTH_STATUS.ERROR, errors, warnings }
  if (warnings.length > 0) return { status: HEALTH_STATUS.WARNING, errors, warnings }
  return { status: HEALTH_STATUS.HEALTHY, errors, warnings }
}
