import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const API_URL = 'https://v1.american-football.api-sports.io'

const STATUS_MAP: Record<string, string> = {
  NS: 'scheduled', '1H': 'live', HT: 'live', '2H': 'live', ET: 'live',
  P: 'postponed', CANC: 'cancelled', SUSP: 'suspended', INT: 'delayed',
  FT: 'final', AET: 'final', PEN: 'final',
}

const TEAM_MAP: Record<string, string> = {
  'Arizona Cardinals': 'ARI', 'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF', 'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE', 'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC', 'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR', 'Miami Dolphins': 'MIA', 'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE', 'New Orleans Saints': 'NO', 'New York Giants': 'NYG',
  'New York Jets': 'NYJ', 'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF', 'Seattle Seahawks': 'SEA', 'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN', 'Washington Commanders': 'WAS',
}

const SEASON_TYPE_MAP: Record<number, string> = { 1: 'preseason', 2: 'regular', 3: 'postseason' }

// ── WINDOW CLASSIFICATION ──────────────────────────────────────────────────────
// Determina la ventana temporal de un partido basada SOLO en game_time + now.
// NO depende del status persistido en master_games.
function classifyWindow(gameTime: string, now: Date): string {
  const gameDate = new Date(gameTime)
  const diffMs = gameDate.getTime() - now.getTime()
  const diffMin = diffMs / 60000
  const diffHour = diffMin / 60

  // Pasado hace más de 24h → reconciliado
  if (diffMin < -24 * 60) return 'past_reconciled'
  // Pasado entre 6h y 24h → reconciliación extendida
  if (diffMin < -6 * 60) return 'past_extended'
  // Pasado entre 2h y 6h → reconciliación activa
  if (diffMin < -2 * 60) return 'past_active'
  // Pasado entre 0 y 2h → recién finalizado
  if (diffMin < 0) return 'just_finished'
  // Futuro entre 0 y 30 min → inminente
  if (diffMin <= 30) return 'imminent'
  // Futuro entre 30 min y 2h → pregame
  if (diffHour <= 2) return 'pregame'
  // Futuro entre 2h y 24h → approaching
  if (diffHour <= 24) return 'approaching'
  // Futuro más de 24h → no consultar
  return 'future'
}

// ── NORMALIZE ──────────────────────────────────────────────────────────────────
function normalize(g: any) {
  const h = TEAM_MAP[g.teams?.home?.name], a = TEAM_MAP[g.teams?.away?.name]
  if (!h || !a) return null
  const st = STATUS_MAP[g.fixture?.status?.short] || 'scheduled'
  const fin = st === 'final'
  let hs = g.scores?.home?.total ?? null, as_ = g.scores?.away?.total ?? null, res = null
  if (hs !== null && as_ !== null && fin) res = hs > as_ ? h : as_ > hs ? a : null
  return {
    externalGameId: String(g.fixture?.id),
    externalCompetitionId: `${g.league?.id}-${g.league?.season}`,
    homeTeamAbbr: h, awayTeamAbbr: a, gameTime: g.fixture?.date,
    status: st, homeScore: hs, awayScore: as_, result: res,
    finished: fin, week: g.fixture?.week || null,
    phase: SEASON_TYPE_MAP[g.league?.season_type] || 'regular',
  }
}

// ── API CALLS ──────────────────────────────────────────────────────────────────
async function fetchGamesByDate(key: string, season: string, date: string) {
  const p = new URLSearchParams({ league: '1', season, date })
  const r = await fetch(`${API_URL}/games?${p}`, {
    headers: { 'x-apisports-key': key, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`API-Sports ${r.status}`)
  const d = await r.json()
  if (d.errors?.length) throw new Error(`API-Sports: ${JSON.stringify(d.errors)}`)
  return (d.response || []).map(normalize).filter(Boolean)
}

async function fetchGames(key: string, season: string, phase: string) {
  const st = Object.entries(SEASON_TYPE_MAP).find(([, v]) => v === phase)?.[0]
  const p = new URLSearchParams({ league: '1', season })
  if (st) p.append('season_type', st)
  const r = await fetch(`${API_URL}/games?${p}`, {
    headers: { 'x-apisports-key': key, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`API-Sports ${r.status}`)
  const d = await r.json()
  if (d.errors?.length) throw new Error(`API-Sports: ${JSON.stringify(d.errors)}`)
  return (d.response || []).map(normalize).filter(Boolean)
}

// ── PERSISTENCE ────────────────────────────────────────────────────────────────
async function upsertMaster(supa: any, games: any[], sport: string, season: string, provider: string) {
  let created = 0, updated = 0, unchanged = 0, rejected = 0
  for (const g of games) {
    const { data: ex } = await supa.from('master_games')
      .select('id,home_score,away_score,finished,result')
      .eq('provider', provider).eq('external_game_id', g.externalGameId).maybeSingle()
    if (ex) {
      const ch = ex.home_score !== g.homeScore || ex.away_score !== g.awayScore ||
        ex.finished !== g.finished || ex.result !== g.result
      if (ch) {
        const { error } = await supa.from('master_games').update({
          home_score: g.homeScore, away_score: g.awayScore, result: g.result,
          finished: g.finished, mapping_status: 'mapped',
        }).eq('id', ex.id)
        error ? rejected++ : updated++
      } else unchanged++
    } else {
      const { error } = await supa.from('master_games').insert({
        sport, season, week: g.week, game_id: `api-${g.externalGameId}`,
        home_team: g.homeTeamAbbr, away_team: g.awayTeamAbbr,
        home_abbr: g.homeTeamAbbr, away_abbr: g.awayTeamAbbr,
        game_time: g.gameTime, home_score: g.homeScore, away_score: g.awayScore,
        result: g.result, finished: g.finished, phase: g.phase,
        provider, external_game_id: g.externalGameId,
        external_competition_id: g.externalCompetitionId, mapping_status: 'mapped',
      })
      error ? rejected++ : created++
    }
  }
  return { created, updated, unchanged, rejected }
}

async function propagate(supa: any, games: any[], provider: string) {
  let n = 0
  for (const g of games) {
    const { data: m } = await supa.from('master_games').select('id')
      .eq('provider', provider).eq('external_game_id', g.externalGameId).maybeSingle()
    if (!m) continue
    const { data: u, error } = await supa.from('league_games').update({
      home_score: g.homeScore, away_score: g.awayScore, result: g.result, finished: g.finished,
    }).eq('master_game_id', m.id).is('training_session_id', null).select()
    if (!error && u) n += u.length
  }
  return n
}

async function updateSyncState(supa: any, games: any[], provider: string, now: Date) {
  for (const g of games) {
    const { data: m } = await supa.from('master_games')
      .select('id')
      .eq('provider', provider)
      .eq('external_game_id', g.externalGameId)
      .maybeSingle()

    if (!m) continue

    const window = classifyWindow(g.gameTime, now)
    let syncState = 'unknown'

    if (g.status === 'live') syncState = 'live'
    else if (g.status === 'postponed') syncState = 'postponed'
    else if (g.status === 'cancelled') syncState = 'cancelled'
    else if (g.finished) {
      const diffMs = now.getTime() - new Date(g.gameTime).getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      if (diffHours >= 24) {
        syncState = 'reconciled'
      } else {
        syncState = 'final_pending'
      }
    } else {
      syncState = window === 'future' ? 'scheduled' : window
    }

    const updateData: any = {
      sync_state: syncState,
      last_synced_at: now.toISOString(),
    }

    if (syncState === 'reconciled') {
      updateData.reconciled_at = now.toISOString()
    }

    await supa.from('master_games').update(updateData).eq('id', m.id)
  }
}

// ── SCHEDULER DECISION ENGINE ──────────────────────────────────────────────────
async function schedulerDecision(supa: any, now: Date, scope: any, isManual: boolean) {
  // Manual sync siempre ejecuta (usa pool manual)
  if (isManual) {
    return { should: true, reason: 'manual_request', games_evaluated: 0, games_needing_sync: 0 }
  }

  // 1. Leer partidos de master_games para este scope
  const { data: games } = await supa
    .from('master_games')
    .select('id, game_time, sync_state, last_synced_at, reconciled_at, external_game_id')
    .eq('provider', 'api-sports')
    .eq('sport', scope.sport)
    .eq('season', scope.season)
    .eq('phase', scope.phase)

  if (!games || games.length === 0) {
    return { should: false, reason: 'no_games', games_evaluated: 0, games_needing_sync: 0 }
  }

  // 2. Leer cooldown config
  const { data: cooldowns } = await supa
    .from('sync_cooldown_config')
    .select('sync_window, cooldown_minutes')

  const cooldownMap: Record<string, number> = {}
  if (cooldowns) {
    for (const c of cooldowns) {
      cooldownMap[c.sync_window] = c.cooldown_minutes
    }
  }

  // Default cooldowns si no hay config en DB
  const defaultCooldowns: Record<string, number> = {
    future: 999999,
    approaching: 240,
    pregame: 60,
    imminent: 15,
    just_finished: 10,
    past_active: 30,
    past_extended: 120,
    past_reconciled: 999999,
  }

  // 3. Clasificar partidos por ventana y verificar cooldown
  const needsSync: any[] = []
  for (const g of games) {
    const window = classifyWindow(g.game_time, now)
    const cooldown = cooldownMap[window] ?? defaultCooldowns[window] ?? 999999
    const minutesSinceLastSync = g.last_synced_at
      ? (now.getTime() - new Date(g.last_synced_at).getTime()) / 60000
      : Infinity

    if (minutesSinceLastSync >= cooldown) {
      needsSync.push({ ...g, window })
    }
  }

  if (needsSync.length === 0) {
    return {
      should: false,
      reason: 'cooldown_active',
      games_evaluated: games.length,
      games_needing_sync: 0,
    }
  }

  // 4. Verificar budget
  const { data: budget, error: budgetError } = await supa.rpc('check_budget', {
    p_provider: 'api-sports',
    p_source: 'automatic',
  })

  if (budgetError) {
    // Si la función no existe aún (migración no aplicada), continuar sin budget check
    console.warn('[Scheduler] check_budget RPC not available, proceeding without budget check')
  } else if (budget && budget.automatic_remaining <= 0) {
    return {
      should: false,
      reason: 'budget_exhausted',
      games_evaluated: games.length,
      games_needing_sync: needsSync.length,
    }
  }

  // 5. Obtener fechas únicas para consultar
  const dates = [...new Set(needsSync.map((g: any) => g.game_time.split('T')[0]))]

  return {
    should: true,
    games: needsSync,
    games_evaluated: games.length,
    games_needing_sync: needsSync.length,
    dates,
  }
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────────
serve(async (req) => {
  const t0 = Date.now()
  try {
    const apiKey = Deno.env.get('API_SPORTS_API_KEY')
    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API_SPORTS_API_KEY' }), { status: 500 })

    const supaUrl = Deno.env.get('SUPABASE_URL')!
    const supaKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supa = createClient(supaUrl, supaKey)

    const body = await req.json().catch(() => ({}))
    const isManual = body.manual === true
    const leagueId = body.league_id || null

    // ── AUTENTICACIÓN Y AUTORIZACIÓN ──────────────────────────────────────
    let userId: string | null = null
    let isPlatformSuperadmin = false

    if (isManual) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 })
      }

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supa.auth.getUser(token)

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 })
      }

      userId = user.id

      const { data: profile } = await supa
        .from('profiles')
        .select('platform_role')
        .eq('id', userId)
        .single()

      isPlatformSuperadmin = profile?.platform_role === 'platform_superadmin'

      if (!isPlatformSuperadmin && leagueId) {
        const { data: membership } = await supa
          .from('league_members')
          .select('role')
          .eq('league_id', leagueId)
          .eq('user_id', userId)
          .single()

        if (membership?.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Unauthorized: not admin of this league' }), { status: 403 })
        }
      }
    } else {
      const cronSecret = req.headers.get('X-Cron-Secret')
      const expectedSecret = Deno.env.get('CRON_SECRET')

      if (!expectedSecret) {
        return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), { status: 500 })
      }

      if (cronSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'Invalid cron secret' }), { status: 403 })
      }
    }

    // ── CONCURRENCY PROTECTION ────────────────────────────────────────────
    const { data: runningSync } = await supa
      .from('sync_runs')
      .select('id, started_at')
      .eq('status', 'running')
      .gte('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle()

    if (runningSync) {
      return new Response(JSON.stringify({ 
        error: 'Another sync is already in progress',
        running_sync_id: runningSync.id,
        started_at: runningSync.started_at
      }), { status: 409 })
    }

    // ── DETERMINAR SCOPES ─────────────────────────────────────────────────
    let scopes: any[] = []
    if (isManual && leagueId) {
      const { data: lg, error: leagueError } = await supa.from('leagues')
        .select('id,sport,season,league_mode,auto_update_results')
        .eq('id', leagueId)
        .single()

      if (leagueError || !lg) {
        return new Response(JSON.stringify({ error: 'League not found' }), { status: 404 })
      }

      if (lg.sport !== 'NFL') {
        return new Response(JSON.stringify({ error: 'Only NFL leagues are supported' }), { status: 400 })
      }

      if (!['preseason', 'regular'].includes(lg.league_mode)) {
        return new Response(JSON.stringify({ error: 'League mode not eligible for sync' }), { status: 400 })
      }

      if (!lg.auto_update_results) {
        return new Response(JSON.stringify({ error: 'Auto-update is disabled for this league' }), { status: 400 })
      }

      const phase = lg.league_mode === 'preseason' ? 'preseason' : 'regular'
      scopes.push({ sport: lg.sport, season: lg.season, phase })
    } else {
      const { data: leagues } = await supa.from('leagues').select('sport,season,league_mode')
        .eq('auto_update_results', true).eq('sport', 'NFL')
        .in('league_mode', ['preseason', 'regular'])
      const seen = new Set()
      for (const lg of leagues || []) {
        const phase = lg.league_mode === 'preseason' ? 'preseason' : 'regular'
        const key = `${lg.sport}-${lg.season}-${phase}`
        if (!seen.has(key)) { seen.add(key); scopes.push({ sport: lg.sport, season: lg.season, phase }) }
      }
    }

    const now = new Date()
    const results = []

    for (const scope of scopes) {
      // ── SCHEDULER DECISION ────────────────────────────────────────────
      const decision = await schedulerDecision(supa, now, scope, isManual)

      if (!decision.should) {
        // SKIP — registrar sin consumir API
        await supa.from('sync_runs').insert({
          provider: 'api-sports',
          sport: scope.sport,
          season: scope.season,
          phase: scope.phase,
          trigger_type: isManual ? 'manual' : 'cron',
          status: 'skipped',
          skip_reason: decision.reason,
          games_evaluated: decision.games_evaluated || 0,
          games_needing_sync: decision.games_needing_sync || 0,
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - t0,
        })

        results.push({
          scope,
          status: 'skipped',
          reason: decision.reason,
          games_evaluated: decision.games_evaluated,
          games_needing_sync: decision.games_needing_sync,
        })
        continue
      }

      // ── SYNC — reservar budget y llamar API ─────────────────────────
      const source = isManual ? 'manual' : 'automatic'
      const { data: reservation, error: reserveError } = await supa.rpc('reserve_api_request', {
        p_provider: 'api-sports',
        p_source: source,
      })

      if (reserveError) {
        // Si la función no existe (migración no aplicada), continuar sin budget
        console.warn('[Sync] reserve_api_request RPC not available, proceeding without budget reservation')
      } else if (reservation && !reservation.allowed) {
        // Budget agotado — registrar skip
        await supa.from('sync_runs').insert({
          provider: 'api-sports',
          sport: scope.sport,
          season: scope.season,
          phase: scope.phase,
          trigger_type: isManual ? 'manual' : 'cron',
          status: 'skipped',
          skip_reason: 'budget_exhausted',
          games_evaluated: decision.games_evaluated || 0,
          games_needing_sync: decision.games_needing_sync || 0,
          budget_remaining: reservation.remaining || 0,
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - t0,
        })

        results.push({
          scope,
          status: 'skipped',
          reason: 'budget_exhausted',
          games_evaluated: decision.games_evaluated,
          games_needing_sync: decision.games_needing_sync,
        })
        continue
      }

      // Crear sync_run en estado running
      const { data: run } = await supa.from('sync_runs').insert({
        provider: 'api-sports', sport: scope.sport, season: scope.season,
        phase: scope.phase, trigger_type: isManual ? 'manual' : 'cron', status: 'running',
        games_evaluated: decision.games_evaluated || 0,
        games_needing_sync: decision.games_needing_sync || 0,
      }).select().single()

      try {
        let allGames: any[] = []
        let totalCreated = 0, totalUpdated = 0, totalUnchanged = 0, totalRejected = 0, totalPropagated = 0

        // Consultar API por fecha (1 request por fecha)
        if (decision.dates && decision.dates.length > 0) {
          for (const date of decision.dates) {
            const games = await fetchGamesByDate(apiKey, scope.season, date)
            allGames = allGames.concat(games)
          }
        } else {
          // Fallback: consultar temporada completa (manual sync sin fechas específicas)
          const games = await fetchGames(apiKey, scope.season, scope.phase)
          allGames = games
        }

        // Upsert master_games
        const { created, updated, unchanged, rejected } = await upsertMaster(
          supa, allGames, scope.sport, scope.season, 'api-sports'
        )
        totalCreated = created
        totalUpdated = updated
        totalUnchanged = unchanged
        totalRejected = rejected

        // Propagar a league_games
        totalPropagated = await propagate(supa, allGames, 'api-sports')

        // Actualizar sync_state
        await updateSyncState(supa, allGames, 'api-sports', now)

        const dur = Date.now() - t0
        await supa.from('sync_runs').update({
          status: 'completed', finished_at: new Date().toISOString(), duration_ms: dur,
          records_fetched: allGames.length, records_created: totalCreated, records_updated: totalUpdated,
          records_unchanged: totalUnchanged, records_propagated: totalPropagated, records_rejected: totalRejected,
          budget_remaining: reservation?.remaining ?? null,
        }).eq('id', run.id)

        results.push({
          scope, status: 'completed', fetched: allGames.length,
          created: totalCreated, updated: totalUpdated, unchanged: totalUnchanged,
          propagated: totalPropagated, rejected: totalRejected,
          dates: decision.dates,
        })
      } catch (err: any) {
        const dur = Date.now() - t0
        await supa.from('sync_runs').update({
          status: 'failed', finished_at: new Date().toISOString(), duration_ms: dur,
          error_count: 1, error_message: err.message,
        }).eq('id', run.id)
        results.push({ scope, status: 'failed', error: err.message })
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
