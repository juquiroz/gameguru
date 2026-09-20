import { useState, useEffect, useCallback } from 'react'
import { leagueGamesApi } from '../../../supabase'

export function useLeagueData(league) {
  const [leagueGames, setLeagueGames] = useState(null)
  const [loadingGames, setLoadingGames] = useState(true)

  const refresh = useCallback(async () => {
    if (!league) return
    setLoadingGames(true)
    const { data, error } = await leagueGamesApi.getForLeague(league.id)
    if (!error && data?.length) setLeagueGames(data)
    else setLeagueGames(null)
    setLoadingGames(false)
  }, [league])

  useEffect(() => { refresh() }, [refresh])

  return { leagueGames, loadingGames, refresh }
}
