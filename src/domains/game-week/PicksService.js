// ════════════════════════════════════════════════════════════════════
// PicksService — picks de la Game Week (BUILD-TC-005)
//
// Desacoplado de React. Responsabilidades (PLAN-TC-005 §8.5):
//   - guardar / actualizar picks mientras la ventana esté abierta
//   - confirmar la planilla (PickSubmission) y detectar cuándo todos los
//     participantes confirmaron (dispara el bloqueo all_submitted)
//   - validar que todos los partidos requeridos tengan selección
//   - exponer los picks confirmados (getConfirmedPicks) → punto de
//     integración de TC-006 (Simulation Engine) sin tocar la UI.
//
// Reglas de dominio que viven aquí (ninguna en componentes):
//   - solo se puede jugar con la ventana abierta (event.state === 'picks_open')
//   - la confirmación exige una selección completa (validateComplete)
//   - el bloqueo colectivo ocurre cuando TODOS los miembros confirmaron.
//
// Persistencia tolerante: intenta Supabase (tabla picks + pick_submissions de
// 005.2) y degrada a localStorage (`gameguru.picks.<session>.<user>` y
// `gameguru.sub.<weekId>`).
// ════════════════════════════════════════════════════════════════════

import { picksApi, pickSubmissionsApi, leaguesApi } from '../../supabase'

const LS_PICKS = 'gameguru.picks.'
const LS_SUB = 'gameguru.sub.'

const picksKey = (sessionId, userId) => `${LS_PICKS}${sessionId}.${userId}`
const subKey = (weekId) => `${LS_SUB}${weekId}`

const readLocalPicks = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const writeLocalPicks = (key, map) => {
  try { localStorage.setItem(key, JSON.stringify(map)) } catch { /* noop */ }
}

const readLocalSubs = (weekId) => {
  try {
    const raw = localStorage.getItem(subKey(weekId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeLocalSubs = (weekId, subs) => {
  try { localStorage.setItem(subKey(weekId), JSON.stringify(subs)) } catch { /* noop */ }
}

// Estado del pick del usuario en la jornada (derivado, no se persiste).
export const PICK_STATUS = {
  OPEN: 'open',
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
}

// Los picks se identifican por `game_id` (mismo criterio que usePicks/Picks.jsx).
export const picksService = {
  // La ventana debe estar abierta para guardar/confirmar (regla de dominio).
  isWindowOpen(event) {
    return !!event && event.state === 'picks_open'
  },

  // Picks guardados del usuario en la sesión (map game_id → abbr).
  async getPicks({ user, league, event }) {
    if (!user || !league || !event) return { picks: {}, submitted: false, persisted: 'local' }
    try {
      const { data, error } = await picksApi.getForSession(user.id, league.id, event.id)
      if (error) throw error
      if (data) {
        const map = {}
        data.forEach(row => { map[row.game_id] = row.pick })
        return { picks: map, submitted: !!data[0]?.submitted_at, persisted: 'cloud' }
      }
    } catch (err) {
      console.error('[picksService.getPicks] no se pudieron leer los picks desde la nube:', err)
    }
    const map = readLocalPicks(picksKey(event.id, user.id))
    return { picks: map, submitted: false, persisted: 'local' }
  },

  // Guarda/actualiza un pick (upsert por sesión). Valida la ventana abierta.
  async savePick({ user, league, event, gameId, pick }) {
    if (!this.isWindowOpen(event)) {
      return { error: { message: 'La jornada está cerrada: los picks ya no se pueden editar.' } }
    }
    const row = {
      user_id: user.id,
      league_id: league.id,
      week: 1,
      game_id: gameId,
      pick,
      training_session_id: event.id,
      submitted_at: null,
    }
    try {
      // PLAN-LEAGUE-CONTEXT-01.1: UK de sesión por liga (006.2 eliminó la global
      // `user_id,week,game_id` que sobrescribía picks de otra liga).
      const { error } = await picksApi.upsert([row], {
        onConflict: 'user_id,league_id,training_session_id,game_id',
      })
      if (error) throw error
      return { success: true, persisted: 'cloud' }
    } catch (err) {
      console.error('[picksService.savePick] no se pudo guardar el pick en la nube; degradando a local:', err)
      const key = picksKey(event.id, user.id)
      writeLocalPicks(key, { ...readLocalPicks(key), [gameId]: pick })
      return { success: true, persisted: 'local', fallback: true }
    }
  },

  // Alias semántico: actualizar un pick es lo mismo que guardarlo (upsert).
  updatePick(args) {
    return this.savePick(args)
  },

  // Valida que todos los partidos requeridos tengan selección.
  // games: lista de { id (game_id) }; picks: map game_id → abbr.
  validateComplete(games, picks) {
    const missing = (games || []).filter(g => !picks || !picks[g.id])
    return { complete: missing.length === 0, missing: missing.map(g => g.id) }
  },

  // Confirma la planilla: persiste todos los picks con submitted_at y crea la
  // PickSubmission. Devuelve allSubmitted (todos los miembros confirmaron) para
  // que el caller decida el bloqueo all_submitted.
  async confirmPicks({ user, league, event, gameWeekId, games, picks }) {
    if (!this.isWindowOpen(event)) {
      return { error: { message: 'La jornada está cerrada: no se puede confirmar.' } }
    }
    const { complete, missing } = this.validateComplete(games, picks)
    if (!complete) {
      return { error: { message: 'Faltan selecciones', missing } }
    }

    const submittedAt = new Date().toISOString()
    const rows = Object.entries(picks).map(([gameId, pick]) => ({
      user_id: user.id,
      league_id: league.id,
      week: 1,
      game_id: gameId,
      pick,
      training_session_id: event.id,
      submitted_at: submittedAt,
    }))
    const pickCount = rows.length

    try {
      const { error } = await picksApi.upsert(rows, {
        onConflict: 'user_id,league_id,training_session_id,game_id',
      })
      if (error) throw error
      if (gameWeekId) {
        const { error: subError } = await pickSubmissionsApi.upsert({
          game_week_id: gameWeekId,
          user_id: user.id,
          league_id: league.id,
          pick_count: pickCount,
          submitted_at: submittedAt,
        })
        if (subError) throw subError
      }
    } catch (err) {
      console.error('[picksService.confirmPicks] no se pudo confirmar en la nube; degradando a local:', err)
      const key = picksKey(event.id, user.id)
      const current = readLocalPicks(key)
      Object.entries(picks).forEach(([gameId, pick]) => { current[gameId] = pick })
      writeLocalPicks(key, current)
      if (gameWeekId) {
        const subs = readLocalSubs(gameWeekId)
        if (!subs.some(s => s.user_id === user.id)) {
          subs.push({ user_id: user.id, pick_count: pickCount, submitted_at: submittedAt })
        }
        writeLocalSubs(gameWeekId, subs)
      }
    }

    const allSubmitted = await this.areAllSubmitted(league.id, gameWeekId)
    return { success: true, allSubmitted, submittedAt }
  },

  // Todos los miembros de la liga confirmaron esta jornada.
  async areAllSubmitted(leagueId, gameWeekId) {
    if (!gameWeekId) return false
    try {
      const [membersRes, subsRes] = await Promise.allSettled([
        leaguesApi.getMembers(leagueId),
        pickSubmissionsApi.getForWeek(gameWeekId),
      ])
      const members = membersRes.status === 'fulfilled' && membersRes.value.data
        ? membersRes.value.data.map(m => m.user_id)
        : []
      const submitters = subsRes.status === 'fulfilled' && subsRes.value.data
        ? new Set(subsRes.value.data.map(s => s.user_id))
        : new Set(readLocalSubs(gameWeekId).map(s => s.user_id))
      return members.length > 0 && members.every(id => submitters.has(id))
    } catch {
      return false
    }
  },

  // Punto de integración TC-006: todos los picks confirmados de la sesión.
  // El Simulation Engine los consume sin que la UI tenga que cambiar.
  async getConfirmedPicks(leagueId, trainingSessionId) {
    try {
      const { data, error } = await picksApi.getAllForSession(leagueId, trainingSessionId)
      if (error) throw error
      return { picks: data || [], persisted: 'cloud' }
    } catch (err) {
      console.error('[picksService.getConfirmedPicks] no se pudieron leer los picks confirmados:', err)
      return { picks: [], persisted: 'local' }
    }
  },
}
