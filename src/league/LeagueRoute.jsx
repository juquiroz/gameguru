// ─── LeagueRoute: guard de membership (PLAN-LEAGUE-CONTEXT, Fase 3) ─────────
// Envuelve cada vista de #/league/:leagueId/... y decide según el estado del
// LeagueContext (resuelto contra la fuente de datos):
//   A) miembro       → renderiza children con { league, membership, isMember }
//   B) no-miembro    → acceso denegado (nunca datos)
//   C) liga inexistente → not found
//   D) cargando      → pantalla de carga (nunca pantalla negra)

import { useLeagueContext } from './context/LeagueContext'
import { computeRouteState, ROUTE_STATE } from './context/leagueResolution'
import { navigate } from '../router/routes'

export function LeagueRoute({ children }) {
  const { loading, league, membership, isMember } = useLeagueContext()
  const state = computeRouteState({ league, membership, loading })

  if (state === ROUTE_STATE.LOADING) return <LeagueLoading />
  if (state === ROUTE_STATE.NOT_FOUND) return <LeagueNotFound />
  if (state === ROUTE_STATE.DENIED) return <LeagueDenied league={league} />

  return typeof children === 'function'
    ? children({ league, membership, isMember })
    : children
}

const pageWrap = (children) => (
  <div className="page">
    {children}
  </div>
)

export function LeagueLoading() {
  return pageWrap(
    <div className="empty-state">
      <div className="big">🏟️</div>
      <div className="spinner" />
      <div>Cargando liga...</div>
    </div>
  )
}

export function LeagueNotFound() {
  return pageWrap(
    <div className="empty-state">
      <div className="big">🔍</div>
      <div>Esta liga no existe o ya no está disponible.</div>
      <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate({ type: 'dashboard' })}>
        Ir al dashboard
      </button>
    </div>
  )
}

export function LeagueDenied({ league }) {
  return pageWrap(
    <div className="empty-state">
      <div className="big">🚫</div>
      <div>
        No tenés acceso a {league && league.name ? `“${league.name}”` : 'esta liga'}.
        Pedile el código de invitación al administrador.
      </div>
      <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate({ type: 'dashboard' })}>
        Ver mis ligas
      </button>
    </div>
  )
}
