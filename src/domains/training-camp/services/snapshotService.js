// ════════════════════════════════════════════════════════════════════
// training-camp — snapshotService (BUILD-TC-V2-001)
//
// Auditoría: al iniciar el primer juego de una semana (deadline de picks
// pasado / picks cerrados) se congela un snapshot PÚBLICO de los picks
// confirmados con un hash → URL de auditoría compartible.
//
// El correo NO se usa (decisión de producto): la URL de auditoría es el
// mecanismo de verificación pública (quién eligió qué antes de que inicie
// el juego). El snapshot se congela UNA vez por semana (idempotente).
// ============================================================================

import { supabase } from '../../../supabase'
import { buildSnapshotPayload, snapshotHash } from '../model'

const snapshotsApi = {
  async list() {
    return supabase.from('pick_snapshots').select('*')
  },
  async getByHash(hash) {
    return supabase.from('pick_snapshots').select('*').eq('snapshot_hash', hash).maybeSingle()
  },
  async getByWeek(gameWeekId) {
    return supabase.from('pick_snapshots').select('*').eq('game_week_id', gameWeekId).maybeSingle()
  },
  async insert(record) {
    return supabase.from('pick_snapshots').insert(record).select().single()
  },
}

export const trainingCampSnapshotService = {
  // Lee un snapshot ya congelado por semana (si existe) → null si no.
  async getForWeek(gameWeekId) {
    if (!gameWeekId) return null
    try {
      const { data, error } = await snapshotsApi.getByWeek(gameWeekId)
      if (error) throw error
      return data || null
    } catch (err) {
      console.error('[trainingCamp.snapshotService.getForWeek] error:', err)
      return null
    }
  },

  async getByHash(hash) {
    if (!hash) return null
    try {
      const { data, error } = await snapshotsApi.getByHash(hash)
      if (error) throw error
      return data || null
    } catch (err) {
      console.error('[trainingCamp.snapshotService.getByHash] error:', err)
      return null
    }
  },

  // Congela los picks públicos de la semana (idempotente). Se llama cuando el
  // primer juego inicia. Devuelve la URL pública de auditoría.
  async freezeWeek({ leagueId, gameWeekId, week, games, picks, membersByUser }) {
    if (!gameWeekId) return { snapshot: null, url: null, alreadyFrozen: false }
    const existing = await this.getForWeek(gameWeekId)
    if (existing) {
      return { snapshot: existing, url: this.urlFor(existing), alreadyFrozen: true }
    }
    const payload = buildSnapshotPayload({ games, picks, membersByUser })
    const hash = await snapshotHash({ ...payload, leagueId, week })
    try {
      const { data, error } = await snapshotsApi.insert({
        game_week_id: gameWeekId,
        league_id: leagueId,
        week: Number(week),
        snapshot_hash: hash,
        games_json: payload.games,
        picks_json: payload.players,
      })
      if (error) throw error
      const snap = data
      return { snapshot: snap, url: this.urlFor(snap), alreadyFrozen: false }
    } catch (err) {
      console.error('[trainingCamp.snapshotService.freezeWeek] error:', err)
      return { snapshot: null, url: null, alreadyFrozen: false, error: err }
    }
  },

  urlFor(snapshot) {
    if (!snapshot?.snapshot_hash) return null
    return `${window?.location?.origin || ''}/#/training/audit/${snapshot.snapshot_hash}`
  },
}

export { snapshotsApi }
