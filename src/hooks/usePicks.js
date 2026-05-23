import { useState, useEffect, useCallback } from 'react'
import { picksApi } from '../supabase'

export function usePicks(user, league, week) {
  const [picks,     setPicks]     = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (!user || !league || !week) return
    loadPicks()
  }, [user?.id, league?.id, week])

  const loadPicks = useCallback(async () => {
    if (!user || !league) return
    const { data, error } = await picksApi.getForWeek(user.id, league.id, week)
    if (!error && data?.length) {
      const map = {}
      data.forEach(row => { map[row.game_id] = row.pick })
      setPicks(map)
      setSubmitted(true)
    } else {
      setPicks({})
      setSubmitted(false)
    }
  }, [user, league, week])

  const selectPick = useCallback((gameId, teamAbbr) => {
    setPicks(prev => ({ ...prev, [gameId]: teamAbbr }))
  }, [])

  const submitPicks = useCallback(async (totalGames, partial = false) => {
    if (!user || !league) return { error: { message: 'No hay sesión o liga activa.' } }
    if (!partial && Object.keys(picks).length < totalGames)
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

  return { picks, submitted, saving, selectPick, submitPicks, loadPicks }
}
