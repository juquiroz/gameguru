import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { fetchGamesByDate, fetchGamesBySeason } from '../_shared/espn-nfl.ts'

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

// ── WINDOW CLASSIFICATION ──────────────────────────────────────────────────────
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
        sport, season, week: g.week, game_id: `espn-${g.externalGameId}`,
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
    .eq('provider', 'espn')
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

  // Default cooldowns si no hay config en DB (frecuencia alta durante el juego:
  // cron cada 3 min; días NFL jueves/domingo/lunes)
  const defaultCooldowns: Record<string, number> = {
    future: 999999,
    approaching: 240,
    pregame: 15,
    imminent: 3,
    just_finished: 3,
    past_active: 5,
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
    p_provider: 'espn',
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

  // 5. Obtener fechas únicas para consultar (game_time puede venir como
  //    ISO `2026-09-13T17:00:00Z` o con espacio `2026-09-11 00:35:00Z`;
  //    solo interesa la parte de fecha YYYY-MM-DD → `dates=YYYYMMDD`).
  const toDateKey = (gameTime: any) => String(gameTime || '').slice(0, 10)
  const dates = [...new Set(needsSync.map((g: any) => toDateKey(g.game_time)))]

  return {
    should: true,
    games: needsSync,
    games_evaluated: games.length,
    games_needing_sync: needsSync.length,
    dates,
  }
}

// ── CORS ───────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders })
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────────
serve(async (req) => {
  const t0 = Date.now()
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
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
        return json({ error: 'Missing Authorization header' }, 401)
      }

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supa.auth.getUser(token)

      if (authError || !user) {
        return json({ error: 'Invalid or expired token' }, 401)
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
          return json({ error: 'Unauthorized: not admin of this league' }, 403)
        }
      }
    } else {
      const cronSecret = req.headers.get('X-Cron-Secret')
      const expectedSecret = Deno.env.get('CRON_SECRET')

      if (!expectedSecret) {
        return json({ error: 'CRON_SECRET not configured' }, 500)
      }

      if (cronSecret !== expectedSecret) {
        return json({ error: 'Invalid cron secret' }, 403)
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
      return json({
        error: 'Another sync is already in progress',
        running_sync_id: runningSync.id,
        started_at: runningSync.started_at
      }, 409)
    }

    // ── DETERMINAR SCOPES ─────────────────────────────────────────────────
    let scopes: any[] = []
    if (isManual && leagueId) {
      const { data: lg, error: leagueError } = await supa.from('leagues')
        .select('id,sport,season,league_mode,auto_update_results')
        .eq('id', leagueId)
        .single()

      if (leagueError || !lg) {
        return json({ error: 'League not found' }, 404)
      }

      if (lg.sport !== 'NFL') {
        return json({ error: 'Only NFL leagues are supported' }, 400)
      }

      if (!['preseason', 'regular'].includes(lg.league_mode)) {
        return json({ error: 'League mode not eligible for sync' }, 400)
      }

      if (!lg.auto_update_results) {
        return json({ error: 'Auto-update is disabled for this league' }, 400)
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
          provider: 'espn',
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
      // La reserva se hace POR FECHA (1 request ESPN = 1 fecha). Evita
      // subestimar consumo cuando un sync consulta varias fechas.
      const source = isManual ? 'manual' : 'automatic'

      // Crear sync_run en estado running
      const { data: run } = await supa.from('sync_runs').insert({
        provider: 'espn', sport: scope.sport, season: scope.season,
        phase: scope.phase, trigger_type: isManual ? 'manual' : 'cron', status: 'running',
        games_evaluated: decision.games_evaluated || 0,
        games_needing_sync: decision.games_needing_sync || 0,
      }).select().single()

      const reserveOne = async () => {
        const { data: reservation, error: reserveError } = await supa.rpc('reserve_api_request', {
          p_provider: 'espn',
          p_source: source,
        })
        if (reserveError) return { allowed: true, remaining: null } // sin RPC → no limitar
        return reservation || { allowed: true, remaining: null }
      }

      try {
        let allGames: any[] = []
        let totalCreated = 0, totalUpdated = 0, totalUnchanged = 0, totalRejected = 0, totalPropagated = 0
        let budgetRemaining: number | null = null
        let skippedDates = 0

        // Consultar API por fecha (1 request por fecha)
        if (decision.dates && decision.dates.length > 0) {
          for (const date of decision.dates) {
            const reservation = await reserveOne()
            if (!reservation.allowed) { skippedDates++; budgetRemaining = reservation.remaining ?? budgetRemaining; continue }
            budgetRemaining = reservation.remaining ?? budgetRemaining
            const games = await fetchGamesByDate(date)
            allGames = allGames.concat(games)
          }
        } else {
          // Fallback: consultar temporada completa (manual sync sin fechas específicas)
          const reservation = await reserveOne()
          if (reservation.allowed) {
            const games = await fetchGamesBySeason(scope.season, scope.phase)
            allGames = games
          } else {
            skippedDates = 1
            budgetRemaining = reservation.remaining ?? null
          }
        }

        if (allGames.length === 0 && skippedDates > 0) {
          // Todas las fechas bloquearon por presupuesto → skippear sin marcar failed
          await supa.from('sync_runs').update({
            status: 'skipped', skip_reason: 'budget_exhausted',
            finished_at: new Date().toISOString(), duration_ms: Date.now() - t0,
            budget_remaining: budgetRemaining,
          }).eq('id', run.id)
          results.push({ scope, status: 'skipped', reason: 'budget_exhausted' })
          continue
        }

        // Upsert master_games
        const { created, updated, unchanged, rejected } = await upsertMaster(
          supa, allGames, scope.sport, scope.season, 'espn'
        )
        totalCreated = created
        totalUpdated = updated
        totalUnchanged = unchanged
        totalRejected = rejected

        // Propagar a league_games
        totalPropagated = await propagate(supa, allGames, 'espn')

        // Actualizar sync_state
        await updateSyncState(supa, allGames, 'espn', now)

        const dur = Date.now() - t0
        await supa.from('sync_runs').update({
          status: 'completed', finished_at: new Date().toISOString(), duration_ms: dur,
          records_fetched: allGames.length, records_created: totalCreated, records_updated: totalUpdated,
          records_unchanged: totalUnchanged, records_propagated: totalPropagated, records_rejected: totalRejected,
          budget_remaining: budgetRemaining,
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

    return json({ ok: true, results })
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
})
