import { useState, useEffect, useCallback } from 'react'
import { leaguesApi, membersApi, masterGamesApi, leagueGamesApi } from '../supabase'
import { genInviteCode, NFL_TEAMS } from '../data/nflData'
import { localTZOffset } from '../utils/dates'

export function useLeague(user) {
  const [myLeagues,      setMyLeagues]      = useState([])
  const [currentLeague,  setCurrentLeague]  = useState(null)
  const [loadingLeagues, setLoadingLeagues] = useState(false)

  // Load leagues when user is available
  useEffect(() => {
    if (!user) { setMyLeagues([]); setCurrentLeague(null); return }
    fetchMyLeagues()
  }, [user])

  const fetchMyLeagues = useCallback(async () => {
    if (!user) return
    setLoadingLeagues(true)
    const { data, error } = await leaguesApi.getMyLeagues(user.id)
    if (!error && data) {
      const leagues = data
        .map(row => ({ ...row.leagues, role: row.role }))
        .filter(Boolean)
      setMyLeagues(leagues)
    }
    setLoadingLeagues(false)
  }, [user])

  const createLeague = useCallback(async (name, sport) => {
    if (!user) return { error: { message: 'No hay sesión activa.' } }
    const code = genInviteCode()

    const { data: league, error } = await leaguesApi.create({
      name,
      sport,
      code,
      admin_id: user.id,
      deadline_mode: 'weekly',
    })
    if (error) return { error }

    // Creator joins as admin
    await membersApi.join(league.id, user.id, 'admin')

    // Auto-import master games for this sport/season
    const { data: masterGames, error: mgErr } = await masterGamesApi.getAll(sport, '2026')
    if (mgErr) return { error: { message: `Error al leer juegos maestros: ${mgErr.message}` } }

    if (!masterGames?.length) {
      const newLeague = { ...league, role: 'admin' }
      setMyLeagues(prev => [newLeague, ...prev])
      return { data: newLeague, warning: 'No se encontraron juegos en el calendario maestro. Cargalos desde el panel Super Admin.' }
    }

    const rows = masterGames.map(g => ({
      league_id: league.id,
      master_game_id: g.id,
      sport: g.sport,
      season: g.season,
      week: g.week,
      game_id: g.game_id,
      home_team: g.home_team,
      away_team: g.away_team,
      home_abbr: g.home_abbr,
      away_abbr: g.away_abbr,
      game_time: g.game_time,
    }))

    const { error: insertErr } = await leagueGamesApi.insertAll(rows)
    if (insertErr) {
      return { error: { message: `Error al importar juegos a la liga: ${insertErr.message}` } }
    }

    const newLeague = { ...league, role: 'admin' }
    setMyLeagues(prev => [newLeague, ...prev])
    return { data: newLeague }
  }, [user])

  const createSimulationLeague = useCallback(async (name, games) => {
    if (!user) return { error: { message: 'No hay sesión activa.' } }
    const code = genInviteCode()

    const { data: league, error } = await leaguesApi.create({
      name,
      sport: 'NFL',
      code,
      admin_id: user.id,
      deadline_mode: 'weekly',
      simulation: true,
    })
    if (error) return { error }

    await membersApi.join(league.id, user.id, 'admin')

    const rows = games.map((g, i) => ({
      league_id: league.id,
      master_game_id: null,
      sport: 'NFL',
      season: 'Sim',
      week: g.week || 1,
      game_id: `sim-${i + 1}`,
      home_team: NFL_TEAMS[g.home]?.name || g.home,
      away_team: NFL_TEAMS[g.away]?.name || g.away,
      home_abbr: g.home,
      away_abbr: g.away,
      game_time: `${g.date}T${g.time}:00${localTZOffset()}`,
    }))

    const { error: insertErr } = await leagueGamesApi.insertAll(rows)
    if (insertErr) {
      return { error: { message: `Error al crear juegos: ${insertErr.message}` } }
    }

    const newLeague = { ...league, role: 'admin' }
    setMyLeagues(prev => [newLeague, ...prev])
    return { data: newLeague }
  }, [user])

  const joinByCode = useCallback(async (code) => {
    if (!user) return { error: { message: 'No hay sesión activa.' } }

    // Already a member?
    const existing = myLeagues.find(l => l.code === code.toUpperCase())
    if (existing) return { data: existing, alreadyMember: true }

    const { data: league, error: fetchError } = await leaguesApi.getByCode(code.toUpperCase())
    if (fetchError || !league) return { error: { message: 'Código no válido.' } }

    const { error: joinError } = await membersApi.join(league.id, user.id)
    if (joinError) return { error: joinError }

    const joined = { ...league, role: 'member' }
    setMyLeagues(prev => [joined, ...prev])
    return { data: joined }
  }, [user, myLeagues])

  const enterLeague = useCallback((league) => {
    setCurrentLeague(league)
  }, [])

  const leaveCurrentLeague = useCallback(() => {
    setCurrentLeague(null)
  }, [])

  return {
    myLeagues,
    currentLeague,
    loadingLeagues,
    fetchMyLeagues,
    createLeague,
    createSimulationLeague,
    joinByCode,
    enterLeague,
    leaveCurrentLeague,
  }
}
