// ════════════════════════════════════════════════════════════════════
// training-camp — useTrainingCamp (BUILD-TC-V2-001)
//
// Hook de orquestación del Training Camp simple/manual. Carga la sesión v2,
// los juegos por semana, la jornada actual y los picks del usuario. Expone
// acciones puras y datos derivados:
//   - phase (setup / inviting / active / finished)
//   - guardar semana, saltar a la siguiente, marcar schedule completo
//   - manejo de juegos de la semana (agregar / quitar / resultado manual)
//   - picks de la semana (seleccionar / confirmar)
//   - congelar snapshot de auditoría al iniciar el primer juego
// Determinado por un tick `now` para decidir cierre de picks y snapshot.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../../../i18n/context'
import { localTZOffset } from '../../../utils/dates'
import {
  derivePhase, weekDeadline, isWeekPicksLocked, isWeekComplete, PICK_DEADLINE_MINUTES,
} from '../model'
import { trainingCampSessionService } from '../services/sessionService'
import { trainingCampWeekService as weekService } from '../services/weekService'
import { trainingCampPicksService as picksService } from '../services/picksService'
import { trainingCampSnapshotService as snapshotService } from '../services/snapshotService'
import { profilesApi, leaguesApi } from '../../../supabase'

export function useTrainingCamp({ leagueId, userId, league }) {
  const { t } = useLanguage()
  const [session, setSession] = useState(null)
  const [persisted, setPersisted] = useState('local')
  const [loading, setLoading] = useState(true)
  const [games, setGames] = useState([])
  const [weeks, setWeeks] = useState([])
  const [picks, setPicks] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [membersByUser, setMembersByUser] = useState({})
  const [now, setNow] = useState(new Date())
  const [snapshots, setSnapshots] = useState({})
  const [busy, setBusy] = useState(false)

  const freezeRef = useRef(new Set())

  // Tick de reloj (para cierre de picks y disparo de snapshot).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const sessionConfig = useMemo(() => {
    if (!session) return { state: null, totalWeeks: 1, currentWeek: 1, scheduleComplete: false, started: false, finished: false }
    return {
      state: session.state,
      totalWeeks: Number(session.total_weeks) > 0 ? Number(session.total_weeks) : 1,
      currentWeek: Number(session.current_week) > 0 ? Number(session.current_week) : 1,
      scheduleComplete: !!session.schedule_complete,
      started: !!session.started,
      finished: session.state === 'finished',
    }
  }, [session])

  const phase = useMemo(
    () => derivePhase({ ...sessionConfig }),
    [sessionConfig]
  )

  // Carga inicial.
  const reload = useCallback(async () => {
    setLoading(true)
    const ses = await trainingCampSessionService.get(leagueId)
    setSession(ses.data)
    setPersisted(ses.persisted)

    if (ses.data?.id) {
      const [g, w] = await Promise.all([
        weekService.listGames(leagueId, ses.data.id),
        weekService.getWeeks(ses.data.id),
      ])
      setGames(g.games)
      setWeeks(w.weeks)
    }

    if (userId && ses.data?.id) {
      const res = await picksService.getPicks({ user: { id: userId }, league, event: ses.data })
      setPicks(res.picks)
      setSubmitted(res.submitted)
    }

    // Miembros + perfiles (para leaderboard/snapshot, sin email).
    const members = await leaguesApi.getMembers(leagueId).catch(() => ({ data: [] }))
    const userIds = (members.data || []).map(m => m.user_id)
    const profiles = userIds.length ? await profilesApi.getMany(userIds).catch(() => ({ data: [] })) : { data: [] }
    const byProfile = {}
    ;(profiles.data || []).forEach(p => { byProfile[p.id] = p.username })
    const byUser = {}
    ;(members.data || []).forEach(m => {
      byUser[m.user_id] = {
        role: m.role,
        nickname: m.nickname && String(m.nickname).trim() ? m.nickname.trim() : (byProfile[m.user_id] || 'Jugador'),
      }
    })
    setMembersByUser(byUser)

    setLoading(false)
    return ses.data
  }, [leagueId, userId, league])

  useEffect(() => { reload() }, [reload])

  const isAdmin = useMemo(() => {
    const m = membersByUser[userId]
    return !!m && (m.role === 'admin' || m.certified === undefined) && !!league?.admin_id
      ? league.admin_id === userId
      : !!m && m.role === 'admin'
  }, [membersByUser, userId, league])

  // ── Acciones ─────────────────────────────────────────────────────────
  const createCamp = useCallback(async ({ name, totalWeeks }) => {
    setBusy(true)
    const res = await trainingCampSessionService.create(leagueId, { name, totalWeeks })
    setSession(res.data)
    setPersisted(res.persisted)
    setBusy(false)
    return res
  }, [leagueId])

  const setTotalWeeks = useCallback(async (total) => {
    setBusy(true)
    const res = await trainingCampSessionService.update(leagueId, { total_weeks: total, current_week: 1 })
    setSession(res.data)
    setPersisted(res.persisted)
    setBusy(false)
    return res
  }, [leagueId])

  const markScheduleComplete = useCallback(async () => {
    setBusy(true)
    const res = await trainingCampSessionService.update(leagueId, {
      schedule_complete: true,
      current_week: 1,
      state: 'training_camp_v2',
    })
    setSession(res.data)
    setPersisted(res.persisted)
    setBusy(false)
    return res
  }, [leagueId])

  const startCamp = useCallback(async () => {
    setBusy(true)
    const res = await trainingCampSessionService.update(leagueId, { started: true })
    setSession(res.data)
    setPersisted(res.persisted)
    setBusy(false)
    return res
  }, [leagueId])

  const setCurrentWeek = useCallback(async (week) => {
    setBusy(true)
    const res = await trainingCampSessionService.update(leagueId, { current_week: week })
    setSession(res.data)
    setPersisted(res.persisted)
    setBusy(false)
    return res
  }, [leagueId])

  const addGame = useCallback(async ({ week, home, away, date, time }) => {
    if (!session?.id) return { error: { message: 'Sin sesión activa.' } }
    const res = await weekService.addGame({
      league,
      trainingSessionId: session.id,
      week,
      home,
      away,
      date,
      time,
      tzOffset: localTZOffset(),
    })
    if (!res.error) await reload()
    return res
  }, [session, league, reload])

  const removeGame = useCallback(async (gameId) => {
    const res = await weekService.removeGame(leagueId, gameId)
    if (!res.error) await reload()
    return res
  }, [leagueId, reload])

  const setResult = useCallback(async ({ game, homeScore, awayScore }) => {
    const res = await weekService.setResult({
      gameId: game.id,
      leagueId,
      homeScore,
      awayScore,
      homeAbbr: game.home_abbr || game.home_team,
      awayAbbr: game.away_abbr || game.away_team,
    })
    if (!res.error) await reload()
    return res
  }, [leagueId, reload])

  const savePick = useCallback(async ({ gameId, pick }) => {
    if (!session?.id) return
    const res = await picksService.savePick({
      user: { id: userId }, league, event: session, gameId, pick,
      week: sessionConfig.currentWeek,
    })
    if (res.success) {
      const res2 = await picksService.getPicks({ user: { id: userId }, league, event: session })
      setPicks(res2.picks)
      setSubmitted(res2.submitted)
    }
    return res
  }, [session, league, userId, sessionConfig.currentWeek])

  const confirmPicks = useCallback(async () => {
    if (!session?.id) return { error: { message: 'Sin sesión activa.' } }
    const activeGames = weekService.gamesOfWeek(games, sessionConfig.currentWeek)
    const weekRow = await weekService.ensureWeek(
      session.id, leagueId, sessionConfig.currentWeek,
      { gameCount: activeGames.length, deadlineAt: weekDeadline(activeGames) }
    )
    const res = await picksService.confirmPicks({
      user: { id: userId }, league, event: session,
      gameWeekId: weekRow.week?.id, games: activeGames, picks,
    })
    if (res.success) {
      const res2 = await picksService.getPicks({ user: { id: userId }, league, event: session })
      setPicks(res2.picks)
      setSubmitted(res2.submitted)
    }
    return res
  }, [session, league, userId, games, picks, leagueId, sessionConfig.currentWeek])

  // ── Datos derivados por semana ────────────────────────────────────────
  const currentWeekGames = useMemo(
    () => weekService.gamesOfWeek(games, sessionConfig.currentWeek),
    [games, sessionConfig.currentWeek]
  )

  const deadline = useMemo(() => weekDeadline(currentWeekGames), [currentWeekGames])

  const picksLocked = useMemo(() => isWeekPicksLocked({
    games: currentWeekGames,
    now,
    finished: isWeekComplete(currentWeekGames),
  }), [currentWeekGames, now])

  const weekComplete = useMemo(() => isWeekComplete(currentWeekGames), [currentWeekGames])

  const progress = useMemo(() =>
    ({ done: currentWeekGames.filter(g => g.finished).length, total: currentWeekGames.length }),
  [currentWeekGames])

  // Confirma la semana (cierro los picks manualmente, alimento el snapshot).
  const lockWeek = useCallback(async () => {
    if (!session?.id) return
    setBusy(true)
    const activeGames = weekService.gamesOfWeek(games, sessionConfig.currentWeek)
    const weekRow = await weekService.ensureWeek(
      session.id, leagueId, sessionConfig.currentWeek,
      { gameCount: activeGames.length, deadlineAt: weekDeadline(activeGames) }
    )
    const frozen = await snapshotService.freezeWeek({
      leagueId,
      gameWeekId: weekRow.week?.id,
      week: sessionConfig.currentWeek,
      games: activeGames,
      picks: await (await picksService.getConfirmedPicks(leagueId, session.id)).picks,
      membersByUser,
    })
    if (frozen.snapshot) {
      setSnapshots(prev => ({ ...prev, [sessionConfig.currentWeek]: frozen.snapshot }))
    }
    setBusy(false)
    return frozen
  }, [session, games, leagueId, sessionConfig.currentWeek, membersByUser])

  // Congelado automático del snapshot cuando `now` cruza el deadline (primer
  // juego iniciado). Idempotente por semana.
  useEffect(() => {
    if (!session?.id) return
    const wk = sessionConfig.currentWeek
    const activeGames = weekService.gamesOfWeek(games, wk)
    if (activeGames.length === 0) return
    if (snapshots[wk]) return
    // Trigger: el primer juego ya inició (game_time <= now) → freeze.
    const started = activeGames.some(g => {
      const gt = g.game_time
      return gt && new Date(gt) <= now
    })
    if (!started) return
    const key = `${session.id}-${wk}`
    if (freezeRef.current.has(key)) return
    freezeRef.current.add(key)
    weekService.ensureWeek(session.id, leagueId, wk, {
      gameCount: activeGames.length,
      deadlineAt: weekDeadline(activeGames),
    }).then(async (weekRow) => {
      const confirmed = await picksService.getConfirmedPicks(leagueId, session.id)
      const frozen = await snapshotService.freezeWeek({
        leagueId,
        gameWeekId: weekRow.week?.id,
        week: wk,
        games: activeGames,
        picks: confirmed.picks,
        membersByUser,
      })
      if (frozen.snapshot) {
        setSnapshots(prev => ({ ...prev, [wk]: frozen.snapshot }))
      }
    })
  }, [now, session, games, sessionConfig.currentWeek, snapshots, leagueId, membersByUser])

  const goToNextWeek = useCallback(async () => {
    if (sessionConfig.currentWeek < sessionConfig.totalWeeks) {
      await setCurrentWeek(sessionConfig.currentWeek + 1)
    } else if (sessionConfig.currentWeek >= sessionConfig.totalWeeks) {
      const res = await trainingCampSessionService.update(leagueId, { state: 'finished' })
      setSession(res.data)
      setPersisted(res.persisted)
    }
    await reload()
  }, [sessionConfig, leagueId, reload, setCurrentWeek])

  return {
    loading, busy, session, persisted, phase, isAdmin,
    totalWeeks: sessionConfig.totalWeeks,
    currentWeek: sessionConfig.currentWeek,
    scheduleComplete: sessionConfig.scheduleComplete,
    weeklyConfig: sessionConfig,
    games, weeks, currentWeekGames, picks, submitted, membersByUser,
    deadline, deadlineMinutes: PICK_DEADLINE_MINUTES,
    picksLocked, weekComplete, progress,
    snapshots,
    createCamp, setTotalWeeks, markScheduleComplete, startCamp, setCurrentWeek,
    addGame, removeGame, setResult, savePick, confirmPicks, lockWeek, goToNextWeek,
    reload,
    t,
  }
}
