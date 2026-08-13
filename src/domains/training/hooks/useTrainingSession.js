import { useState, useEffect, useCallback, useRef } from 'react'
import { leaguesApi, profilesApi } from '../../../supabase'
import { trainingSessionService } from '../services/trainingSessionService'
import { getDerivedPhase } from '../models/states'
import { decorateParticipants, presenceAvailability } from '../models/presence'
import { resolveConfig } from '../models/levels'
import {
  trainingCampDirector,
  fixtureGenerationDirector,
  fixtureGeneratorService,
  gameWeekDirector,
  gameWeekService,
  EVENT_ACTIONS,
  EVENT_TYPES,
} from '../../event'
import {
  simulationService,
  SIMULATION_STATES,
} from '../../simulation'

// Hook de datos de la sesión del evento (BUILD-TC-003 + TC-004).
// Carga estado, miembros y perfiles, y expone acciones de transición que se
// resuelven SIEMPRE a través del EventDirector correspondiente (dispatch).
// El director se elige por `event.event_type`:
//   training_camp        → TrainingCampDirector (avanza por hora con TICK)
//   fixture_generation   → FixtureGenerationDirector (avanza con los progresos
//                          del FixtureGeneratorService, sin React).
// Ningún componente conoce estos directores: solo steps/currentStep/dispatch.
export function useTrainingSession({ leagueId, userId, league }) {
  const [event, setEvent] = useState(null)
  const [persisted, setPersisted] = useState('local')
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => new Date())

  const eventRef = useRef(event)
  useEffect(() => { eventRef.current = event }, [event])

  // Refs de miembros/perfiles para las fases asíncronas (orquestación de la
  // simulación, BUILD-TC-006.2): la corrida lee estos datos cuando la semana
  // llega a picks_locked, no en el render que la dispara.
  const membersRef = useRef(members)
  useEffect(() => { membersRef.current = members }, [members])
  const profilesRef = useRef(profiles)
  useEffect(() => { profilesRef.current = profiles }, [profiles])

  // Director del evento activo, elegido por event_type (contrato EventDirector).
  // training_camp → TrainingCampDirector; fixture_generation → FixtureGenerationDirector;
  // game_week → GameWeekDirector (BUILD-TC-005).
  const directorFor = (ev) =>
    ev?.event_type === EVENT_TYPES.FIXTURE_GENERATION ? fixtureGenerationDirector
      : ev?.event_type === EVENT_TYPES.GAME_WEEK ? gameWeekDirector
        : trainingCampDirector

  // Defensivo (BUILD-TC-004.2): la carga nunca se queda atascada en `loading`.
  // Cada fuente se resuelve de forma aislada (allSettled) y los fallos se
  // degradan a valores vacíos con log descriptivo, nunca lanzando.
  const load = useCallback(async () => {
    if (!leagueId) return
    setLoading(true)
    try {
      const [evRes, membersRes] = await Promise.allSettled([
        trainingSessionService.get(leagueId),
        leaguesApi.getMembers(leagueId),
      ])

      if (evRes.status === 'fulfilled' && evRes.value.data) {
        setEvent(evRes.value.data)
        setPersisted(evRes.value.persisted)
      } else {
        console.error('[useTrainingSession] no se pudo cargar la sesión del evento:', evRes.reason)
        setEvent(null)
      }

      if (membersRes.status === 'fulfilled' && membersRes.value?.data) {
        setMembers(membersRes.value.data)
        const userIds = [...new Set(membersRes.value.data.map(m => m.user_id))]
        try {
          const { data } = await profilesApi.getMany(userIds)
          setProfiles(data || [])
        } catch (err) {
          console.error('[useTrainingSession] no se pudieron cargar los perfiles:', err)
          setProfiles([])
        }
      } else {
        console.error('[useTrainingSession] no se pudieron cargar los miembros:', membersRes.reason)
        setMembers([])
      }
    } catch (err) {
      console.error('[useTrainingSession] error inesperado al cargar la sesión:', err)
      setEvent(null)
    } finally {
      setLoading(false)
    }
  }, [leagueId])

  useEffect(() => { load() }, [load])

  // Tick de 1s: refresca el reloj y deja que el director avance el evento por hora.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Aplica un parche del director: optimista + persistencia (nube o local).
  // Defensivo (BUILD-TC-004.2): la persistencia nunca derriba la UI; si falla
  // se conserva el estado optimista y se loguea de forma descriptiva.
  const applyPatch = useCallback(async (patch) => {
    setEvent(prev => ({ ...(prev || {}), ...patch }))
    try {
      const r = await trainingSessionService.update(leagueId, patch)
      setEvent(r.data)
      setPersisted(r.persisted)
    } catch (err) {
      console.error('[useTrainingSession] fallo al persistir la actualización del evento:', err)
    }
  }, [leagueId])

  // Auto-avance orquestado por el director del evento activo en cada tick.
  useEffect(() => {
    const current = eventRef.current
    if (!current) return
    const patch = directorFor(current).dispatch(current, EVENT_ACTIONS.TICK, { now })
    if (patch) applyPatch(patch)
  }, [now, applyPatch])

  // BUILD-TC-004 — Transición al evento Fixture Generation: cuando el Training
  // Camp finaliza, se crea la sesión `fixture_generation` (el Lobby la muestra
  // sin cambios; el hook elige el director por event_type). Guard ref para
  // que StrictMode / re-renders no creen el evento dos veces.
  const spawnRef = useRef(null)
  useEffect(() => {
    const current = eventRef.current
    if (!current || current.event_type !== EVENT_TYPES.TRAINING_CAMP) return
    if (current.state !== 'finished') return
    const key = current.id || `tc-${current.session_no}`
    if (spawnRef.current === key) return
    spawnRef.current = key
    trainingSessionService.createFixtureEvent(leagueId, {
      name: current.name ? `Fixture · ${current.name}` : '',
      gameCount: current.game_count,
      seed: current.seed,
      startAt: current.start_at,
      level: current.level,
    })
      .then(res => {
        setEvent(res.data)
        setPersisted(res.persisted)
      })
      .catch(err => {
        console.error('[useTrainingSession] fallo al crear el evento Fixture Generation:', err)
        spawnRef.current = null
      })
  }, [event?.state, leagueId])

  // BUILD-TC-004 — Orquestación de la generación: `waiting → START_GENERATION`
  // → `generating_fixtures` → el service genera/persiste reportando progreso
  // (GENERATION_PROGRESS) → `SAVE_COMPLETE` → `completed`. Solo reacciona a
  // estados del evento Fixture Generation; guard ref contra doble ejecución
  // (StrictMode / ticks) y el service limpia partidos previos (idempotencia).
  const generationRunningRef = useRef(false)
  useEffect(() => {
    const current = eventRef.current
    if (!current || current.event_type !== EVENT_TYPES.FIXTURE_GENERATION) return

    if (current.state === 'waiting') {
      const patch = fixtureGenerationDirector.dispatch(current, EVENT_ACTIONS.START_GENERATION, { now })
      if (patch) applyPatch(patch)
      return
    }

    if (current.state !== 'generating_fixtures') return
    if (generationRunningRef.current) return
    generationRunningRef.current = true

    fixtureGeneratorService.generate({
      leagueId,
      event: current,
      onProgress: async ({ generated, saved, total }) => {
        const patch = fixtureGenerationDirector.dispatch(
          eventRef.current,
          EVENT_ACTIONS.GENERATION_PROGRESS,
          { generated, saved, total }
        )
        if (patch) await applyPatch(patch)
      },
    })
      .then(async ({ error }) => {
        const patch = fixtureGenerationDirector.dispatch(
          eventRef.current,
          EVENT_ACTIONS.SAVE_COMPLETE,
          { now }
        )
        if (patch && !error) await applyPatch(patch)
        generationRunningRef.current = false
      })
      .catch(err => {
        console.error('[useTrainingSession] fallo durante la generación de fixtures:', err)
        generationRunningRef.current = false
      })
  }, [now, event?.state, leagueId, applyPatch])

  // BUILD-TC-005 — Transición al evento Game Week: cuando la generación de
  // fixtures termina, se crea la sesión `game_week` (el Lobby la muestra sin
  // cambios; el hook elige el director por event_type). Guard ref para que
  // StrictMode / re-renders no creen el evento dos veces.
  const gwSpawnRef = useRef(null)
  useEffect(() => {
    const current = eventRef.current
    if (!current || current.event_type !== EVENT_TYPES.FIXTURE_GENERATION) return
    if (current.state !== 'completed') return
    const key = current.id || `fg-${current.session_no}`
    if (gwSpawnRef.current === key) return
    gwSpawnRef.current = key
    trainingSessionService.createGameWeekEvent(leagueId, {
      name: current.name ? current.name.replace(/^Fixture\s*·\s*/, '') : '',
      gameCount: current.game_count,
      seed: current.seed,
      startAt: current.start_at,
      level: current.level,
    })
      .then(res => {
        setEvent(res.data)
        setPersisted(res.persisted)
      })
      .catch(err => {
        console.error('[useTrainingSession] fallo al crear el evento Game Week:', err)
        gwSpawnRef.current = null
      })
  }, [event?.state, leagueId])

  // BUILD-TC-005 — Apertura de la jornada: la sesión Game Week nace en
  // `waiting`; aquí se crea la fila `game_weeks` (GameWeekService, idempotente)
  // y se aplica el parche OPEN_WEEK del director (waiting → picks_open).
  // Guard ref contra doble apertura (StrictMode / ticks).
  const weekOpenRef = useRef(null)
  useEffect(() => {
    const current = eventRef.current
    if (!current || current.event_type !== EVENT_TYPES.GAME_WEEK) return
    if (current.state !== 'waiting') return
    const key = current.id || `gw-${current.session_no}`
    if (weekOpenRef.current === key) return
    weekOpenRef.current = key
    gameWeekService.openWeek(current, {})
      .then(async res => {
        if (res?.patch) await applyPatch(res.patch)
      })
      .catch(err => {
        console.error('[useTrainingSession] fallo al abrir la Game Week:', err)
        weekOpenRef.current = null
      })
  }, [event?.state, leagueId, applyPatch])

  // ── BUILD-TC-006.2 — Orquestación de la simulación ─────────────────
  // Cuando la Game Week llega a `picks_locked` (y mientras esté en
  // games_in_progress / simulation_running tras un reload) el SimulationService
  // avanza la corrida por batches deterministas hasta `completed`; luego la
  // jornada queda `completed` (game_weeks) y la sesión `finished`
  // (training_sessions). Sin intervención manual y sin duplicar:
  // guard ref por sesión de jornada (StrictMode / ticks / re-renders).
  //
  // Tamaño de batch según `speed` de la experiencia (demo lento → fast
  // instantáneo); el pacing visual (live) es BUILD-TC-006.3.
  const batchSizeFor = (speed) => ({ demo: 1, normal: 3, fast: 5 })[speed] || 3

  const markSessionFinished = async () => {
    const res = await trainingSessionService.update(leagueId, { state: 'finished' })
    setEvent(res.data)
    setPersisted(res.persisted)
    return res
  }

  // Cierra la corrida: standings (todos los participantes; sin pick → 0) +
  // jornada `completed` + simulated_at + sesión `finished`.
  const runFinalize = async (ev, week, { run }) => {
    const { games } = await gameWeekService.listSessionGames(ev, league?.id)
    const picksRes = await simulationService.getConfirmedPicks(league?.id, ev.id)
    const byProfile = {}
    profilesRef.current.forEach(p => { byProfile[p.id] = p.username || p.id.slice(0, 8) })
    const participants = membersRef.current.map(m => ({
      id: m.user_id,
      username: byProfile[m.user_id] || m.user_id.slice(0, 8),
    }))

    const fin = await simulationService.finalize(ev, week, {
      games,
      picks: picksRes.picks,
      participants,
      run,
      resultsPersisted: run?.progress?.completed ?? 0,
    })
    if (fin.eventPatch) await applyPatch(fin.eventPatch)
    await markSessionFinished()
  }

  // Avanza la simulación por batches hasta que el motor pase a la fase de
  // persistencia (persisting_results); aplica el parche público de cada batch.
  const runBatches = async (ev, week, { games, seed, run, batchSize }) => {
    let currentRun = run
    while (currentRun.state === SIMULATION_STATES.simulating) {
      const before = currentRun.progress?.completed ?? 0
      const res = await simulationService.runBatch(ev, week, {
        games,
        run: currentRun,
        seed,
        from: before,
        count: batchSize,
      })
      if (res.eventPatch) await applyPatch(res.eventPatch)
      currentRun = res.run
      // Defensivo: si el batch no avanzó (setScores fallando en todos los
      // partidos), detener en vez de entrar en bucle; el resume reintentará.
      if (currentRun.state === SIMULATION_STATES.simulating &&
          (currentRun.progress?.completed ?? 0) <= before) {
        console.error('[useTrainingSession] la simulación no avanzó en este batch; se detiene para evitar un bucle:', res)
        break
      }
    }
    if (currentRun.state === SIMULATION_STATES.persisting_results) {
      await runFinalize(ev, week, { run: currentRun })
    }
  }

  // Pasos de la corrida según el progreso persistido (resume / reload).
  const runSimulation = async (ev, { batchSize }) => {
    const { week } = await gameWeekService.getActiveWeek(ev.id)
    if (!week) return
    const { games } = await gameWeekService.listSessionGames(ev, league?.id)
    const run = simulationService.getRun(week)
    const seed = week?.seed != null ? Number(week.seed) : ev.seed

    if (run.state === SIMULATION_STATES.waiting) {
      const started = await simulationService.start(ev, week, { games, seed })
      if (started.eventPatch) await applyPatch(started.eventPatch)
      await runBatches(ev, week, { games, seed, run: started.run, batchSize })
      return
    }
    if (run.state === SIMULATION_STATES.simulating) {
      await runBatches(ev, week, { games, seed, run, batchSize })
      return
    }
    if (run.state === SIMULATION_STATES.persisting_results ||
        run.state === SIMULATION_STATES.updating_standings) {
      await runFinalize(ev, week, { run })
      return
    }
    if (run.state === SIMULATION_STATES.completed) {
      // Revisión idempotente tras reload: la corrida ya terminó, pero puede que
      // el terminal de la sesión (completed/finished) no se haya aplicado.
      const patch = gameWeekDirector.dispatch(ev, EVENT_ACTIONS.COMPLETE_EVENT, { now: new Date() })
      if (patch) await applyPatch(patch)
      if (ev.state !== 'finished') await markSessionFinished()
    }
  }

  // Guard por id de jornada (no por estado): si el mismo disparo se repite
  // (StrictMode monta dos veces el efecto, el tick de 1s, re-renders tras
  // applyPatch), la segunda invocación se descarta; la primera completa la
  // corrida. Un id de jornada distinto (semana futura) re-arranca el guard.
  const simGuardRef = useRef(null)
  useEffect(() => {
    const current = eventRef.current
    if (!current || current.event_type !== EVENT_TYPES.GAME_WEEK) return
    const playable = current.state === 'picks_locked' ||
      current.state === 'games_in_progress' || current.state === 'simulation_running'
    if (!playable) return

    const key = `sim-${current.id}`
    if (simGuardRef.current === key) return
    simGuardRef.current = key

    const speed = resolveConfig({ level: current.level, speed: current.speed }).speed
    runSimulation(current, { batchSize: batchSizeFor(speed) })
      .catch(err => {
        console.error('[useTrainingSession] fallo en la orquestación de la simulación:', err)
        simGuardRef.current = null
      })
  }, [event?.state, event?.event_type, leagueId, applyPatch])

  const isAdmin = !!league && (league.admin_id === userId || league.role === 'admin')

  const director = directorFor(event)
  const currentStep = event ? director.getCurrentStep(event, now) : null
  const phase = (event?.event_type === EVENT_TYPES.FIXTURE_GENERATION || event?.event_type === EVENT_TYPES.GAME_WEEK)
    ? currentStep?.id
    : getDerivedPhase(event, now)
  const remainingMs = event?.start_at ? new Date(event.start_at) - now : null

  const profileMap = {}
  profiles.forEach(p => { profileMap[p.id] = p.username || p.id.slice(0, 8) })
  // BUILD-TC-006.3: los participantes expuestos al GameWeekProvider deben
  // cumplir el contrato `{ id, username }` del leaderboard (StandingsCalculator
  // agrupa por `id`); los miembros RAW vienen con `user_id`, así que se expone
  // `id` explícitamente (TrainingCampParticipants sigue usando `user_id`).
  const participants = decorateParticipants(members, {}).map(m => ({
    ...m,
    id: m.user_id,
    username: profileMap[m.user_id] || m.user_id.slice(0, 8),
  }))

  const openLobby = async () => {
    const patch = directorFor(eventRef.current).dispatch(eventRef.current, EVENT_ACTIONS.OPEN_LOBBY, { now })
    if (patch) await applyPatch(patch)
  }

  const startNow = async () => {
    const patch = directorFor(eventRef.current).dispatch(eventRef.current, EVENT_ACTIONS.START_NOW, { now })
    if (patch) await applyPatch(patch)
  }

  const cancelEvent = async (reason) => {
    const patch = directorFor(eventRef.current).dispatch(eventRef.current, EVENT_ACTIONS.CANCEL, { now, reason })
    if (patch) await applyPatch(patch)
  }

  // BUILD-TC-005.3 — QA/admin: completa el evento de inmediato vía el director
  // (ADVANCE_EVENT, idempotente). Al quedar `finished`, los efectos de spawn
  // existentes disparan Fixture Generation → Game Week → Picks sin duplicar.
  const advanceEvent = async () => {
    const patch = directorFor(eventRef.current).dispatch(eventRef.current, EVENT_ACTIONS.ADVANCE_EVENT, { now })
    if (patch) await applyPatch(patch)
  }

  return {
    event,
    persisted,
    eventType: event?.event_type || EVENT_TYPES.TRAINING_CAMP,
    phase,
    remainingMs,
    participants,
    loading,
    isAdmin,
    now,
    steps: director.getSteps(),
    currentStep,
    lastCompletedStep: event ? director.getLastCompletedStep(event, now) : null,
    fixtureProgress: event?.fixture_progress || null,
    sessionNo: event?.session_no ?? null,
    openLobby,
    startNow,
    cancelEvent,
    advanceEvent,
    applyPatch,
    reload: load,
  }
}

export { presenceAvailability }
