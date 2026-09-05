// ─── MINI-ROUTER por hash (PLAN-LEAGUE-CONTEXT, Fase 1) ─────────────────────
// La URL `#/league/:leagueId/:view` es la fuente de verdad del contexto de
// liga. Sin dependencias (compatible GH Pages, base `/`, sin fallback
// SPA). Funciones puras testables desde el harness de regresión.

export const LEGACY_PAGES = ['picks', 'board', 'publicpicks', 'league', 'training']

export const LEAGUE_PAGES = ['picks', 'standings', 'publicpicks', 'training', 'league', 'dashboard']

const LEGACY = new Set(LEGACY_PAGES)
const PAGES = new Set(LEAGUE_PAGES)

// Normaliza un hash: quita '#', espacios y barras redundantes.
export function normalizeHash(hash) {
  if (typeof hash !== 'string') return ''
  return hash.replace(/^#/, '').trim().replace(/^\/+/, '').replace(/\/+$/, '')
}

// parseHash(hash) → Route
//   '#dashboard'            → { type: 'dashboard' }
//   '#superadmin'           → { type: 'superadmin' }
//   '#platform'             → { type: 'platform' } (consola SUP-001)
//   '#/platform/leagues'    → { type: 'platformLeagues' } (SUP-002)
//   '#/platform/leagues/ID' → { type: 'platformLeague', leagueId: 'ID' } (SUP-002)
//   '#/platform/users'      → { type: 'platformUsers' } (SUP-003)
//   '#/platform/users/ID'   → { type: 'platformUser', userId: 'ID' } (SUP-003)
//   '#/platform/reconciliation' → { type: 'platformReconciliation' } (SUP-004)
//   '#/training/audit/HASH' → { type: 'audit', hash: 'HASH' } (BUILD-TC-V2, público)
//   '#picks' (legacy)       → { type: 'legacy', page: 'picks' }
//   '#/league'              → { type: 'league', leagueId: null, page: 'dashboard' }
//   '#/league/ABC123'       → { type: 'league', leagueId: 'ABC123', page: 'league' }
//   '#/league/ABC123/picks' → { type: 'league', leagueId: 'ABC123', page: 'picks' }
//   malformada              → { type: 'dashboard' } (fallback seguro)
export function parseHash(hash) {
  const h = normalizeHash(hash)
  if (!h || h === 'dashboard') return { type: 'dashboard' }
  if (h === 'superadmin') return { type: 'superadmin' }
  if (h === 'platform') return { type: 'platform' }
  if (LEGACY.has(h)) return { type: 'legacy', page: h }

  const parts = h.split('/')
  if (parts[0] === 'platform') {
    if (parts[1] === 'users' && parts[2]) return { type: 'platformUser', userId: parts[2] }
    if (parts[1] === 'users') return { type: 'platformUsers' }
    if (parts[1] === 'leagues' && parts[2]) return { type: 'platformLeague', leagueId: parts[2] }
    if (parts[1] === 'leagues') return { type: 'platformLeagues' }
    if (parts[1] === 'reconciliation') return { type: 'platformReconciliation' }
    return { type: 'platform' }
  }
  if (parts[0] === 'league') {
    if (!parts[1]) return { type: 'league', leagueId: null, page: 'dashboard' }
    const page = PAGES.has(parts[2]) ? parts[2] : 'league'
    return { type: 'league', leagueId: parts[1], page }
  }
  if (parts[0] === 'training' && parts[1] === 'audit' && parts[2]) {
    return { type: 'audit', hash: parts[2] }
  }
  return { type: 'dashboard' }
}

// buildHash(route) → '#/league/ABC123/picks' (round-trip con parseHash).
// La página por defecto de una ruta de liga es 'league' y se omite en el hash.
export function buildHash(route) {
  if (!route) return '#dashboard'
  if (route.type === 'superadmin') return '#superadmin'
  if (route.type === 'platform') return '#platform'
  if (route.type === 'platformLeagues') return '#/platform/leagues'
  if (route.type === 'platformLeague') return `#/platform/leagues/${route.leagueId}`
  if (route.type === 'platformUsers') return '#/platform/users'
  if (route.type === 'platformUser') return `#/platform/users/${route.userId}`
  if (route.type === 'platformReconciliation') return '#/platform/reconciliation'
  if (route.type === 'audit') return route.hash ? `#/training/audit/${route.hash}` : '#/training/audit'
  if (route.type === 'legacy') return `#${route.page}`
  if (route.type === 'league') {
    if (!route.leagueId) return '#/league'
    return route.page && route.page !== 'league'
      ? `#/league/${route.leagueId}/${route.page}`
      : `#/league/${route.leagueId}`
  }
  return '#dashboard'
}
