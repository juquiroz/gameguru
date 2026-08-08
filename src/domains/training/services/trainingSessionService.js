import { trainingSessionsApi } from '../../../supabase'
import { resolveConfig } from '../models/levels'

const LS_PREFIX = 'gameguru.ts.'
const LS_PREFIX_LEGACY = 'gameguru.tc.'

const lsKey = (leagueId) => `${LS_PREFIX}${leagueId}`
const lsKeyLegacy = (leagueId) => `${LS_PREFIX_LEGACY}${leagueId}`

// Normaliza una fila sin imponer semántica del Training Camp: conserva el
// `state` tal cual (los eventos Fixture Generation usan sus propios estados:
// waiting / generating_fixtures / saving_matches / completed).
const normalize = (row) => {
  if (!row) return null
  return {
    ...row,
    state: row.state || 'created',
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

// Log descriptivo (BUILD-TC-004.2): cada fallo de Supabase se registra con la
// operación y el error real, sin romper el flujo (degradación a localStorage).
const logFallback = (op, err) => {
  console.error(
    `[trainingSessionService.${op}] no se pudo persistir en la nube ` +
    '(tabla training_sessions ausente o error de Supabase); degradando a localStorage:',
    err
  )
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
    } catch (err) {
      console.error('[trainingSessionService.nextSessionNo] no se pudo consultar la sesión en la nube:', err)
      return 1
    }
  },

  async create(leagueId, { name, startAt, level, gameCount, speed, fixtureMode }) {
    const resolved = resolveConfig({ level, gameCount, speed })
    const sessionNo = await this.nextSessionNo(leagueId)
    const record = {
      league_id: leagueId,
      session_no: sessionNo,
      event_type: 'training_camp',
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
    } catch (err) {
      logFallback('create', err)
      writeLocal(leagueId, record)
      return { data: normalize(record), persisted: 'local', fallback: true }
    }
  },

  // Evento Fixture Generation (BUILD-TC-004): se crea cuando el Training Camp
  // finaliza, con `event_type: 'fixture_generation'` y estado inicial `waiting`.
  // El director (elegido por event_type) lo lleva hasta `completed` reportando
  // `fixture_progress`. Es la sesión más reciente → el Lobby lo muestra igual.
  async createFixtureEvent(leagueId, { name, gameCount, seed, startAt, level } = {}) {
    const sessionNo = await this.nextSessionNo(leagueId)
    const record = {
      league_id: leagueId,
      session_no: sessionNo,
      event_type: 'fixture_generation',
      name: name || '',
      start_at: startAt ? new Date(startAt).toISOString() : null,
      game_count: gameCount || 10,
      seed: seed || null,
      fixture_mode: 'auto',
      level: level || null,
      state: 'waiting',
    }
    try {
      const { data, error } = await trainingSessionsApi.insert(record)
      if (error) throw error
      return { data: normalize(data), persisted: 'cloud' }
    } catch (err) {
      logFallback('createFixtureEvent', err)
      writeLocal(leagueId, record)
      return { data: normalize(record), persisted: 'local', fallback: true }
    }
  },

  // Evento Game Week (BUILD-TC-005): se crea cuando Fixture Generation queda
  // `completed`, con `event_type: 'game_week'` y estado inicial `waiting`.
  // GameWeekService lo abre (OPEN_WEEK → picks_open) con el deadline de picks
  // persistido en `picks_deadline_at` para que el director (puro) lo lea.
  async createGameWeekEvent(leagueId, { name, gameCount, seed, startAt, level, pickWindowMinutes } = {}) {
    const sessionNo = await this.nextSessionNo(leagueId)
    const resolved = resolveConfig({ level, pickWindowMinutes })
    const record = {
      league_id: leagueId,
      session_no: sessionNo,
      event_type: 'game_week',
      name: name ? `Jornada · ${name}` : '',
      start_at: startAt ? new Date(startAt).toISOString() : null,
      game_count: gameCount || 10,
      seed: seed || null,
      fixture_mode: 'auto',
      level: resolved.level,
      // Ventana de picks del nivel (BUILD-TC-005): express 5' / standard 10' /
      // advanced 15' / custom editable. GameWeekService la usa para el deadline.
      pick_window_minutes: resolved.pickWindowMinutes,
      state: 'waiting',
    }
    try {
      const { data, error } = await trainingSessionsApi.insert(record)
      if (error) throw error
      return { data: normalize(data), persisted: 'cloud' }
    } catch (err) {
      logFallback('createGameWeekEvent', err)
      writeLocal(leagueId, record)
      return { data: normalize(record), persisted: 'local', fallback: true }
    }
  },

  async get(leagueId) {
    try {
      const { data, error } = await trainingSessionsApi.get(leagueId)
      if (error) throw error
      if (data) return { data: normalize(data), persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingSessionService.get] no se pudo leer la sesión desde la nube:', err)
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
    } catch (err) {
      logFallback('update', err)
      writeLocal(leagueId, next)
      return { data: next, persisted: 'local', fallback: true }
    }
  },

  async remove(leagueId) {
    try { await trainingSessionsApi.remove(leagueId) }
    catch (err) { console.error('[trainingSessionService.remove] no se pudo borrar la sesión en la nube:', err) }
    try { localStorage.removeItem(lsKey(leagueId)) } catch { /* noop */ }
  },
}
