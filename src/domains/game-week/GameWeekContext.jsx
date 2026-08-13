// ════════════════════════════════════════════════════════════════════
// GameWeekContext — adaptador React de la Game Week (BUILD-TC-005)
//
// Único puente entre la UI y el dominio `game-week`. La UI consume estado
// derivado (weekState, PickStatus, contadores) y acciones; NINGUNA regla de
// dominio vive en componentes: todo pasa por GameWeekService / PicksService /
// GameWeekDirector.
//
// Props:
//   event         → sesión game_week (de useTrainingSession)
//   league, user  → contexto de la liga y el jugador
//   onTransition  → applyPatch del hook (persiste el parche del director)
// ════════════════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { gameWeekService } from './GameWeekService'
import { picksService, PICK_STATUS } from './PicksService'
import { buildResultsMap } from '../simulation/StandingsCalculator'
import { getSimulationRun, buildLeaderboard } from './simulationView'
import { getLeagueTimezone } from '../league/models/timezone'

const GameWeekContext = createContext(null)

// Normaliza una fila de league_games para la UI.
const normGame = (g) => ({
  ...g,
  id:   g.game_id   || g.id,
  time: g.game_time || g.time,
  aA:   g.away_abbr || g.aA,
  hA:   g.home_abbr || g.hA,
  away: g.away_team || g.away,
  home: g.home_team || g.home,
})

export function GameWeekProvider({ event, league, user, participants = [], onTransition, children }) {
  const [week, setWeek] = useState(null)
  const [weekPersisted, setWeekPersisted] = useState('local')
  const [games, setGames] = useState([])
  const [picks, setPicks] = useState({})
  const [allPicks, setAllPicks] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [error, setError] = useState(null)

  const eventRef = useRef(event)
  useEffect(() => { eventRef.current = event }, [event])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const reload = useCallback(async () => {
    if (!event || event.event_type !== 'game_week') {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [weekRes, gamesRes, picksRes, allPicksRes] = await Promise.allSettled([
        gameWeekService.getActiveWeek(event.id),
        gameWeekService.listSessionGames(event, league?.id).then(r => r.games.map(normGame)),
        picksService.getPicks({ user, league, event }),
        picksService.getConfirmedPicks(league?.id, event.id),
      ])

      setWeek(weekRes.status === 'fulfilled' ? weekRes.value.week : null)
      setWeekPersisted(weekRes.status === 'fulfilled' ? weekRes.value.persisted : 'local')
      setGames(gamesRes.status === 'fulfilled' ? gamesRes.value : [])
      if (picksRes.status === 'fulfilled') {
        setPicks(picksRes.value.picks)
        setSubmitted(picksRes.value.submitted)
      }
      if (allPicksRes.status === 'fulfilled') {
        setAllPicks(allPicksRes.value.picks || [])
      }
      setError(null)
    } catch (err) {
      console.error('[GameWeekContext] error al cargar la jornada:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [event, league, user])

  useEffect(() => { reload() }, [reload])

  // Apertura de la jornada: la orquesta el hook (useTrainingSession) cuando el
  // evento Game Week nace de Fixture Generation (`waiting → OPEN_WEEK`). Este
  // método queda expuesto como retry manual (idempotente); NO se auto-invoca
  // aquí para que la creación de la fila `game_weeks` tenga un único escritor.
  const openWeek = useCallback(async () => {
    const ev = eventRef.current
    if (!ev) return
    setBusy(true)
    try {
      const res = await gameWeekService.openWeek(ev, {})
      if (res?.patch && onTransition) await onTransition(res.patch)
      if (res?.week) setWeek(res.week)
      if (res?.persisted) setWeekPersisted(res.persisted)
    } catch (err) {
      console.error('[GameWeekContext] no se pudo abrir la jornada:', err)
      setError(err)
    } finally {
      setBusy(false)
      await reload()
    }
  }, [onTransition, reload])

  // Guardar/actualizar pick (la ventana debe estar abierta; valida PicksService).
  const selectPick = useCallback(async (gameId, abbr) => {
    const ev = eventRef.current
    if (!picksService.isWindowOpen(ev)) return { error: { message: 'La jornada está cerrada.' } }
    setPicks(prev => ({ ...prev, [gameId]: abbr }))
    return picksService.savePick({ user, league, event: ev, gameId, pick: abbr })
  }, [user, league])

  // Confirmación final de la planilla. Si todos confirmaron → bloqueo
  // all_submitted (decisión de dominio en PicksService + GameWeekService).
  const confirmPicks = useCallback(async () => {
    const ev = eventRef.current
    if (!week) return { error: { message: 'No hay jornada activa.' } }
    const res = await picksService.confirmPicks({
      user,
      league,
      event: ev,
      gameWeekId: week.id,
      games: games.map(g => ({ id: g.id })),
      picks,
    })
    if (res.error) return res
    setSubmitted(true)
    if (res.allSubmitted) {
      const lock = await gameWeekService.lockWeek(ev, { reason: 'all_submitted', gameWeekId: week.id })
      if (lock?.patch && onTransition) await onTransition(lock.patch)
      if (lock?.week) setWeek(lock.week)
    }
    return res
  }, [user, league, week, games, picks, onTransition])

  // Bloqueo manual del admin (decisión PLAN-TC-005).
  const lockWeek = useCallback(async (reason = 'admin') => {
    const ev = eventRef.current
    if (!week) return { error: { message: 'No hay jornada activa.' } }
    const res = await gameWeekService.lockWeek(ev, { reason, gameWeekId: week.id })
    if (res?.patch && onTransition) await onTransition(res.patch)
    if (res?.week) setWeek(res.week)
    return res
  }, [week, onTransition])

  // ── Estado derivado (WeekState / PickStatus) ──
  const requiredGames = games.filter(g => g.active !== false)
  const totalGames = requiredGames.length
  const pickCount = requiredGames.filter(g => picks[g.id]).length
  const { complete } = picksService.validateComplete(requiredGames.map(g => ({ id: g.id })), picks)

  const isWaiting   = event?.state === 'waiting'
  const isOpen      = event?.state === 'picks_open'
  const isLocked    = event?.state === 'picks_locked'
  // BUILD-TC-006.2: al finalizar, la jornada queda `completed` (game_weeks) y
  // la sesión `finished` (training_sessions, estado terminal del ciclo TC);
  // ambos se consideran fin de la Game Week para la UI.
  const isCompleted = event?.state === 'completed' || event?.state === 'finished'
  const isCancelled = event?.state === 'cancelled'
  // BUILD-TC-006.3: la simulación corre entre el lock y el final; mientras
  // está activa NO se editan picks y se muestra el progreso en vivo.
  const isSimulating = event?.state === 'games_in_progress' || event?.state === 'simulation_running'

  const pickStatus = (isLocked || isCompleted || submitted)
    ? PICK_STATUS.SUBMITTED
    : (pickCount > 0 ? PICK_STATUS.DRAFT : PICK_STATUS.OPEN)

  const deadlineMs = week?.deadline_at ? new Date(week.deadline_at) - now : null
  const isAdmin = !!league && (league.admin_id === user?.id || league.role === 'admin')

  // BUILD-TC-006.3 — Estado derivado de la simulación (proyecciones puras,
  // sin recalcular en React): run interno, mapa de resultados por partido
  // (para el feedback ✓/✗ de GameCard) y leaderboard por usuario.
  const simRun = getSimulationRun(week)
  const resultsMap = buildResultsMap(games)
  const standings = buildLeaderboard({ participants, picks: allPicks, games })

  const value = {
    week, weekPersisted,
    games, requiredGames, picks, pickCount, totalGames, complete,
    pickStatus, isWaiting, isOpen, isLocked, isCompleted, isCancelled, isSimulating,
    deadlineMs, loading, busy, error, isAdmin, now,
    participants, allPicks, simRun, resultsMap, standings, myUserId: user?.id,
    // PLAN-LEAGUE-CONTEXT-01.1: liga y evento expuestos para la identidad de
    // liga siempre visible (LeagueIdentity) dentro de la jornada.
    league, event,
    // BUILD-TZ-003: timezone oficial de la liga para el display de horas.
    timezone: getLeagueTimezone(league),
    selectPick, confirmPicks, lockWeek, openWeek, reload,
  }

  return <GameWeekContext.Provider value={value}>{children}</GameWeekContext.Provider>
}

export const useGameWeek = () => {
  const ctx = useContext(GameWeekContext)
  if (!ctx) throw new Error('useGameWeek debe usarse dentro de <GameWeekProvider>')
  return ctx
}
