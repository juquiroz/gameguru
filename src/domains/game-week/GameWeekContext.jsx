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
import { leagueGamesApi, trainingSessionsApi } from '../../supabase'
import { gameWeekService } from './GameWeekService'
import { picksService, PICK_STATUS } from './PicksService'

const GameWeekContext = createContext(null)

// Coincide partidos de la jornada por el vínculo explícito (005.2): los juegos
// fueron generados por la sesión `fixture_generation`, así que se aceptan
// tanto esa sesión generadora como la sesión `game_week` actual (los 08-06
// ligados a mano). Fallback al prefijo `tc-<sessionNo>-` para datos previos a
// la migración.
const sessionGameMatch = (game, ownerIds, sessionNo) =>
  (typeof game.training_session_id === 'string' && ownerIds.has(game.training_session_id)) ||
  (typeof game.game_id === 'string' && sessionNo && game.game_id.startsWith(`tc-${sessionNo}-`))

const normGame = (g) => ({
  ...g,
  id:   g.game_id   || g.id,
  time: g.game_time || g.time,
  aA:   g.away_abbr || g.aA,
  hA:   g.home_abbr || g.hA,
  away: g.away_team || g.away,
  home: g.home_team || g.home,
})

export function GameWeekProvider({ event, league, user, onTransition, children }) {
  const [week, setWeek] = useState(null)
  const [weekPersisted, setWeekPersisted] = useState('local')
  const [games, setGames] = useState([])
  const [picks, setPicks] = useState({})
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
      const [weekRes, gamesRes, picksRes] = await Promise.allSettled([
        gameWeekService.getActiveWeek(event.id),
        (async () => {
          // Owner candidates de los partidos: la sesión `game_week` actual y la
          // sesión `fixture_generation` que generó el calendario (el service los
          // enlaza a la sesión generadora, no a la jornada).
          const ownerIds = new Set([event.id])
          const { data: sessions, error: sessionsErr } = await trainingSessionsApi.list(league?.id)
          if (!sessionsErr && sessions) {
            sessions.forEach(s => { if (s.event_type === 'fixture_generation') ownerIds.add(s.id) })
          }
          const { data, error } = await leagueGamesApi.getForLeague(league?.id)
          if (error) throw error
          return (data || [])
            .filter(g => sessionGameMatch(g, ownerIds, event.session_no))
            .map(normGame)
        })(),
        picksService.getPicks({ user, league, event }),
      ])

      setWeek(weekRes.status === 'fulfilled' ? weekRes.value.week : null)
      setWeekPersisted(weekRes.status === 'fulfilled' ? weekRes.value.persisted : 'local')
      setGames(gamesRes.status === 'fulfilled' ? gamesRes.value : [])
      if (picksRes.status === 'fulfilled') {
        setPicks(picksRes.value.picks)
        setSubmitted(picksRes.value.submitted)
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
  const isCompleted = event?.state === 'completed'
  const isCancelled = event?.state === 'cancelled'

  const pickStatus = (isLocked || isCompleted || submitted)
    ? PICK_STATUS.SUBMITTED
    : (pickCount > 0 ? PICK_STATUS.DRAFT : PICK_STATUS.OPEN)

  const deadlineMs = week?.deadline_at ? new Date(week.deadline_at) - now : null
  const isAdmin = !!league && (league.admin_id === user?.id || league.role === 'admin')

  const value = {
    week, weekPersisted,
    games, requiredGames, picks, pickCount, totalGames, complete,
    pickStatus, isWaiting, isOpen, isLocked, isCompleted, isCancelled,
    deadlineMs, loading, busy, error, isAdmin, now,
    selectPick, confirmPicks, lockWeek, openWeek, reload,
  }

  return <GameWeekContext.Provider value={value}>{children}</GameWeekContext.Provider>
}

export const useGameWeek = () => {
  const ctx = useContext(GameWeekContext)
  if (!ctx) throw new Error('useGameWeek debe usarse dentro de <GameWeekProvider>')
  return ctx
}
