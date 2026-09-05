// ════════════════════════════════════════════════════════════════════
// StandingsCalculator — standings de la jornada por jugador (BUILD-TC-006)
//
// Puro: sin React, sin Supabase. Entradas:
//   - participants: [{ id, username }]  (todos los miembros de la liga)
//   - picks:        [{ user_id, pick, game_id }]  (picks confirmados)
//   - games:        [{ game_id, result, finished }]  (partidos de la jornada)
//
// Salida: [{ userId, username, correct, total, points }], ordenado por
// correct desc → total asc → username asc.
//
// Reglas PLAN-TC-006 (decididas):
//   - CADA participante aparece (aunque no tenga picks → 0).
//   - pick correcto (pick === result, con result != null) → correct +1, points +1.
//   - pick incorrecto → 0.
//   - empate (result null) → el pick no coincide con ningún ganador → no suma.
//   - `total` = cantidad de partidos finalizados con resultado definido en los
//     que el jugador emitió pick (denominador de aciertos).
//
// No persiste nada: es el cálculo puro que alimenta SimulationService
// (fase `updating_standings`) y las vistas existentes.
// ════════════════════════════════════════════════════════════════════

const FINISHED = (g) => g && g.finished && g.result != null

// Mapa game_id → result (solo partidos finalizados con resultado definido).
export const buildResultsMap = (games = []) => {
  const map = {}
  games.forEach(g => { if (FINISHED(g)) map[g.game_id] = g.result })
  return map
}

export const computeStandings = ({ participants = [], picks = [], games = [] } = {}) => {
  const results = buildResultsMap(games)

  const row = (p) => ({
    userId: p.id,
    username: p.username || String(p.id).slice(0, 8),
    correct: 0,
    total: 0,
    points: 0,
  })

  const byUser = {}
  participants.forEach(p => { byUser[p.id] = row(p) })

  picks.forEach(pick => {
    const r = byUser[pick.user_id]
    if (!r) return
    const res = results[pick.game_id]
    if (res == null) return // no resultado definido (pendiente/empate) → no cuenta
    r.total++
    if (pick.pick === res) {
      r.correct++
      r.points++
    }
  })

  return Object.values(byUser)
    .sort((a, b) => b.correct - a.correct || a.total - b.total || a.username.localeCompare(b.username))
}
