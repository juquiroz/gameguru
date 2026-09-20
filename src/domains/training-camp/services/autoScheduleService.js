// ════════════════════════════════════════════════════════════════════
// training-camp — autoScheduleService (BUILD-TC-V2-AUTO)
//
// Genera y persiste el calendario automático del Training Camp (ligas
// practice + simulation). Idempotente: regenerar borra los juegos `tc2-`
// de la sesión y vuelve a insertarlos, re-anclando el calendario desde
// los inicios de semana elegidos por el admin. Degrada a localStorage
// igual que el resto del dominio si la migración no está aplicada.
// ════════════════════════════════════════════════════════════════════

import { leagueGamesApi } from '../../../supabase'
import { NFL_TEAMS } from '../../../data/nflData.js'
import { buildCalendar, stableIndexOfWeek, gamesOfWeek } from '../autoSchedule.js'

const LS_GAMES = 'gameguru.tcv2.games.'
const gamesKey = (leagueId) => `${LS_GAMES}${leagueId}`

const readLocalGames = (leagueId) => {
  try { return JSON.parse(localStorage.getItem(gamesKey(leagueId))) || [] } catch { return [] }
}
const writeLocalGames = (leagueId, games) => {
  try { localStorage.setItem(gamesKey(leagueId), JSON.stringify(games)) } catch { /* noop */ }
}

const tc2Prefix = (sessionId) => `tc2-${String(sessionId).slice(0, 8)}`

const isSessionGame = (g, sessionId) =>
  (g.training_session_id && g.training_session_id === sessionId) ||
  (typeof g.game_id === 'string' && g.game_id.startsWith(tc2Prefix(sessionId)))

export const trainingCampAutoScheduleService = {
  // Borra los juegos generados de una sesión (idempotente).
  async deleteSessionGames(leagueId, sessionId) {
    try {
      const { error } = await leagueGamesApi.deleteSessionGames(leagueId, sessionId)
      if (error) throw error
      return { error: null, persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.autoSchedule.deleteSessionGames] error:', err)
      const current = readLocalGames(leagueId).filter(g => !isSessionGame(g, sessionId))
      writeLocalGames(leagueId, current)
      return { error: null, persisted: 'local', fallback: true }
    }
  },

  // Genera el calendario completo (5 juegos por semana, +5 min, matchup
  // aleatorio único por semana) y lo persiste. Quita los previos primero.
  async generateCalendar({ league, sessionId, weekStarts = [], seed }) {
    if (!league?.id || !sessionId) return { error: { message: 'Faltan datos del campamento.' } }
    const starts = (weekStarts || []).filter(Boolean)
    if (starts.length === 0) return { error: { message: 'Define al menos el inicio de la semana 1.' } }

    const calendar = buildCalendar({ totalWeeks: starts.length, weekStarts: starts, seed })
    const rows = calendar.map(g => {
      const home = NFL_TEAMS[g.home_abbr]
      const away = NFL_TEAMS[g.away_abbr]
      return {
        league_id: league.id,
        master_game_id: null,
        sport: league.sport || 'NFL',
        season: league.season || 'Sim',
        week: g.week,
        training_session_id: sessionId,
        game_id: `${tc2Prefix(sessionId)}-${g.week}-${g.index + 1}`,
        home_team: home?.name || g.home_abbr,
        away_team: away?.name || g.away_abbr,
        home_abbr: g.home_abbr,
        away_abbr: g.away_abbr,
        game_time: g.game_time,
        active: true,
        finished: false,
      }
    })

    const cleared = await this.deleteSessionGames(league.id, sessionId)
    try {
      const { data, error } = await leagueGamesApi.insertAll(rows)
      if (error) throw error
      return { games: rows, error: null, persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.autoSchedule.generateCalendar] error:', err)
      writeLocalGames(league.id, rows)
      return { games: rows, error: null, persisted: 'local', fallback: true, cleared: cleared?.fallback }
    }
  },

  // Inicio efectivo (primer game_time) de una semana; útil para la UI de
  // edición de inicios mientras el campamento no ha empezado.
  weekStartOf(games, week) {
    const wk = gamesOfWeek(games, week)
    if (wk.length === 0) return null
    const sorted = [...wk].sort((a, b) => new Date(a.game_time) - new Date(b.game_time))
    return sorted[0].game_time
  },

  // Índice estable de un juego dentro de su semana (para el MatchSimulator).
  weekIndex(games, game) {
    return stableIndexOfWeek(gamesOfWeek(games, game?.week))(game)
  },
}