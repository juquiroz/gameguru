// ════════════════════════════════════════════════════════════════════
// fixtureCalendar — generación pura del calendario del TC (BUILD-TC-004)
//
// Sin Supabase, sin React: RNG determinista (seed) + enfrentamientos únicos
// entre los 32 equipos NFL. Es la parte reproducible que usa el
// FixtureGeneratorService (persistencia) y que verificamos con node/tests.
// ════════════════════════════════════════════════════════════════════

import { NFL_TEAMS } from '../../../data/nflData'
import { localTZOffset } from '../../../utils/dates'

// ─── RNG determinista (mulberry32) ──────────────────────────────────────────
const mulberry32 = (seed) => {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const seededShuffle = (arr, seed) => {
  const rnd = mulberry32(seed)
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

// Todas las rondas posibles de enfrentamientos entre los 32 equipos (método de
// la circunferencia): 31 rondas × 16 pareos. Cada ronda es un matching perfecto
// (cada equipo juega exactamente una vez) y cada pareo aparece una sola vez.
const roundRobinRounds = (teams) => {
  const arr = teams.slice()
  const n = arr.length
  const rounds = []
  for (let round = 0; round < n - 1; round++) {
    const pairs = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      const home = round % 2 === 0 ? a : b
      const away = home === a ? b : a
      pairs.push({ home, away, key: [a, b].sort().join('|') })
    }
    rounds.push(pairs)
    const last = arr[n - 1]
    for (let j = n - 1; j > 1; j--) arr[j] = arr[j - 1]
    arr[1] = last
  }
  return rounds
}

const fmtLocal = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  return `${base}${localTZOffset()}`
}

// Puro: dado game_count + seed + start_at → enfrentamientos (para tests y demos).
// Se barajan rondas enteras (no pareos sueltos) para que ≤16 partidos cubran
// a los 32 equipos una sola vez; 17–20 usan la ronda siguiente (doble jornada).
export const buildCalendar = ({ gameCount = 10, seed = 1, startAt = new Date() }) => {
  const total = Math.max(0, Math.min(gameCount, 496))
  const rounds = roundRobinRounds(Object.keys(NFL_TEAMS))
  const flat = seededShuffle(rounds, seed)
    .map(r => seededShuffle(r, seed * 7 + 1))
    .flat()
    .slice(0, total)
  return flat.map((p, i) => {
    const time = new Date(startAt.getTime() + i * 2 * 60 * 1000)
    return {
      home: p.home,
      away: p.away,
      home_team: NFL_TEAMS[p.home].name,
      away_team: NFL_TEAMS[p.away].name,
      game_time: fmtLocal(time),
      key: p.key,
    }
  })
}

export const calendarHelpers = { mulberry32, seededShuffle, roundRobinRounds }
