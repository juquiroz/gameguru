import { useState, useEffect, useRef, useCallback } from 'react'
import { picksApi } from '../supabase'

export function usePicks(user, league, week) {
  const [picks,     setPicks]     = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)

  // Juegos elegidos localmente en la (liga, semana) actual. Protege las
  // selecciones del usuario de ser pisadas por un loadPicks en vuelo:
  // - `cancelled` descarta resultados de ligas/semanas anteriores (race de
  //   orden en el cambio de liga).
  // - el merge conserva picks locales sobre el snapshot de BD (race del load
  //   de la liga actual con una selección recién hecha).
  const localEdits = useRef(new Set())

  useEffect(() => {
    if (!user || !league || !week) return
    localEdits.current = new Set()
    let cancelled = false
    ;(async () => {
      const { data } = await picksApi.getForWeek(user.id, league.id, week)
      if (cancelled) return
      setPicks(prev => {
        const dbMap = {}
        if (data?.length) {
          data.forEach(r => { if (!localEdits.current.has(r.game_id)) dbMap[r.game_id] = r.pick })
        }
        const local = {}
        for (const gid of localEdits.current) if (prev[gid]) local[gid] = prev[gid]
        return { ...dbMap, ...local }
      })
      setSubmitted(!!data?.length)
    })()
    return () => { cancelled = true }
  }, [user?.id, league?.id, week])

  const selectPick = useCallback((gameId, teamAbbr) => {
    localEdits.current.add(gameId)
    setPicks(prev => ({ ...prev, [gameId]: teamAbbr }))
  }, [])

  const submitPicks = useCallback(async (totalGames) => {
    if (!user || !league) return { error: { message: 'No hay sesión o liga activa.' } }
    if (Object.keys(picks).length < totalGames)
      return { error: { message: 'Selecciona todos los partidos antes de enviar.' } }

    setSaving(true)
    const rows = Object.entries(picks).map(([gameId, pick]) => ({
      user_id:   user.id,
      league_id: league.id,
      week,
      game_id:   gameId,
      pick,
    }))

    const { error } = await picksApi.upsert(rows)
    setSaving(false)
    if (error) return { error }

    setSubmitted(true)
    return { success: true }
  }, [user, league, week, picks])

  return { picks, submitted, saving, selectPick, submitPicks }
}
