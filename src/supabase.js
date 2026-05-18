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
    supabase.from('profiles').select('*').eq('id', userId).single(),

  upsert: (data) =>
    supabase.from('profiles').upsert(data),
}
