// ════════════════════════════════════════════════════════════════════
// training-camp — picksService (BUILD-TC-V2-001)
//
// Picks por semana del nuevo Training Camp manual. Reutiliza `picks` y
// `pick_submissions` con `training_session_id` + `game_id` (cada juego tiene
// game_id `tc2-...`). Los picks se guardan por semana: cada fila es
// (user, league, training_session, game_id) y `week` de la sesión.
// ============================================================================

import { picksApi, pickSubmissionsApi, leaguesApi } from '../../../supabase'

const LS_PICKS = 'gameguru.tcv2.picks.'
const picksKey = (sessionId, userId) => `${LS_PICKS}${sessionId}.${userId}`

const readLocalPicks = (key) => {
  try { return JSON.parse(localStorage.getItem(key)) || {} } catch { return {} }
}
const writeLocalPicks = (key, map) => {
  try { localStorage.setItem(key, JSON.stringify(map)) } catch { /* noop */ }
}

export const trainingCampPicksService = {
  // Picks del usuario en la sesión (map game_id → abbr).
  async getPicks({ user, league, event }) {
    if (!user || !league || !event) return { picks: {}, submitted: false, persisted: 'local' }
    try {
      const { data, error } = await picksApi.getForSession(user.id, league.id, event.id)
      if (error) throw error
      const map = {}
      let submitted = false
      ;(data || []).forEach(row => {
        map[row.game_id] = { pick: row.pick, submittedAt: row.submitted_at }
        if (row.submitted_at) submitted = true
      })
      return { picks: map, submitted, persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.picksService.getPicks] error:', err)
      const map = readLocalPicks(picksKey(event.id, user.id))
      return { picks: map, submitted: false, persisted: 'local' }
    }
  },

  async savePick({ user, league, event, gameId, pick, week }) {
    const row = {
      user_id: user.id,
      league_id: league.id,
      week: Number(week) || 1,
      game_id: gameId,
      pick,
      training_session_id: event.id,
      submitted_at: null,
    }
    try {
      const { error } = await picksApi.upsert([row], {
        onConflict: 'user_id,league_id,training_session_id,game_id',
      })
      if (error) throw error
      return { success: true, persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.picksService.savePick] error:', err)
      const key = picksKey(event.id, user.id)
      writeLocalPicks(key, { ...readLocalPicks(key), [gameId]: { pick, submittedAt: null } })
      return { success: true, persisted: 'local', fallback: true }
    }
  },

  validateComplete(games, picks) {
    const missing = (games || []).filter(g => !picks || !picks[g.game_id]?.pick)
    return { complete: missing.length === 0, missing }
  },

  async confirmPicks({ user, league, event, gameWeekId, games, picks }) {
    const { complete } = this.validateComplete(games, picks)
    if (!complete) return { error: { message: 'Faltan selecciones' } }
    const submittedAt = new Date().toISOString()
    const rows = games.map(g => ({
      user_id: user.id,
      league_id: league.id,
      week: Number(event.current_week) || 1,
      game_id: g.game_id,
      pick: picks[g.game_id]?.pick,
      training_session_id: event.id,
      submitted_at: submittedAt,
    }))
    try {
      const { error } = await picksApi.upsert(rows, {
        onConflict: 'user_id,league_id,training_session_id,game_id',
      })
      if (error) throw error
      if (gameWeekId) {
        await pickSubmissionsApi.upsert({
          game_week_id: gameWeekId,
          user_id: user.id,
          league_id: league.id,
          pick_count: rows.length,
          submitted_at: submittedAt,
        })
      }
      return { success: true, submittedAt }
    } catch (err) {
      console.error('[trainingCamp.picksService.confirmPicks] error:', err)
      const key = picksKey(event.id, user.id)
      const map = {}
      rows.forEach(r => { map[r.game_id] = r })
      writeLocalPicks(key, { ...readLocalPicks(key), ...map })
      return { success: true, submittedAt }
    }
  },

  // Todos los picks confirmados de la sesión (para leaderboard y snapshot).
  async getConfirmedPicks(leagueId, trainingSessionId) {
    try {
      const { data, error } = await picksApi.getAllForSession(leagueId, trainingSessionId)
      if (error) throw error
      return { picks: data || [], persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.picksService.getConfirmedPicks] error:', err)
      return { picks: [], persisted: 'local' }
    }
  },

  // Resuelve el mapa user_id → { nickname, username } de la liga (para
  // leaderboard y snapshot, sin exponer email).
  async resolveMembers({ leagueId, profilesById }) {
    try {
      const { data: members, error } = await leaguesApi.getMembers(leagueId)
      if (error) throw error
      const byUser = {}
      ;(members || []).forEach(m => {
        const nickname = m.nickname && String(m.nickname).trim() ? m.nickname.trim() : null
        const profile = profilesById?.[m.user_id]
        const username = profile?.username || null
        byUser[m.user_id] = {
          role: m.role,
          nickname: nickname || username || 'Jugador',
          ...(nickname ? { certified: true } : {}),
        }
      })
      return { byUser, persisted: 'cloud' }
    } catch (err) {
      console.error('[trainingCamp.picksService.resolveMembers] error:', err)
      return { byUser: {}, persisted: 'local' }
    }
  },
}
