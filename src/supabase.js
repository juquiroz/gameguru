import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno de Supabase. Crea un archivo .env basado en .env.example')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Auth helpers ───────────────────────────────────────────────────────────
export const authApi = {
  signUp: (email, password) =>
    supabase.auth.signUp({ email, password }),

  signIn: (email, password) =>
    supabase.auth.signInWithPassword({ email, password }),

  signOut: () =>
    supabase.auth.signOut(),

  getSession: () =>
    supabase.auth.getSession(),

  onAuthChange: (callback) =>
    supabase.auth.onAuthStateChange(callback),
}

// ─── Leagues helpers ────────────────────────────────────────────────────────
export const leaguesApi = {
  create: (data) =>
    supabase.from('leagues').insert(data).select().single(),

  getByCode: (code) =>
    supabase.from('leagues').select('*').eq('code', code).single(),

  // LeagueContext (PLAN-LEAGUE-CONTEXT): distingue "liga inexistente" de
  // "no sos miembro". RLS: `Anyone can read leagues` (SELECT público), así que
  // cualquier usuario autenticado puede verificar la existencia de la liga.
  getById: (id) =>
    supabase.from('leagues').select('*').eq('id', id).maybeSingle(),

  getMyLeagues: (userId) =>
    supabase
      .from('league_members')
      .select('role, leagues(*)')
      .eq('user_id', userId),

  getMembers: (leagueId) =>
    supabase
      .from('league_members')
      .select('user_id, role')
      .eq('league_id', leagueId),

  delete: async (leagueId) => {
    console.log('leagues.delete – inicio, leagueId:', leagueId)
    try {
      const results = await Promise.allSettled([
        supabase.from('league_games').delete().eq('league_id', leagueId),
        supabase.from('league_members').delete().eq('league_id', leagueId),
      ])
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.error('leagues.delete paso', i, 'rechazado:', r.reason)
        else if (r.value?.error) console.error('leagues.delete paso', i, 'error:', r.value.error)
        else console.log('leagues.delete paso', i, 'ok')
      })
      const res = await supabase.from('leagues').delete().eq('id', leagueId)
      console.log('leagues.delete – respuesta de leagues:', res)
      if (res.error) {
        console.error('leagues.delete – error al borrar la liga:', res.error)
        return { error: { message: res.error.message } }
      }
      console.log('leagues.delete – éxito')
      return { data: null }
    } catch (ex) {
      console.error('leagues.delete – excepción:', ex)
      return { error: { message: ex?.message || 'Error inesperado al eliminar la liga' } }
    }
  },
}

// ─── League Members helpers ─────────────────────────────────────────────────
export const membersApi = {
  join: (leagueId, userId, role = 'member') =>
    supabase
      .from('league_members')
      .upsert({ league_id: leagueId, user_id: userId, role })
      .select()
      .single(),

  // LeagueContext (PLAN-LEAGUE-CONTEXT): membership de un usuario en una liga
  // consultada directo de la fuente de datos (no solo del frontend). RLS:
  // `Members can read memberships` (SELECT total).
  getMembership: (leagueId, userId) =>
    supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .maybeSingle(),
}

// ─── Picks helpers ──────────────────────────────────────────────────────────
export const picksApi = {
  // PLAN-LEAGUE-CONTEXT-01.1: aislar picks por liga. Migración 006.2 eliminó la
  // constraint GLOBAL `picks_user_id_week_game_id_key UNIQUE(user_id, week,
  // game_id)` (causa de corrupción silenciosa multi-liga: el 2do upsert de una
  // liga sobrescribía la fila de otra con el mismo game_id). El default apunta a
  // la UK por liga de season/regular (training_session_id NULL):
  //   `picks_user_league_week_game_key UNIQUE(user_id, league_id, week, game_id)`.
  // El flujo Training Camp pasa onConflict explícito a la UK de sesión
  // (`user_id,league_id,training_session_id,game_id` — PicksService).
  upsert: (picks, { onConflict = 'user_id,league_id,week,game_id' } = {}) =>
    supabase
      .from('picks')
      .upsert(picks, { onConflict }),

  getForWeek: (userId, leagueId, week) =>
    supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('week', week),

  // Picks de una sesión de entrenamiento (BUILD-TC-005): la jornada juega
  // sobre los partidos generados, no sobre una semana del calendario maestro.
  getForSession: (userId, leagueId, trainingSessionId) =>
    supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('training_session_id', trainingSessionId),

  // Todos los picks confirmados de una sesión (punto de integración TC-006:
  // el Simulation Engine consume la planilla sin tocar la UI).
  getAllForSession: (leagueId, trainingSessionId) =>
    supabase
      .from('picks')
      .select('user_id, pick, game_id')
      .eq('league_id', leagueId)
      .eq('training_session_id', trainingSessionId),

  getLeaderboard: (leagueId, week) =>
    supabase
      .from('picks')
      .select('user_id, pick, game_id')
      .eq('league_id', leagueId)
      .eq('week', week),

  getAllForLeague: (leagueId) =>
    supabase
      .from('picks')
      .select('user_id, pick, game_id, week')
      .eq('league_id', leagueId),
}

// ─── Profiles helpers ───────────────────────────────────────────────────────
export const profilesApi = {
  get: (userId) =>
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),

  upsert: (data) =>
    supabase.from('profiles').upsert(data),

  getMany: (userIds) =>
    supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds),
}

// ─── Training Sessions helpers (BUILD-TC-003, tabla manual 005.1-training-sessions.sql)
// 1:N-ready con leagues (session_no único por liga). Temporalmente la app usa
// una única sesión por liga y accede siempre a la más reciente.
export const trainingSessionsApi = {
  insert: (record) =>
    supabase.from('training_sessions').insert(record).select().single(),

  get: (leagueId) =>
    supabase
      .from('training_sessions')
      .select('*')
      .eq('league_id', leagueId)
      .order('session_no', { ascending: false })
      .limit(1)
      .maybeSingle(),

  list: (leagueId) =>
    supabase
      .from('training_sessions')
      .select('id, session_no, event_type')
      .eq('league_id', leagueId)
      .order('session_no', { ascending: false }),

  updateById: (id, patch) =>
    supabase.from('training_sessions').update(patch).eq('id', id),

  updateByLeague: (leagueId, patch) =>
    supabase.from('training_sessions').update(patch).eq('league_id', leagueId),

  remove: (leagueId) =>
    supabase.from('training_sessions').delete().eq('league_id', leagueId),
}

// ─── Master Games helpers (global calendar managed by superadmin) ─────────────
export const masterGamesApi = {
  insertAll: (games) =>
    supabase.from('master_games').insert(games),

  getAll: (sport, season, phase) => {
    let q = supabase
      .from('master_games')
      .select('*')
      .eq('sport', sport)
      .eq('season', season)
    if (phase) q = q.eq('phase', phase)
    return q.order('week').order('game_id')
  },

  getByWeek: (sport, season, week, phase) => {
    let q = supabase
      .from('master_games')
      .select('*')
      .eq('sport', sport)
      .eq('season', season)
      .eq('week', week)
    if (phase) q = q.eq('phase', phase)
    return q.order('game_id')
  },

  insert: (game) =>
    supabase.from('master_games').insert(game).select().single(),

  update: (id, data) =>
    supabase.from('master_games').update(data).eq('id', id).select().single(),

  remove: (id) =>
    supabase.from('master_games').delete().eq('id', id),

  deleteAll: (sport, season, phase) => {
    let q = supabase
      .from('master_games')
      .delete()
      .eq('sport', sport)
      .eq('season', season)
    if (phase) q = q.eq('phase', phase)
    return q
  },

  getMasterResults: (sport, season) =>
    supabase
      .from('master_games')
      .select('game_id, home_score, away_score, result, finished')
      .eq('sport', sport)
      .eq('season', season),

  setScoresByGameId: async (gameId, sport, season, homeScore, awayScore, homeAbbr, awayAbbr) => {
    let result = null
    if (homeScore > awayScore) result = homeAbbr
    else if (awayScore > homeScore) result = awayAbbr
    const { data, error } = await supabase
      .from('master_games')
      .update({ home_score: homeScore, away_score: awayScore, result, finished: true })
      .eq('game_id', gameId)
      .eq('sport', sport)
      .eq('season', season)
      .select()
    if (error) return { error }
    if (!data || data.length === 0) return { error: { message: 'No se encontró el juego en el calendario maestro.' } }
    return { data: { success: true } }
  },
}

// ─── League Games helpers (games selected by each league) ─────────────────────
export const leagueGamesApi = {
  insertAll: (games) =>
    supabase.from('league_games').insert(games),

  getForLeague: (leagueId) =>
    supabase
      .from('league_games')
      .select('*')
      .eq('league_id', leagueId)
      .order('week')
      .order('game_id'),

  getForWeek: (leagueId, week) =>
    supabase
      .from('league_games')
      .select('*')
      .eq('league_id', leagueId)
      .eq('week', week)
      .order('game_id'),

  addGame: (game) =>
    supabase.from('league_games').insert(game).select().single(),

  removeFromLeague: (leagueId, gameId) =>
    supabase
      .from('league_games')
      .delete()
      .eq('league_id', leagueId)
      .eq('game_id', gameId),

  setActive: (leagueId, gameId, active) =>
    supabase
      .from('league_games')
      .update({ active })
      .eq('league_id', leagueId)
      .eq('game_id', gameId),

  setResult: (id, result) =>
    supabase.from('league_games').update({ result }).eq('id', id).select().single(),

  setFinished: (id, finished) =>
    supabase.from('league_games').update({ finished }).eq('id', id).select().single(),

  setScores: async (id, homeScore, awayScore, homeAbbr, awayAbbr) => {
    let result = null
    if (homeScore > awayScore) result = homeAbbr
    else if (awayScore > homeScore) result = awayAbbr
    const { data, error } = await supabase
      .from('league_games')
      .update({ home_score: homeScore, away_score: awayScore, result, finished: true })
      .eq('id', id)
      .select()
    if (error) return { error }
    if (!data || data.length === 0) return { error: { message: 'No se encontró el juego en la base de datos (posible problema de permisos).' } }
    return { data: { success: true } }
  },
}

// ─── Game Week helpers (BUILD-TC-005, tabla manual 005.2-game-week.sql) ─────
// Jornada de juego de una sesión (WeekState). 1:N-ready con training_sessions
// vía (training_session_id, week) UNIQUE; el TC tiene una sola jornada.
export const gameWeeksApi = {
  insert: (record) =>
    supabase.from('game_weeks').insert(record).select().single(),

  getBySession: (trainingSessionId) =>
    supabase
      .from('game_weeks')
      .select('*')
      .eq('training_session_id', trainingSessionId)
      .order('week', { ascending: false })
      .limit(1)
      .maybeSingle(),

  list: (trainingSessionId) =>
    supabase
      .from('game_weeks')
      .select('*')
      .eq('training_session_id', trainingSessionId)
      .order('week'),

  update: (id, patch) =>
    supabase.from('game_weeks').update(patch).eq('id', id).select().single(),

  removeBySession: (trainingSessionId) =>
    supabase.from('game_weeks').delete().eq('training_session_id', trainingSessionId),
}

// ─── Pick Submissions helpers (BUILD-TC-005) ────────────────────────────────
// Confirmación/bloqueo de la planilla de una jornada por usuario
// (PickSubmission). Presencia = planilla confirmada; el bloqueo real de la
// jornada lo decide el director (LOCK_PICKS).
export const pickSubmissionsApi = {
  upsert: (record) =>
    supabase
      .from('pick_submissions')
      .upsert(record, { onConflict: 'game_week_id,user_id' })
      .select()
      .single(),

  getForWeek: (gameWeekId) =>
    supabase
      .from('pick_submissions')
      .select('user_id, pick_count, submitted_at')
      .eq('game_week_id', gameWeekId),

  getByUser: (gameWeekId, userId) =>
    supabase
      .from('pick_submissions')
      .select('*')
      .eq('game_week_id', gameWeekId)
      .eq('user_id', userId)
      .maybeSingle(),

  removeByWeek: (gameWeekId) =>
    supabase.from('pick_submissions').delete().eq('game_week_id', gameWeekId),
}
