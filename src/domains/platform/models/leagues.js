// BUILD-SUP-002 — Platform League Management (read-only).
// Lógica pura del listado/detalle global de ligas de la consola. Nada de
// React ni Supabase aquí: las agregaciones y derivaciones son funciones puras
// testeables desde el harness. Modelo real de `leagues` (sin inventar columnas):
//   id, name, sport, code, admin_id, created_at, deadline_mode, simulation,
//   league_mode, season, timezone.
// NO existen `phase` ni `status` en `leagues`.

import { getLeagueMode, isOfficialMode } from '../../league/models/modes'
import { DEFAULT_TIMEZONE, isValidTimezone } from '../../league/models/timezone'
import { computeTodayGames, gameTimeToDate, HEALTH_STATUS } from './overview'
import { computeStandings } from '../../simulation/StandingsCalculator'

export const DEFAULT_PAGE_SIZE = 10

const UNKNOWN = 'Unknown'

const resolveTimezone = (league) =>
  league && isValidTimezone(league.timezone) ? league.timezone : DEFAULT_TIMEZONE

// Mapa admin_id → username para resolver el owner sin N+1 queries.
export function buildOwnerMap(profiles = []) {
  const map = {}
  profiles.forEach((p) => { if (p && p.id) map[p.id] = p.username || null })
  return map
}

// Fallback seguro si el owner no puede resolverse.
export function ownerName(ownerMap, adminId) {
  if (!adminId || !ownerMap) return UNKNOWN
  return ownerMap[adminId] || UNKNOWN
}

// Filtros aprobados sobre columnas reales de `leagues` (sport, season,
// league_mode, simulation, timezone) + owner resuelto por admin_id.
export function applyLeagueFilters(leagues = [], filters = {}) {
  const { sport, season, league_mode, simulation, timezone, ownerIds } = filters
  return leagues.filter((l) => {
    if (!l) return false
    if (sport && l.sport !== sport) return false
    if (season && l.season !== season) return false
    if (league_mode && l.league_mode !== league_mode) return false
    if (simulation !== undefined && simulation !== null && l.simulation !== simulation) return false
    if (timezone && l.timezone !== timezone) return false
    if (ownerIds && ownerIds.size > 0 && !ownerIds.has(l.admin_id)) return false
    return true
  })
}

// Búsqueda case-insensitive por nombre de liga o username del owner.
export function searchLeagues(leagues = [], ownerMap = {}, query = '') {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return leagues
  return leagues.filter((l) => {
    if (!l) return false
    const name = String(l.name || '').toLowerCase()
    const owner = String(ownerName(ownerMap, l.admin_id)).toLowerCase()
    return name.includes(q) || owner.includes(q)
  })
}

// Paginación pura (page 1-based). El servidor paginó; `list` aquí es la página.
export function paginate(list = [], page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const size = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE
  const p = page > 0 ? page : 1
  const start = (p - 1) * size
  return {
    items: list.slice(start, start + size),
    total: list.length,
    page: p,
    pageSize: size,
    totalPages: Math.max(1, Math.ceil(list.length / size)),
  }
}

// Opciones para los dropdowns de filtros derivadas de datos reales.
export function buildFilterOptions(rows = []) {
  const distinct = (key) => [...new Set(rows.map((r) => r && r[key]).filter(Boolean))].sort()
  return {
    sports: distinct('sport'),
    seasons: distinct('season'),
    modes: distinct('league_mode'),
    timezones: distinct('timezone'),
    simulations: [true, false],
  }
}

// Métricas resumidas de una liga (miembros/juegos/picks + partidos de hoy en
// su timezone). No carga registros: cuenta sobre arrays ya agregados.
export function computeLeagueMetrics(league = {}, rows = {}) {
  const { leagueMembers = [], leagueGames = [], picks = [], now = new Date() } = rows
  const leagueGamesOf = leagueGames.filter((g) => g && g.league_id === league.id)
  const today = computeTodayGames({ leagueGames: leagueGamesOf, leagues: [league], now })
  return {
    members: leagueMembers.filter((m) => m && m.league_id === league.id).length,
    games: leagueGamesOf.length,
    picks: picks.filter((p) => p && p.league_id === league.id).length,
    todayGames: today.total,
  }
}

// Health por liga (calculado, nunca persistido). Mismo criterio que el
// resumen global (overview.js) pero por liga:
//   - liga oficial (preseason/regular) sin league_games → error
//   - sin game_week ni training_session → warning
// practice (Training Camp) genera su fixture, no exige league_games.
export function computeLeagueHealth(league = {}, rows = {}) {
  const { leagueGames = [], gameWeeks = [], trainingSessions = [] } = rows
  const errors = []
  const warnings = []
  const id = league.id
  const mode = getLeagueMode(league)
  const hasGames = leagueGames.some((g) => g && g.league_id === id)
  if (isOfficialMode(mode) && !hasGames) {
    errors.push({ leagueId: id, name: league.name, message: 'official_league_without_games' })
  }
  const hasWeek = gameWeeks.some((w) => w && w.league_id === id)
  const hasSession = trainingSessions.some((s) => s && s.league_id === id)
  if (!hasWeek && !hasSession) {
    warnings.push({ leagueId: id, name: league.name, message: 'league_without_activity' })
  }
  if (errors.length > 0) return { status: HEALTH_STATUS.ERROR, errors, warnings }
  if (warnings.length > 0) return { status: HEALTH_STATUS.WARNING, errors, warnings }
  return { status: HEALTH_STATUS.HEALTHY, errors, warnings }
}

// Standings calculados de la liga (todas las semanas) reutilizando el
// StandingsCalculator existente. No crea tabla standings.
export function buildStandingsForLeague({ members = [], profiles = [], picks = [], games = [] } = {}) {
  const profileMap = buildOwnerMap(profiles)
  const participants = members
    .filter((m) => m && m.user_id)
    .map((m) => ({ id: m.user_id, username: profileMap[m.user_id] || String(m.user_id).slice(0, 8) }))
  return computeStandings({ participants, picks, games })
}

// Resumen útil de picks de la liga (total + por usuario). No es un dashboard.
export function summarizePicks(picks = [], profiles = []) {
  const ownerMap = buildOwnerMap(profiles)
  const byUser = {}
  picks.forEach((p) => {
    if (!p || !p.user_id) return
    byUser[p.user_id] = (byUser[p.user_id] || 0) + 1
  })
  const perUser = Object.entries(byUser)
    .map(([userId, count]) => ({ username: ownerMap[userId] || String(userId).slice(0, 8), count }))
    .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username))
  return { total: picks.length, perUser }
}

// Fecha/instante formateado en la timezone de la liga (display, seguro).
export function formatInTimezone(value, timezone) {
  const d = gameTimeToDate(value)
  if (!d) return '—'
  const tz = timezone && isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }).format(d)
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ')
  }
}
