// BUILD-SUP-003 — Platform User Management (read-only).
// Lógica pura del listado/detalle de usuarios de la consola. Nada de React ni
// Supabase aquí: filtros, búsqueda, ensamblado de índice, métricas, actividad,
// health y participación son funciones puras testeables desde el harness.
// Modelo real (sin inventar columnas): profiles(id, username, is_superadmin,
// platform_role, created_at, updated_at), leagues(admin_id, created_at,
// league_mode, simulation, ...), league_members(user_id, league_id, role,
// joined_at), picks(user_id, created_at, submitted_at).
// FKs reales: league_members→leagues, pick_submissions→profiles. NO existen
// profiles→league_members ni profiles→picks → el listado se arma client-side
// (assembleUserIndex) con reads planos en vez de counts embebidos.
// email / last_login / auth status NO existen en public schema: auth.users no
// es leíble desde el navegador (0 grants) → fuera del MVP (backlog RPC).

import { PLATFORM_ROLES_LIST } from './roles'
import { LEAGUE_MODES_LIST } from '../../league/models/modes'

export const DEFAULT_PAGE_SIZE = 10

export const USER_NO_FILTER = ''

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Filters ─────────────────────────────────────────────────────────────────
// Normaliza/whitelist los filtros aprobados a un objeto seguro con valores
// conocidos. `league_members.role` es el rol DENTRO de una liga y es DISTINTO
// de `platform_role`. NOTA: la BD viva NO tiene FK profiles→league_members ni
// profiles→picks (solo league_members→leagues y pick_submissions→profiles),
// así que los filtros de membresía se evalúan client-side sobre el índice
// ensamblado (assembleUserIndex) en lugar de embebidos PostgREST.
export function applyUserFilters(filters = {}) {
  const {
    platform_role,
    has_leagues,
    has_picks,
    league_role,
    participation_mode,
    simulation,
  } = filters
  const out = {
    platform_role: USER_NO_FILTER,
    has_leagues: USER_NO_FILTER,
    has_picks: USER_NO_FILTER,
    league_role: USER_NO_FILTER,
    participation_mode: USER_NO_FILTER,
    simulation: USER_NO_FILTER,
  }
  if (platform_role && platform_role !== USER_NO_FILTER) {
    out.platform_role = String(platform_role)
  }
  if (has_leagues === 'yes' || has_leagues === 'no') out.has_leagues = has_leagues
  if (has_picks === 'yes' || has_picks === 'no') out.has_picks = has_picks
  if (league_role && league_role !== USER_NO_FILTER) {
    out.league_role = String(league_role)
  }
  if (participation_mode && participation_mode !== USER_NO_FILTER) {
    out.participation_mode = String(participation_mode)
  }
  if (simulation === 'true' || simulation === 'false') out.simulation = String(simulation)
  return out
}

// ─── Search ──────────────────────────────────────────────────────────────────
// Búsqueda case-insensitive por username, o por id exacto cuando el término
// parece un UUID (útil para soporte). Devuelve null si no hay término.
export function searchUsers(term = '') {
  const q = String(term || '').trim()
  if (!q) return null
  if (UUID_RE.test(q)) return { column: 'id', op: 'eq', value: q }
  return { column: 'username', op: 'ilike', value: `%${q}%` }
}

// Aplica la búsqueda sobre las entradas ya ensambladas (misma semántica que
// searchUsers: UUID exacto o substring case-insensitive de username).
export function applyUserSearch(entries = [], term = '') {
  const q = String(term || '').trim()
  if (!q) return entries
  if (UUID_RE.test(q)) return entries.filter((e) => e.id === q)
  const lower = q.toLowerCase()
  return entries.filter((e) => String(e.username || '').toLowerCase().includes(lower))
}

// ─── User index (ensamblado §3) ──────────────────────────────────────────────
// Une las 4 tablas reales (profiles, league_members, leagues, picks) en
// entradas por usuario. La BD no tiene FK profiles→league_members ni
// profiles→picks, así que el listado se arma client-side con 4 reads planos y
// el filtrado/paginación viven en este dominio puro (determinista y testeable).
// "leaguesCount" = nº de ligas DISTINTAS en las que participa (membresías);
// "administers" = ligas donde es admin (leagues.admin_id).
export function assembleUserIndex({ profiles = [], leagueMembers = [], leagues = [], picks = [] } = {}) {
  const leaguesById = new Map()
  ;(leagues || []).forEach((l) => {
    if (l && l.id) leaguesById.set(l.id, l)
  })
  const picksByUser = new Map()
  ;(picks || []).forEach((p) => {
    if (!p || !p.user_id) return
    const arr = picksByUser.get(p.user_id) || []
    arr.push(p)
    picksByUser.set(p.user_id, arr)
  })
  const membershipsByUser = new Map()
  ;(leagueMembers || []).forEach((m) => {
    if (!m || !m.user_id) return
    const arr = membershipsByUser.get(m.user_id) || []
    arr.push(m)
    membershipsByUser.set(m.user_id, arr)
  })
  const ownedByAdmin = new Map()
  ;(leagues || []).forEach((l) => {
    if (!l || !l.admin_id) return
    const arr = ownedByAdmin.get(l.admin_id) || []
    arr.push(l)
    ownedByAdmin.set(l.admin_id, arr)
  })

  return (profiles || [])
    .map((profile) => {
      if (!profile || !profile.id) return null
      const memberships = membershipsByUser.get(profile.id) || []
      const owned = ownedByAdmin.get(profile.id) || []
      const userPicks = picksByUser.get(profile.id) || []
      const memberLeagues = memberships
        .map((m) => leaguesById.get(m.league_id))
        .filter(Boolean)
      const leaguesCount = new Set(memberships.map((m) => m.league_id).filter(Boolean)).size
      const administers = owned.length
      const picksCount = userPicks.length
      const lastActivity = computeLastActivity({ picks: userPicks, ownedLeagues: owned, memberships })
      return {
        id: profile.id,
        username: profile.username || '',
        platform_role: profile.platform_role || 'user',
        is_superadmin: profile.is_superadmin === true,
        created_at: profile.created_at || null,
        profile,
        memberships,
        owned,
        picks: userPicks,
        leaguesCount,
        administers,
        picksCount,
        lastActivity,
        active: isActiveUser({ pickCount: picksCount, administers, leagues: leaguesCount }),
        leagueRoles: new Set(memberships.map((m) => m.role).filter(Boolean)),
        participationModes: new Set(memberLeagues.map((l) => l.league_mode).filter(Boolean)),
        simulations: new Set(memberLeagues.map((l) => l.simulation).filter((s) => s !== null && s !== undefined)),
      }
    })
    .filter(Boolean)
}

// Predicado puro: ¿cumple `entry` TODOS los filtros activos?
export function matchUserFilters(entry, filters = {}) {
  const f = applyUserFilters(filters)
  if (f.platform_role && entry.platform_role !== f.platform_role) return false
  if (f.has_leagues === 'yes' && entry.leaguesCount <= 0) return false
  if (f.has_leagues === 'no' && entry.leaguesCount > 0) return false
  if (f.has_picks === 'yes' && entry.picksCount <= 0) return false
  if (f.has_picks === 'no' && entry.picksCount > 0) return false
  if (f.league_role && !entry.leagueRoles.has(f.league_role)) return false
  if (f.participation_mode && !entry.participationModes.has(f.participation_mode)) return false
  if (f.simulation === 'true' && !entry.simulations.has(true)) return false
  if (f.simulation === 'false' && !entry.simulations.has(false)) return false
  return true
}

// Listado completo: filtros + búsqueda + orden (created_at desc, nulls al
// final) + paginación. Devuelve la página + count total. Escala al MVP con 4
// reads planos; si el número de perfiles crece se podrá pasar a server-side
// (requiere FKs nuevas o RPC de agregación).
export function computeUserList(
  entries = [],
  filters = {},
  search = '',
  { page = 1, pageSize = DEFAULT_PAGE_SIZE } = {},
) {
  const f = applyUserFilters(filters)
  const matched = entries.filter((e) => matchUserFilters(e, f))
  const searched = applyUserSearch(matched, search)
  const sorted = [...searched].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : -Infinity
    const tb = b.created_at ? new Date(b.created_at).getTime() : -Infinity
    return tb - ta
  })
  const p = paginateUsers(sorted, page, pageSize)
  return {
    items: p.items,
    count: p.total,
    page: p.page,
    pageSize: p.pageSize,
    totalPages: p.totalPages,
  }
}

// ─── Pagination ──────────────────────────────────────────────────────────────
// El servidor paginó (count exact + range); `list` aquí es la página.
export function paginateUsers(list = [], page = 1, pageSize = DEFAULT_PAGE_SIZE) {
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

// ─── Opciones de filtros (estáticas, con roles/modos reales) ────────────────
export function buildUserFilterOptions() {
  return {
    platformRoles: PLATFORM_ROLES_LIST,
    leagueRoles: ['admin', 'member'],
    participationModes: LEAGUE_MODES_LIST.map((m) => m.id),
    simulations: ['true', 'false'],
  }
}

// ─── Last activity (definición §6/§12 aprobada) ──────────────────────────────
// Última actividad DERIVADA = GREATEST sobre las fuentes reales aprobadas:
//   picks.submitted_at / picks.created_at (picks del usuario),
//   leagues.created_at (ligas que administra, leagues.admin_id),
//   league_members.joined_at (membresías).
// NO inventa last_login/last_seen. Devuelve Date o null (sin actividad).
export function computeLastActivity({ picks = [], ownedLeagues = [], memberships = [] } = {}) {
  const times = []
  picks.forEach((p) => {
    if (p) {
      if (p.submitted_at) times.push(new Date(p.submitted_at).getTime())
      if (p.created_at) times.push(new Date(p.created_at).getTime())
    }
  })
  ownedLeagues.forEach((l) => {
    if (l && l.created_at) times.push(new Date(l.created_at).getTime())
  })
  memberships.forEach((m) => {
    if (m && m.joined_at) times.push(new Date(m.joined_at).getTime())
  })
  if (times.length === 0) return null
  return new Date(Math.max(...times))
}

// ─── Active User (definición §8 aprobada, derivada) ──────────────────────────
// Activo = ≥1 pick O ≥1 liga administrada (leagues.admin_id) O ≥1 membresía.
// Es un indicador de actividad DERIVADA, no un login timestamp.
export function isActiveUser({ pickCount = 0, administers = 0, leagues = 0 } = {}) {
  return pickCount > 0 || administers > 0 || leagues > 0
}

// ─── User metrics (§4) ────────────────────────────────────────────────────────
// Agrega métricas por usuario sin cargar historial. Soporta dos fuentes:
//   - listado: `leaguesCount`/`picksCount` vienen embebidos (counts) y las
//     fechas de actividad desde las queries de página (sin N+1);
//   - detalle: arrays completos (memberships/ownedLeagues/picks).
export function computeUserMetrics(profile = {}, rows = {}) {
  const { ownedLeagues = [], memberships = [], picks = [] } = rows
  const leagues = typeof rows.leaguesCount === 'number' ? rows.leaguesCount : memberships.length
  const pickCount = typeof rows.picksCount === 'number' ? rows.picksCount : picks.length
  const administers = ownedLeagues.length
  const lastActivity = computeLastActivity({ picks, ownedLeagues, memberships })
  const active = isActiveUser({ pickCount, administers, leagues })
  return { leagues, administers, picks: pickCount, lastActivity, active }
}

// ─── Health flags (§14, derivados y seguros) ─────────────────────────────────
// Solo detectables con datos públicos. No modifica nada.
export function computeUserHealth(profile = {}, rows = {}) {
  const { ownedLeagues = [], memberships = [] } = rows
  const warnings = []
  if (!String(profile.username || '').trim()) {
    warnings.push({ code: 'missing_username', message: 'user_without_username' })
  }
  const legacy = profile.is_superadmin === true
  const role = profile.platform_role || 'user'
  if (legacy && role !== 'platform_superadmin') {
    warnings.push({ code: 'legacy_inconsistent', message: 'legacy_superadmin_without_platform_role' })
  }
  if (!legacy && role === 'platform_superadmin') {
    warnings.push({ code: 'legacy_inconsistent', message: 'platform_superadmin_without_legacy_flag' })
  }
  const adminMemberLeagueIds = new Set(
    memberships.filter((m) => m && m.role === 'admin').map((m) => m.league_id),
  )
  const ownsWithoutMember = ownedLeagues.filter((l) => l && !adminMemberLeagueIds.has(l.id))
  if (ownsWithoutMember.length > 0) {
    warnings.push({
      code: 'admin_without_member_row',
      message: 'league_admin_without_member_row',
      leagueIds: ownsWithoutMember.map((l) => l.id),
    })
  }
  return { warnings }
}

// ─── League participation (§11) ───────────────────────────────────────────────
// Normaliza league_members (con su league embebida) en filas de participación
// listas para display. `role` es el rol DENTRO de la liga.
export function buildLeagueParticipation(membershipRows = []) {
  return (membershipRows || [])
    .map((m) => {
      const league = (m && m.league) || {}
      return {
        leagueId: league.id,
        name: league.name,
        code: league.code,
        mode: league.league_mode,
        sport: league.sport,
        season: league.season,
        simulation: league.simulation,
        timezone: league.timezone,
        role: (m && m.role) || 'member',
        joinedAt: m && m.joined_at,
      }
    })
    .filter((p) => p.leagueId)
}

// ─── Overview card "Usuarios" (§18, métricas eficientes) ─────────────────────
// Métricas agregadas para #/platform a partir de las filas ya agregadas por
// platformApi.overview() (profiles con platform_role, league_members,
// pick_submissions). Sin cargar historial.
export function computeUserOverview(rows = {}) {
  const { profiles = [], leagueMembers = [], pickSubmissions = [] } = rows
  const total = profiles.length
  const withLeagues = new Set(leagueMembers.map((m) => m && m.user_id).filter(Boolean)).size
  const withPicks = new Set(pickSubmissions.map((s) => s && s.user_id).filter(Boolean)).size
  const superAdmins = profiles.filter(
    (p) => p && (p.platform_role === 'platform_superadmin' || p.is_superadmin === true),
  ).length
  return {
    total,
    withLeagues,
    withoutLeagues: total - withLeagues,
    withPicks,
    superAdmins,
  }
}
