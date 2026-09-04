// ════════════════════════════════════════════════════════════════════
// training-camp — sessionService (BUILD-TC-V2-001)
//
// Lee/escribe la sesión simple del Training Camp en `training_sessions`
// reutilizando trainingSessionsApi del proyecto. Modelo simple:
// una sola sesión por liga con `state='training_camp_v2'` y las columnas
// total_weeks / current_week / schedule_complete añadidas en 014.0.
//
// Persistencia tolerante (igual que el resto del proyecto): intenta
// Supabase y degrada a localStorage si la migración no está aplicada.
// ============================================================================

import { trainingSessionsApi } from '../../../supabase'

const LS_PREFIX = 'gameguru.tcv2.'
const lsKey = (leagueId) => `${LS_PREFIX}${leagueId}`

const STATE_V2 = 'training_camp_v2'

const normalize = (row) => {
  if (!row) return null
  return {
    ...row,
    total_weeks: Number(row.total_weeks) > 0 ? Number(row.total_weeks) : 1,
    current_week: Number(row.current_week) > 0 ? Number(row.current_week) : 1,
    schedule_complete: !!row.schedule_complete,
    started: !!row.started,
  }
}

const readLocal = (leagueId) => {
  try {
    const raw = localStorage.getItem(lsKey(leagueId))
    return raw ? normalize(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

const writeLocal = (leagueId, record) => {
  try { localStorage.setItem(lsKey(leagueId), JSON.stringify(record)) } catch { /* noop */ }
}

const logFallback = (op, err) => {
  console.error(`[trainingCamp.sessionService.${op}] no se pudo persistir en la nube; degradando a localStorage:`, err)
}

export const trainingCampSessionService = {
  // La sesión activa del campamento (v2) de una liga. Distinguimos por
  // `state='training_camp_v2'` (el `event_type` reusa 'training_camp' para no
  // tocar su CHECK); las sesiones legacy (estados del director) se ignoran.
  async get(leagueId) {
    if (!leagueId) return { data: null, persisted: 'local' }
    try {
      const { data, error } = await trainingSessionsApi.get(leagueId)
      if (error) throw error
      if (data && data.state === STATE_V2) {
        return { data: normalize(data), persisted: 'cloud' }
      }
      return { data: null, persisted: 'cloud' }
    } catch (err) {
      logFallback('get', err)
    }
    return { data: readLocal(leagueId), persisted: 'local' }
  },

  // Crea la sesión simple del campamento (idempotente por liga).
  async create(leagueId, { name, totalWeeks = 1 } = {}) {
    const existing = await this.get(leagueId)
    if (existing.data?.id) {
      return this.update(leagueId, { total_weeks: totalWeeks })
    }
    const sessions = await trainingSessionsApi.list(leagueId).catch(() => ({ data: null }))
    const sessionNo = (sessions?.data?.length
      ? Math.max(...sessions.data.map(r => r.session_no || 0)) + 1
      : 1)
    const record = {
      league_id: leagueId,
      session_no: sessionNo,
      event_type: 'training_camp',
      name: name || '',
      state: STATE_V2,
      total_weeks: Number(totalWeeks) > 0 ? Number(totalWeeks) : 1,
      current_week: 1,
      schedule_complete: false,
    }
    try {
      const { data, error } = await trainingSessionsApi.insert(record)
      if (error) throw error
      return { data: normalize(data), persisted: 'cloud' }
    } catch (err) {
      logFallback('create', err)
      writeLocal(leagueId, record)
      return { data: normalize(record), persisted: 'local', fallback: true }
    }
  },

  // Actualiza la sesión. Si existe en la nube usa su id; si no, actualiza por
  // liga. Degrada a localStorage.
  async update(leagueId, patch) {
    const current = await this.get(leagueId)
    const next = normalize({ ...(current.data || {}), ...patch, league_id: leagueId })
    try {
      const id = current.data?.id
      const cloudPatch = { ...patch }
      const { error } = id
        ? await trainingSessionsApi.updateById(id, cloudPatch)
        : await trainingSessionsApi.updateByLeague(leagueId, cloudPatch)
      if (error) throw error
      return { data: next, persisted: 'cloud' }
    } catch (err) {
      logFallback('update', err)
      writeLocal(leagueId, next)
      return { data: next, persisted: 'local', fallback: true }
    }
  },
}
