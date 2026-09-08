// ════════════════════════════════════════════════════════════════════
// training-camp — autoSchedule (BUILD-TC-V2-AUTO)
//
// Reglas puras del Training Camp AUTOMÁTICO (ligas practice + simulation).
// Sin React, sin Supabase, sin IO. El admin solo elige semanas (1..3) y la
// fecha/hora de inicio de cada semana; a partir de ahí:
//   - el calendario se genera solo: 5 partidos por semana, con equipos
//     aleatorios únicos por semana (10 equipos distintos, sin repetidos
//     dentro de la semana ni contra sí mismos) y tip-off +5 min por juego
//     (el primero = inicio elegido por el admin).
//   - los picks se cierran POR JUEGO 10 min antes de cada tip-off
//     (AUTO_PICK_DEADLINE_MINUTES), no por semana.
//   - los resultados se resuelven solos al llegar el tip-off (autoResults).
//   - la semana activa se deriva del reloj (auto-avance).
//   - los nombres de los jugadores se revelan recién cuando termina el
//     último juego de la última semana (canRevealNames).
// Determinismo: el sorteo semanal se siembra con `seed + week`
// (mulberry32, el mismo de fixtureCalendar), así que regenerar el
// calendario es idempotente y reproducible con la misma seed.
// ════════════════════════════════════════════════════════════════════

import { NFL_TEAMS } from '../../data/nflData.js'
import { calendarHelpers } from '../event/services/fixtureCalendar.js'

// Semanas máximas del campamento automático.
export const MAX_AUTO_WEEKS = 3

// Juegos generados por semana (fijo, sin edición manual).
export const AUTO_GAMES_PER_WEEK = 5

// Espaciado entre tips de una misma semana (minutos).
export const AUTO_GAME_SPACING_MINUTES = 5

// Ventana de picks POR JUEGO: se cierran 10 min antes del tip.
export const AUTO_PICK_DEADLINE_MINUTES = 10

// Separación entre inicios de semanas consecutivas (días).
export const AUTO_WEEK_GAP_DAYS = 7

// Seed estable de una liga desde su id (hash no criptográfico).
// Acotado a int4 (0..2147483647): la columna `seed` de training_sessions
// nació como `int` (005.1) y ADD COLUMN IF NOT EXISTS no cambia el tipo.
export const leagueSeed = (leagueId = '') => {
  const s = String(leagueId || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return ((h & 0x7FFFFFFF) >>> 0) || 1
}

// Inicios de cada semana: semana N = firstStart + (N-1) * 7 días.
// Acota a MAX_AUTO_WEEKS. Devuelve ISO strings.
export const buildWeekStarts = ({ totalWeeks, firstStart }) => {
  const n = Math.max(1, Math.min(Math.floor(Number(totalWeeks) || 1), MAX_AUTO_WEEKS))
  const base = firstStart ? new Date(firstStart) : new Date()
  if (isNaN(base.getTime())) throw new Error('firstStart inválido')
  const starts = []
  for (let i = 0; i < n; i++) {
    const d = new Date(base.getTime() + i * AUTO_WEEK_GAP_DAYS * 24 * 60 * 60 * 1000)
    starts.push(d.toISOString())
  }
  return starts
}

// Sorteo puramente aleatorio de una semana: toma AUTO_GAMES_PER_WEEK*2
// equipos distintos del pool (baraja) y los empareja en orden. Nunca hay
// un equipo dos veces en la misma semana ni enfrentándose a sí mismo.
export const drawMatchups = (rng) => {
  const deck = Object.keys(NFL_TEAMS)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
  const picked = deck.slice(0, AUTO_GAMES_PER_WEEK * 2)
  const matchups = []
  for (let i = 0; i < AUTO_GAMES_PER_WEEK; i++) {
    matchups.push({ home_abbr: picked[i * 2], away_abbr: picked[i * 2 + 1] })
  }
  return matchups
}

// Matchups de una semana, sembrados por (seed + week). Misma llamada con
// los mismos inputs → mismo sorteo (regeneración idempotente).
export const generateWeekGames = (seed, week) => {
  const wk = Math.max(1, Math.floor(Number(week) || 1))
  const base = typeof seed === 'number' ? (seed >>> 0) : leagueSeed(String(seed))
  const rng = calendarHelpers.mulberry32((base + wk) >>> 0)
  return drawMatchups(rng)
}

// Calendario completo: para cada semana, 5 juegos con game_time =
// weekStart + gi * AUTO_GAME_SPACING_MINUTES.
export const buildCalendar = ({ totalWeeks, weekStarts, seed = '' }) => {
  const starts = Array.isArray(weekStarts) && weekStarts.length
    ? weekStarts.slice(0, MAX_AUTO_WEEKS)
    : buildWeekStarts({ totalWeeks: totalWeeks || 1, firstStart: null })
  const games = []
  starts.forEach((start, wi) => {
    const week = wi + 1
    const base = new Date(start)
    if (isNaN(base.getTime())) throw new Error(`start inválido para la semana ${week}`)
    generateWeekGames(seed, week).forEach((m, gi) => {
      const d = new Date(base.getTime() + gi * AUTO_GAME_SPACING_MINUTES * 60 * 1000)
      games.push({
        week,
        home_abbr: m.home_abbr,
        away_abbr: m.away_abbr,
        game_time: d.toISOString(),
        index: gi,
      })
    })
  })
  return games
}

// Deadline de picks de UN juego = tip-off − 10 min.
export const gameDeadline = (game = {}) => {
  const t = game.game_time || game.time
  if (!t) return null
  const d = new Date(t)
  if (isNaN(d.getTime())) return null
  return new Date(d.getTime() - AUTO_PICK_DEADLINE_MINUTES * 60 * 1000)
}

// ¿Los picks de un juego están cerrados? Cierto si el juego ya terminó,
// no está activo, o ahora >= deadline del juego.
export const isGamePicksLocked = (game = {}, now = new Date()) => {
  if (game.finished) return true
  if (game.active === false) return true
  const d = gameDeadline(game)
  return !!(d && now >= d)
}

// ¿Un juego debe resolverse ahora? Cierto si no tiene resultado y su
// tip-off ya pasó (el motor lo resuelve en el siguiente tick).
export const isGameDue = (game = {}, now = new Date()) => {
  if (game.finished) return false
  const t = game.game_time || game.time
  if (!t) return false
  const d = new Date(t)
  return !isNaN(d.getTime()) && d <= now
}

export const gamesOfWeek = (games = [], week) =>
  (Array.isArray(games) ? games : []).filter(g => Number(g.week) === Number(week))

// Semana activa derivada del reloj: la primera semana que aún tenga algún
// juego sin resolver (las semanas van en orden cronológico). Si todas
// terminaron, devuelve la última.
export const activeWeekOf = ({ games = [], totalWeeks = 1 }) => {
  const all = Array.isArray(games) ? games.filter(Boolean) : []
  const weeks = [...new Set(all.map(g => Number(g.week)))].sort((a, b) => a - b)
  if (weeks.length === 0) return Math.min(Math.max(1, Math.floor(Number(totalWeeks) || 1)), MAX_AUTO_WEEKS)
  for (const w of weeks) {
    if (gamesOfWeek(all, w).some(g => !g.finished)) return w
  }
  return weeks[weeks.length - 1]
}

// BUILDAUTO D2: los nombres se revelan recién cuando TODOS los juegos de
// todas las semanas tienen resultado (no antes del final de la última).
export const canRevealNames = ({ games = [] }) => {
  const all = Array.isArray(games) ? games.filter(Boolean) : []
  if (all.length === 0) return false
  return all.every(g => !!g.finished)
}

// Índice estable de un juego dentro de su semana (ordenado por game_time).
// Se usa como `index` del MatchSimulator para resultados deterministas.
export const stableIndexOfWeek = (games = []) => {
  const all = Array.isArray(games) ? games.filter(Boolean) : []
  const sorted = [...all].sort((a, b) => {
    const ta = new Date(a.game_time || a.time).getTime()
    const tb = new Date(b.game_time || b.time).getTime()
    return (ta || 0) - (tb || 0)
  })
  const byId = new Map(sorted.map((g, i) => [g.id ?? g.game_id ?? i, i]))
  return (game = {}) => byId.get(game.id ?? game.game_id) ?? 0
}