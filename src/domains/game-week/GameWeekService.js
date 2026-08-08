// ════════════════════════════════════════════════════════════════════
// GameWeekService — jornada de juego del Training Camp (BUILD-TC-005)
//
// Desacoplado de React. Coordina la entidad `game_weeks` (WeekState) con el
// GameWeekDirector: el service decide CUÁNDO se abre/bloquea una jornada y
// persiste la fila; el director (puro) traduce esa decisión a un parche del
// evento (sesión). El parche se devuelve al hook (applyPatch) para que el
// Lobby/la vista del evento reaccionen sin conocer el director.
//
// Reglas de dominio que vive aquí (ninguna en componentes):
//   - deadline de picks = apertura + ventana (pickWindowMinutes del nivel)
//   - la jornada se bloquea por deadline / todos confirmados / admin
//     (la decisión la toman openWeek/lockWeek; TICK del director aplica el
//      deadline en el hook)
//   - `totalWeeks`: el TC tiene 1 jornada; openNextWeek queda 1:N-ready
//     (devuelve null si no hay siguiente jornada).
//
// Persistencia tolerante: intenta Supabase (tabla 005.2) y degrada a
// localStorage (`gameguru.gw.<sessionId>`), igual que training_sessions.
// ════════════════════════════════════════════════════════════════════

import { gameWeeksApi } from '../../supabase'
import { EVENT_ACTIONS } from '../event/EventDirector'
import { gameWeekDirector } from './GameWeekDirector'

const LS_GW = 'gameguru.gw.'
const lsKey = (sessionId) => `${LS_GW}${sessionId}`

const nowIso = () => new Date().toISOString()

// Ventana de picks efectiva: base = ahora (o start_at si aún es futuro) + N min.
export function computePickDeadline(startAt, pickWindowMinutes = 10) {
  const base = startAt && new Date(startAt).getTime() > Date.now() ? new Date(startAt) : new Date()
  return new Date(base.getTime() + pickWindowMinutes * 60 * 1000).toISOString()
}

const readLocalWeeks = (sessionId) => {
  try {
    const raw = localStorage.getItem(lsKey(sessionId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeLocalWeeks = (sessionId, weeks) => {
  try { localStorage.setItem(lsKey(sessionId), JSON.stringify(weeks)) } catch { /* noop */ }
}

const lastWeek = (weeks) => (weeks && weeks.length ? weeks[weeks.length - 1] : null)

export const gameWeekService = {
  // Jornada activa (la más reciente por week) de una sesión.
  async getActiveWeek(trainingSessionId) {
    if (!trainingSessionId) return { week: null, persisted: 'local' }
    try {
      const { data, error } = await gameWeeksApi.getBySession(trainingSessionId)
      if (error) throw error
      if (data) return { week: data, persisted: 'cloud' }
    } catch (err) {
      console.error('[gameWeekService.getActiveWeek] no se pudo leer la jornada desde la nube:', err)
    }
    return { week: lastWeek(readLocalWeeks(trainingSessionId)) || null, persisted: 'local' }
  },

  async listWeeks(trainingSessionId) {
    try {
      const { data, error } = await gameWeeksApi.list(trainingSessionId)
      if (error) throw error
      if (data) return { weeks: data, persisted: 'cloud' }
    } catch (err) {
      console.error('[gameWeekService.listWeeks] no se pudo listar las jornadas desde la nube:', err)
    }
    return { weeks: readLocalWeeks(trainingSessionId), persisted: 'local' }
  },

  // Abre la jornada: crea la fila `game_weeks` (idempotente: si ya existe la
  // devuelve) y devuelve el parche OPEN_WEEK para la sesión (waiting→picks_open).
  async openWeek(event, { deadlineAt } = {}) {
    if (!event?.id) return { week: null, patch: null, persisted: 'local' }

    const existing = await this.getActiveWeek(event.id)
    const now = new Date()
    if (existing.week) {
      const patch = gameWeekDirector.dispatch(event, EVENT_ACTIONS.OPEN_WEEK, {
        now,
        deadline_at: deadlineAt || existing.week.deadline_at,
      })
      return { week: existing.week, patch, persisted: existing.persisted }
    }

    const { weeks, persisted } = await this.listWeeks(event.id)
    const week = (weeks.reduce((m, w) => Math.max(m, Number(w.week) || 0), 0)) + 1
    const windowMin = Number(event.pick_window_minutes) > 0 ? Number(event.pick_window_minutes) : 10
    const row = {
      training_session_id: event.id,
      league_id: event.league_id,
      week,
      game_count: Number(event.game_count) || 10,
      deadline_at: deadlineAt || computePickDeadline(event.start_at, windowMin),
      state: 'picks_open',
      opened_at: nowIso(),
    }

    let saved = row
    try {
      const { data, error } = await gameWeeksApi.insert(row)
      if (error) throw error
      if (data) saved = data
    } catch (err) {
      console.error('[gameWeekService.openWeek] no se pudo crear la jornada en la nube; degradando a local:', err)
      writeLocalWeeks(event.id, [...weeks, row])
    }

    const patch = gameWeekDirector.dispatch(event, EVENT_ACTIONS.OPEN_WEEK, {
      now,
      deadline_at: row.deadline_at,
    })
    return { week: saved, patch, persisted }
  },

  // Bloquea la jornada (picks_open → picks_locked) y sincroniza la fila.
  // reason: 'deadline' | 'all_submitted' | 'admin'.
  async lockWeek(event, { reason = 'admin', gameWeekId } = {}) {
    const patch = gameWeekDirector.dispatch(event, EVENT_ACTIONS.LOCK_PICKS, {
      now: new Date(),
      reason,
    })
    if (patch) {
      const id = gameWeekId || (await this.getActiveWeek(event.id)).week?.id
      try {
        if (id) {
          const { data, error } = await gameWeeksApi.update(id, {
            state: 'picks_locked',
            locked_at: nowIso(),
          })
          if (!error && data) patch.__week = data
        }
      } catch (err) {
        console.error('[gameWeekService.lockWeek] no se pudo actualizar la jornada en la nube:', err)
      }
    }
    return { patch, week: patch?.__week || null }
  },

  // Abre la siguiente jornada (1:N-ready). El TC tiene 1 sola jornada, por lo
  // que devuelve null cuando `week >= totalWeeks` (sin más jornadas que jugar).
  async openNextWeek(event, { deadlineAt, totalWeeks = 1 } = {}) {
    const { week: active } = await this.getActiveWeek(event.id)
    if (!active || Number(active.week) >= Number(totalWeeks)) return null
    const next = Number(active.week) + 1
    const now = new Date()
    const windowMin = Number(event.pick_window_minutes) > 0 ? Number(event.pick_window_minutes) : 10
    const row = {
      training_session_id: event.id,
      league_id: event.league_id,
      week: next,
      game_count: Number(event.game_count) || 10,
      deadline_at: deadlineAt || computePickDeadline(event.start_at, windowMin),
      state: 'picks_open',
      opened_at: nowIso(),
    }
    let saved = row
    try {
      const { data, error } = await gameWeeksApi.insert(row)
      if (error) throw error
      if (data) saved = data
    } catch (err) {
      console.error('[gameWeekService.openNextWeek] no se pudo crear la jornada en la nube:', err)
      const { weeks } = await this.listWeeks(event.id)
      writeLocalWeeks(event.id, [...weeks, row])
    }
    const patch = gameWeekDirector.dispatch(event, EVENT_ACTIONS.OPEN_NEXT_WEEK, {
      now,
      deadline_at: row.deadline_at,
    })
    return { week: saved, patch }
  },
}
