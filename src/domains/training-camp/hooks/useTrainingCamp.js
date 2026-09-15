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
import {
  activeWeekOf, canRevealNames, isGameDue, isGamePicksLocked, gamesOfWeek,
  stableIndexOfWeek, AUTO_PICK_DEADLINE_MINUTES, leagueSeed,
} from '../autoSchedule'
import { buildLeaderboard } from '../../game-week/simulationView'
import { trainingCampSessionService } from '../services/sessionService'
import { trainingCampWeekService as weekService } from '../services/weekService'
import { trainingCampPicksService as picksService } from '../services/picksService'
import { trainingCampSnapshotService as snapshotService } from '../services/snapshotService'
import { trainingCampAutoScheduleService as autoScheduleService } from '../services/autoScheduleService'
import { trainingCampAutoResultsService as autoResultsService } from '../services/autoResultsService'
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
  const [allPicks, setAllPicks] = useState([])
  const [membersByUser, setMembersByUser] = useState({})
  const [now, setNow] = useState(new Date())
  const [snapshots, setSnapshots] = useState({})
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)

  const freezeRef = useRef(new Set())
  const autoResolvedRef = useRef(new Set())

  // Tick de reloj (para cierre de picks y disparo de snapshot).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const sessionConfig = useMemo(() => {
    if (!session) return { state: null, totalWeeks: 1, currentWeek: 1, scheduleComplete: false, started: false, finished: false, auto: false, seed: null }
    return {
      state: session.state,
      totalWeeks: Number(session.total_weeks) > 0 ? Number(session.total_weeks) : 1,
      currentWeek: Number(session.current_week) > 0 ? Number(session.current_week) : 1,
      scheduleComplete: !!session.schedule_complete,
      started: !!session.started,
      finished: session.state === 'finished',
      auto: !!session.auto,
      seed: session.seed != null ? Number(session.seed) : null,
    }
  }, [session])

  const phase = useMemo(
    () => derivePhase({ ...sessionConfig }),
    [sessionConfig]
  )

  // ── Modo automático (BUILD-TC-V2-AUTO) ─────────────────────────────
  const auto = !!sessionConfig.auto
  const seed = sessionConfig.seed != null
    ? sessionConfig.seed
    : (league?.id ? leagueSeed(league.id) : 1)

  // Semana activa derivada del reloj (solo auto). En manual se usa el
  // current_week persistido.
  const activeWeek = useMemo(
    () => auto ? activeWeekOf({ games, totalWeeks: sessionConfig.totalWeeks }) : sessionConfig.currentWeek,
    [auto, games, sessionConfig.currentWeek, sessionConfig.totalWeeks]
  )
  const effectiveWeek = auto ? activeWeek : sessionConfig.currentWeek

  // Inicios efectivos de cada semana (para la edición de horarios en la
  // fase de invitación del modo auto).
  const currentStarts = useMemo(() => {
    if (!auto) return []
    return Array.from({ length: sessionConfig.totalWeeks }, (_, i) => {
      const s = i + 1
      const wk = gamesOfWeek(games, s).sort((a, b) => new Date(a.game_time) - new Date(b.game_time))
      return wk[0]?.game_time || null
    })
  }, [auto, games, sessionConfig.totalWeeks])

  // ¿Algún juego del campamento ya arrancó? Bloquea regenerar horarios.
  const campStarted = useMemo(() => {
    if (!auto) return false
    return games.some(g => g.game_time && new Date(g.game_time) <= now)
  }, [auto, games, now])

  // Auto-start al primer tip (BUILD-TC-V2-AUTO): el campamento se inicia SOLO
  // cuando llega la hora del primer juego — cierra el roster y habilita la
  // resolución automática de resultados — sin que el admin tenga que pulsar
  // nada. El botón "Comenzar semana 1" sigue existiendo como inicio manual
  // anticipado (opcional).
  useEffect(() => {
    if (!auto || !session?.id) return
    if (sessionConfig.started) return
    if (!campStarted) return
    trainingCampSessionService.update(leagueId, { started: true })
      .then(res => setSession(res.data))
      .catch(() => { /* reintenta en el próximo tick */ })
  }, [auto, session, sessionConfig.started, campStarted, leagueId])

  // Sincroniza current_week en la sesión cuando el reloj avanza la semana
  // (auto-avance). Guard ref para no escribir en bucle.
  const weekSyncRef = useRef(null)
  useEffect(() => {
    if (!auto || !session?.id) return
    if (!sessionConfig.started) return
    if (effectiveWeek === sessionConfig.currentWeek) return
    const key = `${session.id}-${effectiveWeek}`
    if (weekSyncRef.current === key) return
    weekSyncRef.current = key
    trainingCampSessionService.update(leagueId, { current_week: effectiveWeek })
      .then(res => { setSession(res.data) })
      .catch(() => { weekSyncRef.current = null })
  }, [auto, session, effectiveWeek, sessionConfig.currentWeek, leagueId])

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

    // Todos los pick confirmados de la sesión (leaderboard del modo auto).
    if (ses.data?.id) {
      const confirmed = await picksService.getConfirmedPicks(leagueId, ses.data.id, { userId })
      setAllPicks(confirmed.picks)
    }

    // Miembros + perfiles (para leaderboard/snapshot, sin email).
    // try/catch: el builder de Supabase es thenable pero no expone `.catch`.
    let members = { data: [] }
    try {
      members = await leaguesApi.getMembers(leagueId)
    } catch (err) {
      console.error('[trainingCamp] error al leer miembros:', err)
    }
    const userIds = (members.data || []).map(m => m.user_id)
    let profiles = { data: [] }
    try {
      profiles = userIds.length ? await profilesApi.getMany(userIds) : profiles
    } catch (err) {
      console.error('[trainingCamp] error al leer perfiles:', err)
    }
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

  // ── Resolución automática de resultados al tip (BUILD-TC-V2-AUTO) ──
  // Cada tick resuelve los juegos cuyo tip-off ya pasó con el algoritmo
  // determinista (seed + índice estable en la semana) y recarga. Guard por
  // juego para no duplicar; si la persistencia falla se reintenta el tick
  // siguiente (isGameDue sigue true hasta que finished).
  useEffect(() => {
    if (!auto || !session?.id) return
    if (!sessionConfig.started) return
    if (!games || games.length === 0) return
    const due = games.filter(g =>
      isGameDue(g, now) && !autoResolvedRef.current.has(g.id || g.game_id))
    if (due.length === 0) return
    ;(async () => {
      for (const g of due) {
        const key = g.id || g.game_id
        autoResolvedRef.current.add(key)
        const index = stableIndexOfWeek(gamesOfWeek(games, g.week))(g)
        const res = await autoResultsService.resolveGame({ leagueId, game: g, seed, index })
        if (res.error) autoResolvedRef.current.delete(key)
      }
      await reload()
    })()
  }, [auto, session, games, now, seed, leagueId, reload])

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

    // Modo auto: el pick se confirma SOLO para ese juego en el momento de
    // elegirlo (no hay planilla semanal). Bloqueo por juego.
    if (auto) {
      // El board pasa gameId = g.game_id (tc2-...); en la nube la fila tiene
      // además su `id` (uuid) → buscar por AMBOS (antes `x.id || ...`
      // prefería el uuid y nunca encontraba el juego: el pick no se guardaba
      // y el leaderboard quedaba 0/0).
      const g = games.find(x => x.game_id === gameId || x.id === gameId)
      if (g && isGamePicksLocked(g, now)) {
        return { error: { message: 'Este juego ya está cerrado para picks.' } }
      }
      const res = await picksService.confirmPicks({
        user: { id: userId }, league, event: session,
        gameWeekId: null,
        games: [g].filter(Boolean),
        picks: { [gameId]: { pick } },
        week: effectiveWeek,
      })
      if (res.success) {
        const res2 = await picksService.getPicks({ user: { id: userId }, league, event: session })
        setPicks(res2.picks)
        setSubmitted(res2.submitted)
        await reload()
      }
      return res
    }

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
  }, [auto, session, league, userId, games, now, effectiveWeek, sessionConfig.currentWeek, reload])

  const confirmPicks = useCallback(async () => {
    if (!session?.id) return { error: { message: 'Sin sesión activa.' } }
    if (auto) return { error: { message: 'El modo automático confirma cada pick individualmente.' } }
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
  }, [auto, session, league, userId, games, picks, leagueId, sessionConfig.currentWeek])

  // ── Datos derivados por semana ────────────────────────────────────────
  const currentWeekGames = useMemo(
    () => gamesOfWeek(games, effectiveWeek),
    [games, effectiveWeek]
  )

  // En modo manual el deadline es semanal (model). En auto la semana activa
  // va por juego (10 min antes de cada tip-off).
  const deadline = useMemo(
    () => auto ? null : weekDeadline(currentWeekGames),
    [auto, currentWeekGames]
  )

  // Cierres de picks POR JUEGO en modo auto (map game_id → locked).
  const gameLocks = useMemo(() => {
    if (!auto) return null
    const map = {}
    currentWeekGames.forEach(g => {
      map[g.id || g.game_id] = isGamePicksLocked(g, now)
    })
    return map
  }, [auto, currentWeekGames, now])

  const picksLocked = useMemo(() => {
    if (auto) {
      if (currentWeekGames.length === 0) return false
      return currentWeekGames.every(g => !isGamePicksLocked(g, now))
    }
    return isWeekPicksLocked({
      games: currentWeekGames,
      now,
      finished: isWeekComplete(currentWeekGames),
    })
  }, [auto, currentWeekGames, now])

  const weekComplete = useMemo(() => isWeekComplete(currentWeekGames), [currentWeekGames])

  const progress = useMemo(() =>
    ({ done: currentWeekGames.filter(g => g.finished).length, total: currentWeekGames.length }),
  [currentWeekGames])

  const pendingGames = useMemo(() => {
    if (!auto) return []
    return currentWeekGames
      .filter(g => !g.finished)
      .sort((a, b) => new Date(a.game_time) - new Date(b.game_time))
  }, [auto, currentWeekGames])

  // ── Leaderboard del modo auto (BUILD-TC-V2-AUTO) ────────────────────
  // PRIVACY (D2): antes de que termine el último juego de la última semana
  // los jugadores aparecen anónimos ("Jugador #"); al revelar se muestran
  // sus nicknames por liga. Solo cuentan picks confirmados (submitted_at).
  const revealReady = useMemo(
    () => auto && canRevealNames({ games }),
    [auto, games]
  )

  const revealNames = useCallback(() => setRevealed(true), [])
  const resetReveal = useCallback(() => setRevealed(false), [])
  const showRevealed = auto && (revealReady ? revealed : false)

  const leaderboard = useMemo(() => {
    if (!auto) return []
    const wkGames = gamesOfWeek(games, effectiveWeek).filter(g => g.finished)
    if (wkGames.length === 0) return []
    const confirmed = (allPicks || []).filter(p => p.submitted_at)
    const participants = Object.entries(membersByUser).map(([uid, m], i) => ({
      id: uid,
      username: showRevealed ? m.nickname : `Jugador ${i + 1}`,
    }))
    return buildLeaderboard({ participants, picks: confirmed, games: wkGames })
  }, [auto, games, effectiveWeek, allPicks, membersByUser, showRevealed])

  // ── Fin automático (BUILD-TC-V2-AUTO) ───────────────────────────────
  // Cuando TODOS los juegos del campamento terminan (revealReady), la sesión
  // pasa a `finished` sola: la fase deriva a FINISHED y se habilita el botón
  // de revelar nombres. Idempotente (solo si aún no está finished).
  useEffect(() => {
    if (!auto || !session?.id) return
    if (!sessionConfig.started) return
    if (!revealReady || sessionConfig.state === 'finished') return
    trainingCampSessionService.update(leagueId, { state: 'finished' })
      .then(res => setSession(res.data))
      .catch(() => { /* reintenta en el próximo render */ })
  }, [auto, session, revealReady, sessionConfig.state, leagueId])

  // Confirma la semana (cierra picks manualmente, alimenta el snapshot).
  // En modo auto el snapshot se congela automáticamente (efecto abajo).
  const lockWeek = useCallback(async () => {
    if (!session?.id) return
    if (auto) return { snapshot: null, skipped: true }
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
      picks: await (await picksService.getConfirmedPicks(leagueId, session.id, { userId })).picks,
      membersByUser,
    })
    if (frozen.snapshot) {
      setSnapshots(prev => ({ ...prev, [sessionConfig.currentWeek]: frozen.snapshot }))
    }
    setBusy(false)
    return frozen
  }, [auto, session, games, leagueId, sessionConfig.currentWeek, membersByUser, userId])

  // Congelado automático del snapshot cuando `now` cruza el deadline (primer
  // juego iniciado). Idempotente por semana. En auto usa la semana activa.
  useEffect(() => {
    if (!session?.id) return
    const wk = effectiveWeek
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
      const confirmed = await picksService.getConfirmedPicks(leagueId, session.id, { userId })
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
  }, [now, session, games, effectiveWeek, snapshots, leagueId, membersByUser, userId])

  // Avance de semana. En auto el reloj lo hace solo (activeWeek); en manual
  // el admin avanza explicitamente y completa el campamento en la última.
  const goToNextWeek = useCallback(async () => {
    if (auto) return { auto: true }
    if (sessionConfig.currentWeek < sessionConfig.totalWeeks) {
      await setCurrentWeek(sessionConfig.currentWeek + 1)
    } else if (sessionConfig.currentWeek >= sessionConfig.totalWeeks) {
      const res = await trainingCampSessionService.update(leagueId, { state: 'finished' })
      setSession(res.data)
      setPersisted(res.persisted)
    }
    await reload()
  }, [auto, sessionConfig, leagueId, reload, setCurrentWeek])

  // ── Regeneración del calendario (BUILD-TC-V2-AUTO) ──────────────────
  // El admin puede editar el inicio de cada semana mientras ningún juego
  // haya arrancado (fase de invitación). Regenera TODO el calendario de forma
  // idempotente re-anclando cada semana desde sus inicios editados.
  const regenerateWeek = useCallback(async (week, startIso) => {
    if (!auto || !session?.id) return { error: { message: 'Método solo disponible en modo automático.' } }
    if (campStarted) return { error: { message: 'El campamento ya comenzó; no se pueden cambiar los horarios.' } }
    const w = Math.max(1, Math.min(Math.floor(Number(week) || 1), sessionConfig.totalWeeks))
    const raw = [...currentStarts]
    raw[w - 1] = startIso ? new Date(startIso).toISOString() : null
    const starts = raw.map(s => s ? new Date(s).toISOString() : null)
    if (starts.some(s => !s)) return { error: { message: 'Define el inicio de todas las semanas.' } }
    for (let i = 1; i < starts.length; i++) {
      if (new Date(starts[i]) <= new Date(starts[i - 1])) {
        return { error: { message: `La semana ${i + 1} debe empezar después de la semana ${i}.` } }
      }
    }
    const res = await autoScheduleService.generateCalendar({
      league, sessionId: session.id, weekStarts: starts, seed,
    })
    if (!res.error) await reload()
    return res
  }, [auto, session, campStarted, currentStarts, sessionConfig.totalWeeks, league, seed, reload])

  return {
    loading, busy, session, persisted, phase, isAdmin,
    totalWeeks: sessionConfig.totalWeeks,
    currentWeek: effectiveWeek,
    activeWeek,
    scheduleComplete: sessionConfig.scheduleComplete,
    weeklyConfig: sessionConfig,
    games, weeks, currentWeekGames, picks, submitted, allPicks, membersByUser,
    deadline, deadlineMinutes: auto ? AUTO_PICK_DEADLINE_MINUTES : PICK_DEADLINE_MINUTES,
    picksLocked, weekComplete, progress, pendingGames,
    gameLocks, auto, seed, campStarted, currentStarts,
    revealReady, revealed: showRevealed, revealNames, resetReveal, leaderboard,
    snapshots,
    createCamp, setTotalWeeks, markScheduleComplete, startCamp, setCurrentWeek,
    addGame, removeGame, setResult, savePick, confirmPicks, lockWeek, goToNextWeek,
    regenerateWeek,
    reload,
    t,
  }
}
