// ════════════════════════════════════════════════════════════════════
// training-camp — Modelo puro (BUILD-TC-V2-001)
//
// Fuente única de verdad de las reglas de dominio del Training Camp
// rediseñado (simple y manual). Sin React, sin IO. Funciones puras:
//   - estado del campamento (setup → activo → finalizado)
//   - validación secuencial de semanas (N+1 no puede empezar antes que N)
//   - deadline de picks (15 min antes del primer juego de la semana)
//   - decisiones de bloqueo (los picks se cierran al iniciar el primer juego)
//   - cálculo de snapshot de auditoría
// ============================================================================

// Ventana de picks: los picks se cierran 15 min antes del primer juego.
export const PICK_DEADLINE_MINUTES = 15

// Semana más temprana sin resultado definida por el primer game_time.
export function firstGameTime(game) {
  if (!game) return null
  return game.game_time || game.time || null
}

// ── Modelo de estado del campamento ─────────────────────────────────────────
// Phases derivadas:
//   setup     → definiendo semanas/juegos (no hay vínculo de invitación aún)
//   inviting  → schedule completo, roster abierto para invitar a jugadores
//   active    → los jugadores hacen picks y se ingresan resultados por semana
//   finished  → todas las semanas jugadas
// Además de los flags de semana:
//   week.locked   → picks cerrados (primer juego iniciado)
//   week.complete → todos los juegos de la semana tienen resultado (finished)
export const PHASE = {
  SETUP: 'setup',
  INVITING: 'inviting',
  ACTIVE: 'active',
  FINISHED: 'finished',
}

// Reconoce la fase del campamento a partir de un estado derivado (snapshot).
export function derivePhase({ scheduleComplete, totalWeeks, currentWeek, completed, finished, started }) {
  if (finished || (totalWeeks > 0 && completed)) return PHASE.FINISHED
  if (!scheduleComplete) return PHASE.SETUP
  if (!started) return PHASE.INVITING
  if ((currentWeek || 0) >= 1) return PHASE.ACTIVE
  return PHASE.INVITING
}

// Deadline de picks de una semana = 15 min antes del primer game_time.
export function weekDeadline(games) {
  const times = (games || [])
    .map(firstGameTime)
    .filter(Boolean)
    .map(t => new Date(t))
    .filter(d => !isNaN(d.getTime()))
  if (times.length === 0) return null
  const earliest = new Date(Math.min(...times.map(d => d.getTime())))
  return new Date(earliest.getTime() - PICK_DEADLINE_MINUTES * 60 * 1000)
}

// ¿La semana tiene los picks cerrados? Cierto si pasó el deadline o el primer
// juego ya inició (game_time <= now) o la semana quedó finalizada.
export function isWeekPicksLocked({ games, now, finished }) {
  if (finished) return true
  const deadline = weekDeadline(games)
  if (deadline && now >= deadline) return true
  const started = (games || []).some(g => {
    const gt = firstGameTime(g)
    return gt && new Date(gt) <= now
  })
  return started
}

// ¿La semana está completa? Todos sus juegos tienen resultado (finished).
export function isWeekComplete(games) {
  if (!games || games.length === 0) return false
  return games.every(g => !!g.finished)
}

// ── Validación del orden de semanas ──────────────────────────────────────────
// Ningún juego de la semana N+1 puede tener fecha/hora anterior al primer
// juego de la semana N (o al último juego de la semana anterior). Esta regla
// garantiza que las semanas se juegan en orden cronológico.
export function validateWeeksOrder(weeksGames) {
  // weeksGames: [{ week, games: [...] }] ordenados asc por week.
  const sorted = [...(weeksGames || [])].sort((a, b) => (a.week || 0) - (b.week || 0))
  const errors = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    const prevLast = lastGameTime(prev.games)
    const currFirst = firstGameTimeOf(curr.games)
    if (prevLast && currFirst && new Date(currFirst) < new Date(prevLast)) {
      errors.push({
        week: curr.week,
        message: `La semana ${curr.week} inicia (${currFirst}) antes de que termine la semana ${prev.week} (${prevLast}).`,
      })
    }
  }
  return { valid: errors.length === 0, errors }
}

export function firstGameTimeOf(games) {
  const times = (games || []).map(firstGameTime).filter(Boolean).map(t => new Date(t)).filter(d => !isNaN(d.getTime()))
  return times.length ? times.sort((a, b) => a - b)[0].toISOString() : null
}

export function lastGameTime(games) {
  const times = (games || []).map(firstGameTime).filter(Boolean).map(t => new Date(t)).filter(d => !isNaN(d.getTime()))
  return times.length ? times.sort((a, b) => a - b)[times.length - 1].toISOString() : null
}

// ── Acciones del reducer ─────────────────────────────────────────────────────
export const ACTION = {
  INIT: 'INIT',
  SET_TOTAL_WEEKS: 'SET_TOTAL_WEEKS',
  MARK_SCHEDULE_COMPLETE: 'MARK_SCHEDULE_COMPLETE',
  START: 'START',
  SET_CURRENT_WEEK: 'SET_CURRENT_WEEK',
  SET_FINISHED: 'SET_FINISHED',
}

export const initialModel = {
  state: null,           // estado persistido de training_sessions
  totalWeeks: 1,
  currentWeek: 1,
  scheduleComplete: false,
  started: false,
  finished: false,
}

// Reducer puro: (modelo, acción) → nuevo modelo.
export function reducer(model = initialModel, action) {
  switch (action.type) {
    case ACTION.INIT:
      return {
        ...initialModel,
        state: action.state ?? model.state ?? null,
        totalWeeks: clampWeeks(action.totalWeeks ?? model.totalWeeks),
        currentWeek: clampWeeks(action.currentWeek ?? model.currentWeek),
        scheduleComplete: !!action.scheduleComplete,
        started: !!action.started,
        finished: !!action.finished,
      }
    case ACTION.SET_TOTAL_WEEKS:
      return { ...model, totalWeeks: clampWeeks(action.value) }
    case ACTION.MARK_SCHEDULE_COMPLETE:
      return { ...model, scheduleComplete: true, currentWeek: 1 }
    case ACTION.START:
      return { ...model, started: true }
    case ACTION.SET_CURRENT_WEEK:
      return { ...model, currentWeek: clampWeeks(action.value, model.totalWeeks) }
    case ACTION.SET_FINISHED:
      return { ...model, finished: !!action.value }
    default:
      return model
  }
}

export function clampWeeks(value, max) {
  const n = Math.max(1, Math.floor(Number(value) || 1))
  return max ? Math.min(n, max) : n
}

// ── Snapshot de auditoría ────────────────────────────────────────────────────
// Genera un hash corto determinista (sha-256 → hex trunco) para la URL pública.
export async function snapshotHash(payload) {
  try {
    const data = new TextEncoder().encode(JSON.stringify(payload))
    const digest = await crypto.subtle.digest('SHA-256', data)
    return [...new Uint8Array(digest)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 24)
  } catch {
    // Fallback determinista si crypto subtle no está disponible.
    let h = 0
    const s = JSON.stringify(payload)
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0 }
    return `v2${h.toString(16).padStart(8, '0')}`
  }
}

// Construye el payload que se congela en el snapshot: partidos + picks por
// jugador (solo nickname + selecciones). Los picks se asocian por game_id.
export function buildSnapshotPayload({ games, picks, membersByUser }) {
  const gameRows = (games || []).map(g => ({
    id: g.game_id || g.id,
    home: g.home_abbr || g.home_team,
    away: g.away_abbr || g.away_team,
    time: g.game_time || null,
  }))

  const byUser = {}
  ;(picks || []).forEach(p => {
    const uid = p.user_id || p.userId
    if (!byUser[uid]) byUser[uid] = {}
    // pick es abbr del equipo elegido
    const pick = p.pick || p.pickAbbr
    if (pick) byUser[uid][p.game_id] = pick
  })

  const playerRows = Object.entries(byUser).map(([uid, mpk]) => {
    const m = membersByUser?.[uid]
    return {
      player: (m && m.nickname && String(m.nickname).trim()) ? m.nickname.trim() : (m?.username || 'Jugador'),
      picks: mpk,
    }
  })

  return {
    frozenAt: new Date().toISOString(),
    games: gameRows,
    players: playerRows,
  }
}
