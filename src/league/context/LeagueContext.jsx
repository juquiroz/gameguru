// ─── LeagueContext (PLAN-LEAGUE-CONTEXT, Fase 2) ────────────────────────────
// Provider que sincroniza el contexto de liga con la URL (#/league/:id/...).
// - La URL es la fuente de verdad (LeagueRoute valida membership).
// - myLeagues proviene de useLeague (league_members en Supabase).
// - Al entrar a una liga se persiste activeLeagueId SOLO como sugerencia.
// Contrato expuesto:
//   { league, leagueId, membership, loading, error, isMember, setActiveLeague,
//     myLeagues, loadingLeagues, fetchMyLeagues, ...leaguesState, route }

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useHashRoute } from '../../router/useHashRoute'
import { navigate } from '../../router/routes'
import { leaguesApi, membersApi } from '../../supabase'
import { hydrateLeague } from '../../domains/league'
import { loadActiveLeagueId, saveActiveLeagueId } from '../activeLeagueStorage'
import { buildContextValue } from './leagueResolution'

const LeagueContext = createContext(null)

// Los ids de liga son UUID. Un leagueId malformado se resuelve directo a
// NOT_FOUND sin consultar PostgREST (evita 400 invalid uuid en la consola).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function LeagueProvider({ user, leaguesState, children }) {
  const { route, hash } = useHashRoute()

  const myLeagues = leaguesState?.myLeagues || []
  const userId = user?.id || null

  // Sugerencia persistida (LAST KNOWN). Se lee una sola vez al montar.
  const persistedId = useMemo(() => loadActiveLeagueId(), [])

  // Liga objetivo: id de la URL si la ruta es de liga; si no, ninguna.
  const targetId = route && route.type === 'league' ? route.leagueId || null : null

  const [resolved, setResolved] = useState({ league: null, membership: null, loading: false })
  const [error, setError] = useState(null)

  // Resolución de la liga desde la URL. myLeagues primero (ya viene de
  // league_members, membership validada por la fuente). Si no está, se
  // consulta la fuente de datos (getById + getMembership) para distinguir
  // "inexistente" (NOT_FOUND) de "no sos miembro" (DENIED). Guard de
  // cancelación para StrictMode/doble efecto (patrón simGuardRef).
  useEffect(() => {
    if (!targetId) {
      setResolved({ league: null, membership: null, loading: false })
      setError(null)
      return
    }

    let active = true
    setResolved(prev => ({ ...prev, loading: true }))
    setError(null)

    if (!UUID_RE.test(targetId)) {
      setResolved({ league: null, membership: null, loading: false })
      setError('not_found')
      return () => { active = false }
    }

    const member = myLeagues.find(l => l && l.id === targetId)
    if (member) {
      const membership = member.role || 'member'
      setResolved({ league: member, membership, loading: false })
      saveActiveLeagueId(targetId)
      return () => { active = false }
    }

    if (!userId) return () => { active = false }

    ;(async () => {
      const [lg, ms] = await Promise.all([
        leaguesApi.getById(targetId),
        membersApi.getMembership(targetId, userId),
      ])
      if (!active) return
      if (lg && lg.error) {
        setResolved({ league: null, membership: null, loading: false })
        setError('not_found')
        return
      }
      if (!lg || !lg.data) {
        setResolved({ league: null, membership: null, loading: false })
        setError('not_found')
        return
      }
      const league = hydrateLeague(lg.data)
      const membership = (ms && ms.data && ms.data.role) || null
      setResolved({ league, membership, loading: false })
      setError(membership ? null : 'denied')
      if (membership) saveActiveLeagueId(targetId)
    })()

    return () => { active = false }
  }, [targetId, userId, myLeagues])

  // Navegación: entrar a una liga (URL + sugerencia persistida al resolver).
  const setActiveLeague = useCallback((leagueId, page = 'league') => {
    navigate({ type: 'league', leagueId, page })
  }, [])

  const value = useMemo(
    () => buildContextValue({
      leaguesState: { ...leaguesState, setActiveLeague },
      route: { ...route, hash },
      persistedId,
      resolved,
      error,
    }),
    [leaguesState, route, hash, persistedId, resolved, error, setActiveLeague]
  )

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>
}

export function useLeagueContext() {
  const ctx = useContext(LeagueContext)
  if (!ctx) {
    throw new Error('useLeagueContext debe usarse dentro de <LeagueProvider> (patrón useLanguage/useGameWeek).')
  }
  return ctx
}
