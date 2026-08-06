import { trainingSessionsApi } from '../../../supabase'
import { getTrainingState } from '../models/states'
import { resolveConfig } from '../models/levels'

const LS_PREFIX = 'gameguru.ts.'
const LS_PREFIX_LEGACY = 'gameguru.tc.'

const lsKey = (leagueId) => `${LS_PREFIX}${leagueId}`
const lsKeyLegacy = (leagueId) => `${LS_PREFIX_LEGACY}${leagueId}`

const normalize = (row) => {
  if (!row) return null
  return {
    ...row,
    state: getTrainingState(row),
    start_at: row.start_at || null,
  }
}

const readLocal = (leagueId) => {
  try {
    const raw = localStorage.getItem(lsKey(leagueId)) || localStorage.getItem(lsKeyLegacy(leagueId))
    if (!raw) return null
    const record = JSON.parse(raw)
    // Migra la clave legacy a la nueva (gameguru.tc → gameguru.ts).
    if (!localStorage.getItem(lsKey(leagueId))) writeLocal(leagueId, record)
    return record
  } catch {
    return null
  }
}

const writeLocal = (leagueId, record) => {
  try { localStorage.setItem(lsKey(leagueId), JSON.stringify(record)) } catch { /* noop */ }
}

// Service de sesiones de entrenamiento (BUILD-TC-003). Persiste en la nube
// (tabla training_sessions, script manual 005.1) y degrada a localStorage si
// la tabla aún no existe, para que el Lobby sea funcional antes de ejecutar
// el SQL. Retorna `persisted` para que la UI pueda avisar el modo de
// almacenamiento.
export const trainingSessionService = {
  async nextSessionNo(leagueId) {
    try {
      const { data } = await trainingSessionsApi.list(leagueId)
      if (!data?.length) return 1
      return Math.max(...data.map(r => r.session_no || 0)) + 1
    } catch {
      return 1
    }
  },

  async create(leagueId, { name, startAt, level, gameCount, speed, fixtureMode }) {
    const resolved = resolveConfig({ level, gameCount, speed })
    const sessionNo = await this.nextSessionNo(leagueId)
    const record = {
      league_id: leagueId,
      session_no: sessionNo,
      name: name || '',
      start_at: startAt ? new Date(startAt).toISOString() : null,
      level: resolved.level,
      game_count: resolved.gameCount,
      speed: resolved.speed,
      fixture_mode: fixtureMode || 'auto',
      state: 'created',
    }
    try {
      const { data, error } = await trainingSessionsApi.insert(record)
      if (error) throw error
      return { data: normalize(data), persisted: 'cloud' }
    } catch {
      writeLocal(leagueId, record)
      return { data: normalize(record), persisted: 'local', fallback: true }
    }
  },

  async get(leagueId) {
    try {
      const { data, error } = await trainingSessionsApi.get(leagueId)
      if (error) throw error
      if (data) return { data: normalize(data), persisted: 'cloud' }
    } catch {
      /* tabla aún no creada → degradar a local */
    }
    const local = readLocal(leagueId)
    return { data: local ? normalize(local) : null, persisted: 'local' }
  },

  async update(leagueId, patch) {
    const current = await this.get(leagueId)
    const next = normalize({ ...(current.data || {}), ...patch })
    try {
      const id = current.data?.id
      const { error } = id
        ? await trainingSessionsApi.updateById(id, patch)
        : await trainingSessionsApi.updateByLeague(leagueId, patch)
      if (error) throw error
      return { data: next, persisted: 'cloud' }
    } catch {
      writeLocal(leagueId, next)
      return { data: next, persisted: 'local', fallback: true }
    }
  },

  async remove(leagueId) {
    try { await trainingSessionsApi.remove(leagueId) } catch { /* noop */ }
    try { localStorage.removeItem(lsKey(leagueId)) } catch { /* noop */ }
  },
}
