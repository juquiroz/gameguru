// ─── Lógica pura del LeagueContext (PLAN-LEAGUE-CONTEXT, Fase 2) ────────────
// Funciones sin React ni Supabase: testeables desde el harness de regresión.
// El estado de la ruta se deriva con estas reglas:
//   loading   → esperando resolución (nunca pantalla negra)
//   sin liga  → NOT_FOUND (leagueId inexistente en la fuente de datos)
//   con liga, sin membership → DENIED (liga existe, usuario no es miembro)
//   con liga + membership    → READY (permiso)

export const ROUTE_STATE = {
  LOADING: 'loading',
  NOT_FOUND: 'not_found',
  DENIED: 'denied',
  READY: 'ready',
}

export function computeRouteState({ league, membership, loading }) {
  if (loading) return ROUTE_STATE.LOADING
  if (!league) return ROUTE_STATE.NOT_FOUND
  if (!membership) return ROUTE_STATE.DENIED
  return ROUTE_STATE.READY
}

// activeLeagueId derivado: el id de la URL si la ruta es de liga (la URL
// manda); si no, la sugerencia persistida; si no, null.
export function getActiveLeagueId({ route, persistedId }) {
  if (route && route.type === 'league' && route.leagueId) return route.leagueId
  return persistedId || null
}

// Valor del contexto a partir de las piezas. Exponerlo como función pura
// permite testear el contrato del contexto (incluido el passthrough de
// myLeagues → el hub sigue recibiendo TODAS las ligas).
export function buildContextValue({ leaguesState = {}, route, persistedId, resolved, error }) {
  const league = resolved && resolved.league ? resolved.league : null
  const membership = resolved && resolved.membership ? resolved.membership : null
  const loading = !!(resolved && resolved.loading)
  return {
    ...leaguesState,
    route,
    activeLeagueId: getActiveLeagueId({ route, persistedId }),
    league,
    membership,
    loading,
    error: error || null,
    isMember: !!membership,
  }
}
