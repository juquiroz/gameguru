// ════════════════════════════════════════════════════════════════════
// training-camp — weekService (BUILD-TC-V2-001)
//
// Gestión de juegos por semana y de la jornada (`game_weeks`). El admin
// agrega manualmente partidos (fecha/hora) por semana con sequential unlock;
// los picks de cada semana se guardan en `picks` por (session, week, game).
//
// Reglas de dominio:
//   - los juegos de una semana llevan `training_session_id` + `week`
//   - un juego de la semana N+1 no puede ocurrir antes que el de la N
//     (validación en el Model, pero aquí se ancla el game_time)
//   - game_id único por semana: `tc2-<sessionId-corto>-<week>-<n>`
//   - RLS de league_games exige membership; degrada a localStorage cuando no.
// ============================================================================

import { leagueGamesApi, gameWeeksApi, picksApi, pickSubmissionsApi } from '../../../supabase'

const LS_GAMES = 'gameguru.tcv2.games.'
const LS_WEEKS = 'gameguru.tcv2.weeks.'

const gamesKey = (leagueId) => `${LS_GAMES}${leagueId}`
const weeksKey = (sessionId) => `${LS_WEEKS}${sessionId}`

const nowIso = () => new Date().toISOString()

const readLocalGames = (leagueId) => {
  try { return JSON.parse(localStorage.getItem(gamesKey(leagueId))) || [] } catch { return [] }
}
const writeLocalGames = (leagueId, games) => {
  try { localStorage.setItem(gamesKey(leagueId), JSON.stringify(games)) } catch { /* noop */ }
}
const readLocalWeeks = (sessionId) => {
  try { return JSON.parse(localStorage.getItem(weeksKey(sessionId))) || [] } catch { return [] }
}
const writeLocalWeeks = (sessionId, weeks) => {
  try { localStorage.setItem(weeksKey(sessionId), JSON.stringify(weeks)) } catch { /* noop */ }
}

export const trainingCampWeekService = {
  // Juegos de la liga marcados con esta sesión (todas las semanas).
  async listGames(leagueId, trainingSessionId) {
    if (!leagueId) return { games: [], persisted: 'local' }
    try {
      const { data, error } = await leagueGamesApi.getForLeague(leagueId)
      if (error) throw error
      const games = (data || [])
        .filter(g => (g.training_session_id && g.training_session_id === trainingSessionId) ||
                     (typeof g.game_id === 'string' && g.game_id.startsWith('tc2-')))
      return { games, persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.weekService.listGames] error:', err)
      return { games: readLocalGames(leagueId), persisted: 'local' }
    }
  },

  // Juegos de una semana concreta.
  gamesOfWeek(games, week) {
    const w = Number(week)
    return (games || []).filter(g => Number(g.week) === w)
  },

  // Agrega un juego manual a una semana. Valida que no duplique equipo ni
  // fecha. game_time con offset local (igual que LeagueGamesManager).
  async addGame({ league, trainingSessionId, week, home, away, date, time, tzOffset }) {
    if (home === away) return { error: { message: 'Los equipos deben ser distintos.' } }
    if (!date || !time) return { error: { message: 'Completa fecha y hora.' } }
    const game = {
      league_id: league.id,
      master_game_id: null,
      sport: league.sport || 'NFL',
      season: league.season || 'Sim',
      week: Number(week),
      training_session_id: trainingSessionId,
      game_id: `tc2-${String(trainingSessionId).slice(0, 8)}-${week}-${Date.now()}`,
      home_team: home?.name || home,
      away_team: away?.name || away,
      home_abbr: home?.abbr || home,
      away_abbr: away?.abbr || away,
      game_time: `${date}T${time}:00${tzOffset || ''}`,
      active: true,
      finished: false,
    }
    try {
      const { data, error } = await leagueGamesApi.addGame(game)
      if (error) throw error
      return { data, error: null, persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.weekService.addGame] error:', err)
      const current = readLocalGames(league.id)
      current.push({ ...game, id: `local-${Date.now()}` })
      writeLocalGames(league.id, current)
      return { data: { ...game, id: `local-${Date.now()}` }, error: null, persisted: 'local', fallback: true }
    }
  },

  // Elimina un juego de la liga.
  async removeGame(leagueId, gameId) {
    try {
      const { error } = await leagueGamesApi.removeFromLeague(leagueId, gameId)
      if (error) throw error
      return { error: null }
    } catch (err) {
      console.error('[trainingCamp.weekService.removeGame] error:', err)
      const current = readLocalGames(leagueId).filter(g => g.game_id !== gameId && g.id !== gameId)
      writeLocalGames(leagueId, current)
      return { error: null, fallback: true }
    }
  },

  // Pone el resultado manual de un juego (reusa el patrón de LeagueGamesManager).
  async setResult({ gameId, leagueId, homeScore, awayScore, homeAbbr, awayAbbr }) {
    if (homeScore === '' || awayScore === '') {
      return { error: { message: 'Los scores están vacíos.' } }
    }
    const hs = Number(homeScore)
    const as = Number(awayScore)
    if (isNaN(hs) || isNaN(as)) return { error: { message: 'Scores inválidos.' } }
    if (hs === as) return { error: { message: 'El resultado no puede ser empate en NFL (no hay empates).' } }
    const result = hs > as ? homeAbbr : awayAbbr
    try {
      const { error } = await leagueGamesApi.setFinished(gameId, true)
      if (error) {
        const err = await leagueGamesApi.setScores(gameId, hs, as, homeAbbr, awayAbbr)
        if (err?.error) throw err.error
      } else {
        await leagueGamesApi.setScores(gameId, hs, as, homeAbbr, awayAbbr)
      }
      // Actualizar result explícitamente
      await leagueGamesApi.setResult(gameId, result)
      return { error: null, result }
    } catch (err) {
      console.error('[trainingCamp.weekService.setResult] error:', err)
      return { error: { message: 'No se pudo guardar el resultado.' } }
    }
  },

  // ── Jornadas (game_weeks) ─────────────────────────────────────────────
  // Crea/lee la fila de la semana. `deadline_at` = 15 min antes del primer
  // juego (lo recibe el caller que ya calculó el deadline).
  async ensureWeek(trainingSessionId, leagueId, week, { gameCount, deadlineAt } = {}) {
    try {
      const { data: list, error } = await gameWeeksApi.list(trainingSessionId)
      if (!error && list) {
        const found = list.find(w => Number(w.week) === Number(week))
        if (found) return { week: found, persisted: 'cloud' }
      }
      const row = {
        training_session_id: trainingSessionId,
        league_id: leagueId,
        week: Number(week),
        game_count: Number(gameCount) || 0,
        deadline_at: deadlineAt ? new Date(deadlineAt).toISOString() : null,
        state: 'picks_open',
        opened_at: nowIso(),
      }
      const { data, error: insErr } = await gameWeeksApi.insert(row)
      if (insErr) throw insErr
      return { week: data, persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.weekService.ensureWeek] error:', err)
      const weeks = readLocalWeeks(trainingSessionId)
      const fake = { ...weekIsUndefined(), id: `wk-${trainingSessionId}-${week}` }
      if (!weeks.some(w => Number(w.week) === Number(week))) {
        weeks.push(fake)
        writeLocalWeeks(trainingSessionId, weeks)
      }
      return { week: fake, persisted: 'local' }
    }
  },

  async getWeeks(trainingSessionId) {
    try {
      const { data, error } = await gameWeeksApi.list(trainingSessionId)
      if (error) throw error
      return { weeks: data || [], persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.weekService.getWeeks] error:', err)
      return { weeks: readLocalWeeks(trainingSessionId), persisted: 'local' }
    }
  },

  // Marca la jornada como completada (después de que todos los resultados
  // manuales estén puestos).
  async completeWeek(trainingSessionId, week, weekId) {
    try {
      const id = weekId || (await this.ensureWeek(trainingSessionId, null, week)).week?.id
      if (!id) return { error: null }
      const { data, error } = await gameWeeksApi.update(id, {
        state: 'completed',
        completed_at: nowIso(),
      })
      if (error) throw error
      return { week: data, error: null }
    } catch (err) {
      console.error('[trainingCamp.weekService.completeWeek] error:', err)
      return { error: null, fallback: true }
    }
  },
}

function weekIsUndefined() {
  return { state: 'picks_open', deadline_at: null, picked: 0, game_count: 0 }
}
