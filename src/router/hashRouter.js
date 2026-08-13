// ─── MINI-ROUTER por hash (PLAN-LEAGUE-CONTEXT, Fase 1) ─────────────────────
// La URL `#/league/:leagueId/:view` es la fuente de verdad del contexto de
// liga. Sin dependencias (compatible GH Pages, base `/gameguru/`, sin fallback
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
//   '#picks' (legacy)       → { type: 'legacy', page: 'picks' }
//   '#/league'              → { type: 'league', leagueId: null, page: 'dashboard' }
//   '#/league/ABC123'       → { type: 'league', leagueId: 'ABC123', page: 'league' }
//   '#/league/ABC123/picks' → { type: 'league', leagueId: 'ABC123', page: 'picks' }
//   malformada              → { type: 'dashboard' } (fallback seguro)
export function parseHash(hash) {
  const h = normalizeHash(hash)
  if (!h || h === 'dashboard') return { type: 'dashboard' }
  if (h === 'superadmin') return { type: 'superadmin' }
  if (LEGACY.has(h)) return { type: 'legacy', page: h }

  const parts = h.split('/')
  if (parts[0] === 'league') {
    if (!parts[1]) return { type: 'league', leagueId: null, page: 'dashboard' }
    const page = PAGES.has(parts[2]) ? parts[2] : 'league'
    return { type: 'league', leagueId: parts[1], page }
  }
  return { type: 'dashboard' }
}

// buildHash(route) → '#/league/ABC123/picks' (round-trip con parseHash).
// La página por defecto de una ruta de liga es 'league' y se omite en el hash.
export function buildHash(route) {
  if (!route) return '#dashboard'
  if (route.type === 'superadmin') return '#superadmin'
  if (route.type === 'legacy') return `#${route.page}`
  if (route.type === 'league') {
    if (!route.leagueId) return '#/league'
    return route.page && route.page !== 'league'
      ? `#/league/${route.leagueId}/${route.page}`
      : `#/league/${route.leagueId}`
  }
  return '#dashboard'
}
