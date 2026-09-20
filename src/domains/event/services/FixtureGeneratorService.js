// ════════════════════════════════════════════════════════════════════
// FixtureGeneratorService — genera y persiste el calendario del TC (BUILD-TC-004)
//
// Desacoplado de React: no importa hooks ni componentes. Recibe el evento
// (sesión), genera enfrentamientos deterministas con seed (fixtureCalendar),
// persiste en `league_games` (master_game_id: null) y reporta progreso por
// callback `onProgress({ generated, saved, total })` que el director traduce
// a pasos.
//
// REGLA: este service es el motor; el director (FixtureGenerationDirector)
// solo coordina. La UI nunca conoce esta clase.
// ════════════════════════════════════════════════════════════════════

import { buildCalendar } from './fixtureCalendar'
import { leagueGamesApi } from '../../../supabase'

const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve())

// Limpia partidos `tc-<sessionNo>-*` previos (idempotencia: reload/StrictMode
// no duplican el fixture).
const clearExisting = async (leagueId, sessionNo) => {
  const { data, error } = await leagueGamesApi.getForLeague(leagueId)
  if (error || !data) return
  const prefix = `tc-${sessionNo}-`
  const stale = data.filter(g => typeof g.game_id === 'string' && g.game_id.startsWith(prefix))
  await Promise.all(stale.map(g => leagueGamesApi.removeFromLeague(leagueId, g.game_id)))
}

export const fixtureGeneratorService = {
  // Genera el calendario del evento y lo persiste en league_games.
  // onProgress({ generated, saved, total }) se llama por avance de fase:
  //   generated < total  → generando enfrentamientos (paso generating_fixtures)
  //   generated >= total → guardando partidos (paso saving_matches)
  async generate({ leagueId, event = {}, onProgress, batchSize = 10, stepDelayMs = 60, batchDelayMs = 180 }) {
    const total = Number(event.game_count) || 10
    const seed = Number(event.seed) || Math.floor(Date.now() % 1_000_000)
    const startAt = event.start_at ? new Date(event.start_at) : new Date()
    const sessionNo = event.session_no || 1

    try { await clearExisting(leagueId, sessionNo) } catch { /* best-effort */ }

    const calendar = buildCalendar({ gameCount: total, seed, startAt })
    const games = calendar.map((c, i) => ({
      league_id: leagueId,
      master_game_id: null,
      sport: 'NFL',
      season: 'Sim',
      week: 1,
      game_id: `tc-${sessionNo}-${i + 1}`,
      // Vínculo de la jornada con la sesión (BUILD-TC-005): la Game Week filtra
      // los partidos por training_session_id. Migración 005.2.
      training_session_id: event.id || null,
      home_team: c.home_team,
      away_team: c.away_team,
      home_abbr: c.home,
      away_abbr: c.away,
      game_time: c.game_time,
    }))

    // Fase de generación: compone el calendario y lo reporta por partido.
    for (let i = 0; i < games.length; i++) {
      if (onProgress) await onProgress({ generated: i + 1, saved: 0, total })
      if (i < games.length - 1) await sleep(stepDelayMs)
    }

    // Fase de persistencia: inserta por lotes y reporta el guardado.
    for (let j = 0; j < games.length; j += batchSize) {
      const batch = games.slice(j, j + batchSize)
      const { error } = await leagueGamesApi.insertAll(batch)
      if (error) return { games: [], count: 0, error }
      if (onProgress) await onProgress({ generated: total, saved: Math.min(j + batchSize, total), total })
      if (j + batchSize < games.length) await sleep(batchDelayMs)
    }

    return { games, count: games.length, error: null }
  },
}
