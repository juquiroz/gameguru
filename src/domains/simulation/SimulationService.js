// ════════════════════════════════════════════════════════════════════
// SimulationService — fachada de la corrida de simulación (BUILD-TC-006)
//
// Desacoplado de React (igual que GameWeekService/FixtureGeneratorService):
// coordina la corrida (SimulationDirector, máquina interna persistida en
// `game_weeks.simulation_progress`), el motor (MatchSimulator), la
// persistencia de resultados (`league_games` vía setScores) y el cálculo de
// standings (StandingsCalculator). El director devuelve parches; este service
// decide CUÁNDO y los PERSISTE.
//
// Reglas de dominio que viven aquí (ninguna en componentes):
//   - la corrida solo se inicia desde una Game Week `picks_locked`
//   - los picks se leen (getConfirmedPicks) y NUNCA se escriben
//   - los resultados se escriben ÚNICAMENTE en `league_games`
//   - el seed de la corrida = `event.seed` (viaja TC→FG→GW); fallback a una
//     derivada del tiempo (igual que FixtureGeneratorService)
//   - la ejecución es por BATCHES/ticks (no instantánea obligatoria): el
//     orquestador llama runBatch las veces que haga falta
//
// Contrato Game Week ↔ Simulation: consume `{ games }` con `id` (PK de
// league_games, para setScores) y `game_id` (para standings); `{ picks }`
// desde picksService.getConfirmedPicks(leagueId, sessionId).
//
// Persistencia tolerante: degrada a localStorage en `gameguru.sim.<weekId>`
// si la nube falla (mismo patrón que game_weeks / training_sessions).
// ════════════════════════════════════════════════════════════════════

import { gameWeeksApi, leagueGamesApi } from '../../supabase'
import { EVENT_ACTIONS } from '../event/EventDirector'
import { gameWeekDirector } from '../game-week/GameWeekDirector'
import { picksService } from '../game-week/PicksService'
import { simulationDirector, defaultRun, SIMULATION_STATES } from './SimulationDirector'
import { simulateGame } from './MatchSimulator'
import { computeStandings } from './StandingsCalculator'

const LS_SIM = 'gameguru.sim.'
const lsKey = (weekId) => `${LS_SIM}${weekId}`

const readLocalRun = (weekId) => {
  try {
    const raw = localStorage.getItem(lsKey(weekId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const writeLocalRun = (weekId, run) => {
  try { localStorage.setItem(lsKey(weekId), JSON.stringify(run)) } catch { /* noop */ }
}

// Seeder: prioridad a la seed del evento (persistida TC→FG→GW).
const effectiveSeed = (event = {}) =>
  Number(event.seed) >= 0 ? Number(event.seed) : Math.floor(Date.now() % 1_000_000)

// Partidos de la jornada: espera filas con `id` (PK league_games) + `game_id`.
const gamesForWeek = (games) => (Array.isArray(games) ? games : [])

export const simulationService = {
  // Run actual de una jornada (leído de simulation_progress o localStorage).
  getRun(week) {
    const fromCloud = week?.simulation_progress || null
    return defaultRun(fromCloud || readLocalRun(week?.id) || {})
  },

  // Inicia la corrida (picks_locked → simulating) y persiste seed + progreso
  // en `game_weeks`. Devuelve el parche de la SESIÓN (games_in_progress)
  // para que el hook lo aplique vía applyPatch.
  async start(event, week, { games = [], seed } = {}) {
    const total = Math.max(0, gamesForWeek(games).length)
    const runPatch = simulationDirector.dispatch(defaultRun(), EVENT_ACTIONS.SIMULATION_START, { total })
    const run = { ...defaultRun(), ...runPatch }
    const useSeed = seed != null ? Number(seed) : effectiveSeed(event)

    let saved = 'cloud'
    try {
      if (week?.id) {
        const { data, error } = await gameWeeksApi.update(week.id, {
          seed: useSeed,
          simulation_progress: run,
          // Estado público de la jornada: picks_locked → games_in_progress
          // (BUILD-TC-006.2, la simulación arranca en cuanto se bloquean picks).
          state: 'games_in_progress',
        })
        if (error) throw error
      }
    } catch (err) {
      saved = 'local'
      writeLocalRun(week?.id, run)
      console.error('[simulationService.start] no se pudo persistir la corrida en la nube; degradando a local:', err)
    }

    const eventPatch = gameWeekDirector.dispatch(event, EVENT_ACTIONS.SIMULATION_START, { now: new Date() })
    return { run, eventPatch, weekState: 'games_in_progress', seed: useSeed, persisted: saved }
  },

  // Simula un batch de partidos (índices [from, from+count)) y persiste sus
  // resultados en `league_games`. Devuelve el run actualizado + parche de
  // sesión. `onBatch({ results, run })` permite al orquestador reportar.
  //
  // BUILD-TC-006.2 (resume): los partidos ya `finished` del batch se saltan
  // (no se re-simulan ni re-escriben) y el progreso se calcula por el índice
  // más lejano efectivamente simulado, de forma MONOTÓNICA (nunca baja).
  async runBatch(event, week, { games = [], run, seed, from = 0, count = 1, onBatch } = {}) {
    const all = gamesForWeek(games)
    const current = defaultRun(run || this.getRun(week))
    const total = current.progress?.total ?? all.length
    const useSeed = seed != null ? Number(seed)
      : (week?.seed != null ? Number(week.seed) : effectiveSeed(event))
    const start = Math.max(0, Math.min(from, all.length))
    const limit = Math.min(start + Math.max(0, count), all.length)
    const batch = all.slice(start, limit)

    // Persistir SOLO en league_games (nunca en picks). Si un setScores falla,
    // se detiene el batch y el resto queda para el siguiente resume: el
    // progreso nunca reclama partidos no persistidos.
    const persisted = []
    let furthest = start
    for (let i = 0; i < batch.length; i++) {
      const g = batch[i]
      const idx = start + i
      if (g?.finished) { furthest = idx + 1; continue }
      if (!g?.id) continue
      const sim = simulateGame(g, { seed: useSeed, index: idx })
      const { error } = await leagueGamesApi.setScores(
        g.id, sim.home_score, sim.away_score, g.home_abbr, g.away_abbr
      )
      if (error) {
        console.error('[simulationService.runBatch] setScores falló para el partido', g.id, ':', error.message)
        break
      }
      persisted.push({ game: g, ...sim })
      furthest = idx + 1
    }

    const completed = Math.max(current.progress?.completed ?? 0, Math.min(furthest, total))
    const runPatch = simulationDirector.dispatch(current, EVENT_ACTIONS.SIMULATION_PROGRESS, {
      completed,
      total,
    })
    const nextRun = { ...current, ...runPatch }

    try {
      if (week?.id) {
        await gameWeeksApi.update(week.id, {
          simulation_progress: nextRun,
          state: nextRun.state === SIMULATION_STATES.persisting_results ? 'simulation_running' : 'games_in_progress',
        })
      }
    } catch (err) {
      writeLocalRun(week?.id, nextRun)
      console.error('[simulationService.runBatch] no se pudo persistir el progreso:', err)
    }

    if (onBatch) await onBatch({ results: persisted, run: nextRun })

    const eventPatch = gameWeekDirector.dispatch(event, EVENT_ACTIONS.SIMULATION_PROGRESS, { now: new Date() })
    return { results: persisted, run: nextRun, eventPatch }
  },

  // Cierra la corrida: persisting_results → updating_standings → completed,
  // calcula standings (por usuario, con participantes sin pick = 0) y marca
  // la jornada `completed` con `simulated_at`.
  async finalize(event, week, { games = [], picks = [], participants = [], run, resultsPersisted = 0 } = {}) {
    let current = defaultRun(run || this.getRun(week))

    const persistPatch = simulationDirector.dispatch(current, EVENT_ACTIONS.PERSIST_DONE, { results_persisted: resultsPersisted })
    current = { ...current, ...persistPatch }

    const standings = computeStandings({ participants, picks, games })

    const standingsPatch = simulationDirector.dispatch(current, EVENT_ACTIONS.STANDINGS_DONE, { now: new Date() })
    current = { ...current, ...standingsPatch }

    try {
      if (week?.id) {
        await gameWeeksApi.update(week.id, {
          simulation_progress: current,
          state: 'completed',
          simulated_at: new Date().toISOString(),
        })
      }
    } catch (err) {
      writeLocalRun(week?.id, current)
      console.error('[simulationService.finalize] no se pudo persistir el cierre:', err)
    }

    const eventPatch = gameWeekDirector.dispatch(event, EVENT_ACTIONS.COMPLETE_EVENT, { now: new Date() })
    return { run: current, standings, eventPatch }
  },

  // Lectura de picks confirmados de la jornada (punto de integración TC-006).
  async getConfirmedPicks(leagueId, trainingSessionId) {
    return picksService.getConfirmedPicks(leagueId, trainingSessionId)
  },
}
