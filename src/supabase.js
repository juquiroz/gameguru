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

  getMyLeagues: (userId) =>
    supabase
      .from('league_members')
      .select('role, leagues(*)')
      .eq('user_id', userId),

  getMembers: (leagueId) =>
    supabase
      .from('league_members')
      .select('user_id, role, profiles(username)')
      .eq('league_id', leagueId),

  delete: async (leagueId) => {
    await Promise.allSettled([
      supabase.from('league_games').delete().eq('league_id', leagueId),
      supabase.from('league_members').delete().eq('league_id', leagueId),
    ])
    const { error } = await supabase.from('leagues').delete().eq('id', leagueId)
    if (error) return { error: { message: error.message } }
    return { data: null }
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
}

// ─── Picks helpers ──────────────────────────────────────────────────────────
export const picksApi = {
  upsert: (picks) =>
    supabase
      .from('picks')
      .upsert(picks, { onConflict: 'user_id,league_id,week,game_id' }),

  getForWeek: (userId, leagueId, week) =>
    supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('week', week),

  getLeaderboard: (leagueId, week) =>
    supabase
      .from('picks')
      .select('user_id, pick, game_id, profiles(username)')
      .eq('league_id', leagueId)
      .eq('week', week),
}

// ─── Profiles helpers ───────────────────────────────────────────────────────
export const profilesApi = {
  get: (userId) =>
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),

  upsert: (data) =>
    supabase.from('profiles').upsert(data),
}

// ─── Master Games helpers (global calendar managed by superadmin) ─────────────
export const masterGamesApi = {
  insertAll: (games) =>
    supabase.from('master_games').insert(games),

  getAll: (sport, season) =>
    supabase
      .from('master_games')
      .select('*')
      .eq('sport', sport)
      .eq('season', season)
      .order('week')
      .order('game_id'),

  getByWeek: (sport, season, week) =>
    supabase
      .from('master_games')
      .select('*')
      .eq('sport', sport)
      .eq('season', season)
      .eq('week', week)
      .order('game_id'),

  insert: (game) =>
    supabase.from('master_games').insert(game).select().single(),

  update: (id, data) =>
    supabase.from('master_games').update(data).eq('id', id).select().single(),

  remove: (id) =>
    supabase.from('master_games').delete().eq('id', id),

  deleteAll: (sport, season) =>
    supabase
      .from('master_games')
      .delete()
      .eq('sport', sport)
      .eq('season', season),
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

  setScores: (id, homeScore, awayScore, homeAbbr, awayAbbr) => {
    let result = null
    if (homeScore > awayScore) result = homeAbbr
    else if (awayScore > homeScore) result = awayAbbr
    return supabase
      .from('league_games')
      .update({ home_score: homeScore, away_score: awayScore, result, finished: true })
      .eq('id', id)
      .select()
      .single()
  },
}
