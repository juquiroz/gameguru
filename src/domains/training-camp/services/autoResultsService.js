// ════════════════════════════════════════════════════════════════════
// training-camp — autoResultsService (BUILD-TC-V2-AUTO)
//
// Persiste el resultado determinista de un juego del campamento automático
// cuando su tip-off llega. Reutiliza `leagueGamesApi.setScores` (mismo
// patrón que LeagueGamesManager / weekService.setResult) que fija
// home_score, away_score, result y finished en una sola update. Degrada a
// localStorage cuando la nube no responde.
// ════════════════════════════════════════════════════════════════════

import { leagueGamesApi } from '../../../supabase'
import { resolveGame } from '../autoResults.js'
import { stableIndexOfWeek, gamesOfWeek } from '../autoSchedule.js'

const LS_GAMES = 'gameguru.tcv2.games.'
const gamesKey = (leagueId) => `${LS_GAMES}${leagueId}`

const readLocalGames = (leagueId) => {
  try { return JSON.parse(localStorage.getItem(gamesKey(leagueId))) || [] } catch { return [] }
}
const writeLocalGames = (leagueId, games) => {
  try { localStorage.setItem(gamesKey(leagueId), JSON.stringify(games)) } catch { /* noop */ }
}

const findLocal = (leagueId, gameId) =>
  readLocalGames(leagueId).find(g => (g.id || g.game_id) === gameId)

const patchLocal = (leagueId, game) => {
  const rows = readLocalGames(leagueId)
  const idx = rows.findIndex(g => (g.id || g.game_id) === (game.id || game.game_id))
  if (idx < 0) return
  rows[idx] = { ...rows[idx], ...game }
  writeLocalGames(leagueId, rows)
}

export const trainingCampAutoResultsService = {
  // Resuelve y persiste un juego. `index` = posición estable en su semana.
  async resolveGame({ leagueId, game, seed = 1, index = 0 }) {
    if (!game?.id || game?.finished) return { error: null, skipped: true }
    const sim = resolveGame(game, { seed, index })
    const homeAbbr = game.home_abbr || game.home || 'H'
    const awayAbbr = game.away_abbr || game.away || 'A'

    try {
      const res = await leagueGamesApi.setScores(game.id, sim.home_score, sim.away_score, homeAbbr, awayAbbr)
      if (res.error) throw res.error
      // setScores ya fija result (null en empate) y finished: true.
      return { game: { ...game, ...sim }, error: null, persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.autoResults.resolveGame] error:', err)
      const patch = {
        home_score: sim.home_score,
        away_score: sim.away_score,
        result: sim.result ?? null,
        finished: true,
      }
      patchLocal(leagueId, { ...game, ...patch })
      return { game: { ...game, ...patch }, error: null, persisted: 'local', fallback: true }
    }
  },

  // Se resuelven con el MISMO seed los juegos pendientes de una semana.
  async resolveWeek({ leagueId, games, seed }) {
    const results = []
    for (const g of (games || [])) {
      if (g.finished) continue
      const idx = stableIndexOfWeek(gamesOfWeek(games, g?.week))(g)
      const res = await this.resolveGame({ leagueId, game: g, seed, index: idx })
      results.push(res)
    }
    return { results }
  },
}