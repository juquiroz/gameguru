import { useState, useEffect, useMemo } from 'react'
import { leaguesApi, masterGamesApi, picksApi, profilesApi } from '../../../supabase'
import { useLeagueData } from './useLeagueData'
import { getCurrentWeek, getWeekDeadline, isWeekLocked } from '../../../utils/dates'
import { calcStandings } from '../../../utils/standings'

const SEASON = '2026'
const SPORT = 'NFL'

// DashboardState: composer único. Desacopla la UI del dashboard de las fuentes
// (Supabase) y centraliza la lógica de estado del usuario:
//   - sin ligas          → estado de bienvenida (usa el calendario maestro)
//   - con ligas, ninguna activa → "liga destacada" (primera) como contexto
//   - con liga activa    → dashboard completo de BUILD-002
export function useDashboardData({ user, myLeagues, currentLeague }) {
  const leagues = myLeagues || []
  const contextLeague = currentLeague || leagues[0] || null
  const hasLeagues = leagues.length > 0
  const hasCurrentLeague = !!currentLeague

  const { leagueGames, loadingGames, refresh } = useLeagueData(contextLeague)

  const [profile, setProfile] = useState(null)
  const [weekPicks, setWeekPicks] = useState([])
  const [standings, setStandings] = useState([])
  const [streak, setStreak] = useState(0)
  const [memberCounts, setMemberCounts] = useState({})
  const [masterGames, setMasterGames] = useState([])

  // Perfil del usuario (username para el saludo)
  useEffect(() => {
    if (!user?.id) return
    let active = true
    profilesApi.get(user.id).then(({ data }) => {
      if (active) setProfile(data || null)
    })
    return () => { active = false }
  }, [user?.id])

  // Calendario maestro NFL (estado de bienvenida: sin ligas)
  useEffect(() => {
    if (contextLeague) return
    let active = true
    masterGamesApi.getAll(SPORT, SEASON).then(({ data, error }) => {
      if (active && !error) setMasterGames(data || [])
    })
    return () => { active = false }
  }, [contextLeague])

  const sourceGames = contextLeague ? leagueGames : masterGames

  // Semana actual: primera con juego pendiente y deadline no vencido; si toda
  // la temporada terminó, la última semana.
  const currentWeek = useMemo(() => getCurrentWeek(sourceGames), [sourceGames])

  const weekGames = useMemo(
    () => (sourceGames || []).filter(g => g.week === currentWeek),
    [sourceGames, currentWeek]
  )
  const hasWeekGames = weekGames.length > 0

  const deadline = useMemo(() => getWeekDeadline(weekGames), [weekGames])
  const locked = useMemo(() => isWeekLocked(weekGames), [weekGames])

  // Picks del usuario + clasificación de la semana (solo con liga de contexto)
  useEffect(() => {
    if (!contextLeague?.id || currentWeek == null) return
    let active = true
    ;(async () => {
      const myRes = await picksApi.getForWeek(user?.id, contextLeague.id, currentWeek)
      if (active && !myRes.error) setWeekPicks(myRes.data || [])

      const lbRes = await picksApi.getLeaderboard(contextLeague.id, currentWeek)
      const allPicks = lbRes.error ? null : lbRes.data
      let profileMap = {}
      const userIds = allPicks ? [...new Set(allPicks.map(p => p.user_id))] : []
      if (userIds.length) {
        const { data } = await profilesApi.getMany(userIds)
        ;(data || []).forEach(p => { profileMap[p.id] = p.username })
      }
      const scored = weekGames.filter(g => g.finished && g.result)
      if (active) {
        setStandings(allPicks && scored.length ? calcStandings(allPicks, scored, profileMap) : [])
      }
    })()
    return () => { active = false }
  }, [contextLeague?.id, user?.id, currentWeek, weekGames])

  // Racha: semanas consecutivas (hacia atrás) con al menos un acierto
  useEffect(() => {
    if (!contextLeague?.id || !sourceGames?.length) return
    let active = true
    ;(async () => {
      const { data } = await picksApi.getAllForLeague(contextLeague.id)
      if (!active) return
      const byWeek = {}
      ;(data || []).forEach(p => {
        if (p.user_id !== user?.id) return
        if (!byWeek[p.week]) byWeek[p.week] = []
        byWeek[p.week].push(p)
      })
      const weeks = [...new Set(sourceGames.map(g => g.week))].sort((a, b) => a - b)
      let s = 0
      for (let i = weeks.indexOf(currentWeek); i >= 0; i--) {
        const w = weeks[i]
        const results = {}
        sourceGames
          .filter(g => g.week === w && g.finished && g.result)
          .forEach(g => { results[g.game_id] = g.result })
        const correct = (byWeek[w] || [])
          .filter(p => results[p.game_id] && p.pick === results[p.game_id]).length
        if (correct > 0) s++
        else break
      }
      setStreak(s)
    })()
    return () => { active = false }
  }, [contextLeague?.id, user?.id, sourceGames, currentWeek])

  // Conteo de miembros por liga (para "Mis ligas" compacto)
  useEffect(() => {
    if (!leagues.length) { setMemberCounts({}); return }
    let active = true
    ;(async () => {
      const counts = {}
      await Promise.all(leagues.map(async lg => {
        const { data } = await leaguesApi.getMembers(lg.id)
        if (active && data) counts[lg.id] = data.length
      }))
      if (active) setMemberCounts(counts)
    })()
    return () => { active = false }
  }, [leagues])

  const myStanding = useMemo(
    () => standings.find(r => r.userId === user?.id),
    [standings, user?.id]
  )
  const position = myStanding
    ? standings.findIndex(r => r.userId === user?.id) + 1
    : null
  const correctCount = myStanding?.correct || 0
  const pickedCount = weekPicks?.length || 0
  const pendingCount = Math.max(0, weekGames.length - pickedCount)

  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // Juegos de hoy (solo si el game_time es parseable)
  const dayGames = useMemo(() => {
    if (!sourceGames?.length) return []
    const target = ymd(new Date())
    return sourceGames.filter(g => {
      const t = new Date(g.game_time)
      return !isNaN(t) && ymd(t) === target
    })
  }, [sourceGames])

  // Próximos partidos no finalizados
  const upcomingGames = useMemo(() => {
    if (!sourceGames?.length) return []
    const now = new Date()
    return sourceGames
      .filter(g => !g.finished && !isNaN(new Date(g.game_time)) && new Date(g.game_time) > now)
      .sort((a, b) => new Date(a.game_time) - new Date(b.game_time))
      .slice(0, 6)
  }, [sourceGames])

  return {
    user,
    leagues,
    contextLeague,
    hasLeagues,
    hasCurrentLeague,
    profile,
    leagueGames,
    loadingGames,
    refresh,
    masterGames,
    sourceGames,
    currentWeek,
    weekGames,
    hasWeekGames,
    deadline,
    locked,
    weekPicks,
    standings,
    streak,
    memberCounts,
    myStanding,
    position,
    correctCount,
    pickedCount,
    pendingCount,
    dayGames,
    upcomingGames,
    showWelcome: !hasLeagues,
    showLeagueSummary: hasLeagues,
    showPendingAction: !!contextLeague,
    showLeaderboard: !!contextLeague,
    showCountdown: hasCurrentLeague,
  }
}
