// ════════════════════════════════════════════════════════════════════
// simulationView — derivaciones puras de la UX de Simulation (BUILD-TC-006.3)
//
// Puro: sin React, sin Supabase. Consume SOLO estado persistido
// (`game_weeks.simulation_progress`, `league_games`, picks, participantes)
// y lo traduce a la vista de resultados / leaderboard / progreso. NINGUNA
// regla se recalcula en componentes: la UI renderiza estas proyecciones y
// las filas RAW de `league_games` (scores, result, finished) tal cual.
//
// Reglas de dominio que viven aquí (ninguna en componentes):
//   - progreso de la corrida = `simulation_progress` del run interno
//     (estado del SimulationDirector + `progress.completed/total`), con
//     porcentaje derivado sin tocar el motor.
//   - resultados = proyección de `league_games` (home/away, scores, winner/
//     draw, finished); un partido `finished` con `result` null = empate.
//   - leaderboard = StandingsCalculator (por usuario, sin pick → 0) ordenado
//     por POINTS desc → correct desc → total asc → username asc (desempate
//     determinista) con rank 1..N.
//   - PRIVACY-001: los picks individuales son privados hasta el cierre en
//     modos oficiales (preseason/regular). Training Camp (practice) está
//     exento (objetivo educativo, transparencia en vivo). La propia planilla
//     del usuario siempre se revela. `canRevealPicks(league)` consulta la
//     policy existente (isOfficialMode/getLeagueMode) — sin hardcodear.
// ════════════════════════════════════════════════════════════════════

import { defaultRun } from '../simulation/SimulationDirector'
import { computeStandings, buildResultsMap } from '../simulation/StandingsCalculator'
import { getLeagueMode, isOfficialMode } from '../league/models/modes'

// Run normalizado para la UI: estado + progreso (completed/total) + %.
export const getSimulationRun = (week = {}) => {
  const run = defaultRun(week?.simulation_progress)
  const total = Math.max(0, Number(run.progress?.total) || 0)
  const completed = Math.max(0, Math.min(Number(run.progress?.completed) || 0, total))
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return { state: run.state, completed, total, percent }
}

// Proyección de resultados desde `league_games` (sin recalcular scores).
export const buildResultsView = (games = []) => (Array.isArray(games) ? games : [])
  .filter(g => g)
  .map(g => ({
    gameId: g.id,
    home: g.home || g.home_team || '',
    away: g.away || g.away_team || '',
    homeAbbr: g.hA || g.home_abbr || '',
    awayAbbr: g.aA || g.away_abbr || '',
    homeScore: g.home_score != null ? g.home_score : null,
    awayScore: g.away_score != null ? g.away_score : null,
    result: g.result ?? null,
    finished: !!g.finished,
    isDraw: !!g.finished && g.result == null,
  }))

// Desempate determinista del leaderboard: points desc → correct desc →
// total asc → username asc.
export const sortStandings = (rows = []) =>
  [...rows].sort((a, b) =>
    (b.points - a.points) ||
    (b.correct - a.correct) ||
    (a.total - b.total) ||
    String(a.username || '').localeCompare(String(b.username || '')))

// Leaderboard por usuario (rank 1..N). `games` acepta filas RAW de
// `league_games` o normalizadas (con `game_id`).
export const buildLeaderboard = ({ participants = [], picks = [], games = [] } = {}) =>
  sortStandings(computeStandings({ participants, picks, games }))
    .map((row, i) => ({ ...row, rank: i + 1 }))

// PRIVACY-001: ¿puede la UI revelar picks individuales de OTROS usuarios?
// Solo en modo practice (Training Camp, exento). En preseason/regular los
// picks siguen privados (documentado, aún no se implementan públicamente).
export const canRevealPicks = (league = {}) => !isOfficialMode(getLeagueMode(league))

// Feedback por usuario por partido (solo picks confirmados). En modes
// oficiales filtra a la propia planilla; en practice revela todas
// (transparencia del Training Camp). `revealAll` fuerza la policy.
export const buildPickFeedback = ({ user, picks = [], games = [], league, revealAll } = {}) => {
  const results = buildResultsMap(games)
  const mine = user?.id
  const showAll = revealAll != null ? revealAll : canRevealPicks(league)
  return (Array.isArray(picks) ? picks : [])
    .filter(p => p && (showAll || p.user_id === mine))
    .map(p => ({
      userId: p.user_id,
      gameId: p.game_id,
      pick: p.pick,
      result: results[p.game_id] ?? null,
      correct: results[p.game_id] != null && p.pick === results[p.game_id],
    }))
}
