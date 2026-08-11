import { useState, useEffect, useCallback } from 'react'
import { leaguesApi, membersApi, masterGamesApi, leagueGamesApi } from '../supabase'
import { genInviteCode, NFL_TEAMS } from '../data/nflData'
import { localTZOffset } from '../utils/dates'
import { hydrateLeague, canJoinLeague } from '../domains/league'
import { trainingSessionService } from '../domains/training/services/trainingSessionService'

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
        .map(row => hydrateLeague({ ...row.leagues, role: row.role }))
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

    // BUILD-TC-005.4 — Regla central del roster (canJoinLeague, dominio):
    // una liga cuyo último evento ya superó START (TC activo, Fixture
    // Generation, Game Week…) NO acepta nuevos jugadores. La validación vive
    // en la capa de servicio, no solo en la UI; la UI traduce el mensaje por
    // `error.code` (JoinLeagueModal).
    const { data: event } = await trainingSessionService.get(league.id)
    if (!canJoinLeague(event)) {
      return {
        error: {
          code: 'roster_closed',
          message: 'Esta liga ya comenzó y no acepta nuevos jugadores.',
        },
      }
    }

    const { error: joinError } = await membersApi.join(league.id, user.id)
    if (joinError) return { error: joinError }

    const joined = { ...league, role: 'member' }
    setMyLeagues(prev => [joined, ...prev])
    return { data: joined }
  }, [user, myLeagues])

  const enterLeague = useCallback((league) => {
    setCurrentLeague(league)
  }, [])

  // Training Camp (BUILD-TC-001): crea la liga + su evento en un solo paso.
  // Sin generación de partidos: el fixture llega con el Simulation Engine.
  const createTrainingCamp = useCallback(async (name, config = {}) => {
    if (!user) return { error: { message: 'No hay sesión activa.' } }
    const code = genInviteCode()

    const { data: league, error } = await leaguesApi.create({
      name,
      sport: 'NFL',
      code,
      admin_id: user.id,
      deadline_mode: 'weekly',
      simulation: true,
      league_mode: 'practice',
    })
    if (error) return { error }

    await membersApi.join(league.id, user.id, 'admin')

    const { data: event, persisted, fallback } = await trainingSessionService.create(league.id, config)

    const newLeague = { ...league, role: 'admin', league_mode: 'practice' }
    setMyLeagues(prev => [newLeague, ...prev])
    return { data: newLeague, event, persisted, fallback }
  }, [user])

  // Configura/crea el evento de una liga ya existente (lobby → botón admin).
  const configureTrainingCamp = useCallback(async (league, config = {}) => {
    if (!user || !league?.id) return { error: { message: 'No hay liga activa.' } }
    return trainingSessionService.create(league.id, config)
  }, [user])

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
    createTrainingCamp,
    configureTrainingCamp,
    joinByCode,
    enterLeague,
    leaveCurrentLeague,
  }
}
