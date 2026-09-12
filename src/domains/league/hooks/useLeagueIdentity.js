import { useState, useEffect, useMemo } from 'react'
import { leaguesApi, profilesApi } from '../../../supabase'
import { buildLeagueIdentityMap } from '../models/identity'

// BUILD-AUTH-NICK-001 — Resuelve el map de identidad de una liga respetando:
//   - nickname POR LIGA (primary), fallback a profiles.username
//   - real_name oculto salvo cuando league.revealed === true
// Devuelve { displayMap } donde displayMap[userId] = nombre a mostrar.
// Se refresca al cambiar de liga o al variar los userIds solicitados.
export function useLeagueIdentity(league, userIds) {
  const [members, setMembers] = useState([])
  const [cache, setCache] = useState({ profiles: {}, key: null })

  useEffect(() => {
    if (!league?.id) { setMembers([]); setCache({ profiles: {}, key: null }); return }
    let active = true
    leaguesApi.getMembers(league.id).then(({ data }) => {
      if (!active) return
      setMembers(data || [])
    })
    return () => { active = false }
  }, [league?.id])

  useEffect(() => {
    const ids = userIds || []
    if (!ids.length) return
    const key = [...new Set(ids)].sort().join(',')
    if (cache.key === key) return

    let active = true
    profilesApi.getMany(ids).then(({ data }) => {
      if (!active) return
      const byId = {}
      if (data) data.forEach(p => { byId[p.id] = p })
      setCache({ profiles: byId, key })
    })
    return () => { active = false }
  }, [userIds, cache.key])

  const revealed = !!(league && league.revealed)

  const displayMap = useMemo(() => {
    const map = buildLeagueIdentityMap(members, cache.profiles, { revealed })
    const out = {}
    for (const uid of Object.keys(map)) out[uid] = map[uid].display
    return out
  }, [members, cache.profiles, revealed])

  return { displayMap }
}

