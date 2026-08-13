// ════════════════════════════════════════════════════════════════════
// MatchSimulator — simulación determinista de partidos (BUILD-TC-006)
//
// Puro: sin React, sin Supabase, sin NFL. Dado un partido + (seed, index)
// devuelve `{ home_score, away_score, result }` (result = abreviatura del
// ganador, o null en empate). `finished: true` lo aplica quien persiste
// (SimulationService), no este módulo.
//
// Determinismo (reglas PLAN-TC-006):
//   - misma seed + mismo índice → mismo resultado
//   - seed distinta → resultados potencialmente distintos
//   - winner/result SIEMPRE coincide con home/away_score
//   - empate → result = null
//
// El RNG es mulberry32 (el mismo del fixtureCalendar) derivado de
// `seed + index`: cada partido consume un flujo independiente y estable.
// Modelo v1 (sin lesiones/tarjetas/sustituciones/mercado/IA):
//   - rating base por equipo (estable, derivado del seed y las abrebiatura)
//   - ventaja local + ruido por partido
//   - total de puntos acotado a un rango tipo NFL (3..38)
// ════════════════════════════════════════════════════════════════════

import { calendarHelpers } from '../event/services/fixtureCalendar'

// Rango de puntuación v1 (NFL-ish, valores cerrados y estables).
const MIN_SCORE = 3
const MAX_SCORE = 38

// Hash determinista y estable de una abreviatura (no criptográfico).
const hashAbbr = (abbr = '') => {
  let h = 0
  const s = String(abbr).toUpperCase()
  for (let i = 0; i < s.length; i++) {
    h = ((h * 31) + s.charCodeAt(i)) >>> 0
  }
  return h
}

// Fuerza base [0..1) de un equipo para un seed dado (estable entre llamadas:
// misma abbr + mismo seed → misma fuerza).
const teamRating = (abbr, seed) => {
  const rnd = calendarHelpers.mulberry32(((seed >>> 0) * 2654435761) ^ hashAbbr(abbr))
  return rnd()
}

// Convierte una probabilidad [0..1) a un total de puntos en el rango válido.
const scoreFrom = (prob) => MIN_SCORE + Math.floor(prob * (MAX_SCORE - MIN_SCORE + 1))

// Simula un partido. `index` es la posición estable del partido en la semana
// (orden por game_time/game_id), nunca el orden de iteración del caller.
export const simulateGame = (game = {}, { seed = 1, index = 0 } = {}) => {
  const homeAbbr = game.home_abbr || game.home || 'H'
  const awayAbbr = game.away_abbr || game.away || 'A'

  const base = (seed >>> 0) + index
  const rnd = calendarHelpers.mulberry32(base)

  // Ventaja local: sesgo fijo del seed hacia el local (estable por jornada).
  const homeBias = 0.06
  const homeP = teamRating(homeAbbr, base) + homeBias
  const awayP = teamRating(awayAbbr, base * 7 + 1)

  // Ruido por partido (flujo independiente).
  const noise = (rnd() - 0.5) * 0.5

  const homeProb = Math.max(0, Math.min(0.9999, homeP + noise))
  const awayProb = Math.max(0, Math.min(0.9999, awayP - noise * 0.5))

  let homeScore = scoreFrom(homeProb)
  let awayScore = scoreFrom(awayProb)

  let result = null
  if (homeScore > awayScore) result = homeAbbr
  else if (awayScore > homeScore) result = awayAbbr

  return { home_score: homeScore, away_score: awayScore, result }
}

// Simula un lote de partidos con índices estables [start..start+n). Puro.
export const simulateBatch = (games = [], { seed = 1, start = 0, limit } = {}) =>
  games.slice(start, limit == null ? undefined : start + limit).map((g, i) => ({
    ...simulateGame(g, { seed, index: start + i }),
  }))
