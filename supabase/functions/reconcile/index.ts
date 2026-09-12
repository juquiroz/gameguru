import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const TIME_TOLERANCE_MS = 2 * 60 * 60 * 1000

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

function parseGameTime(gameTime: string | null): Date | null {
  if (!gameTime) return null
  const d = new Date(gameTime)
  return isNaN(d.getTime()) ? null : d
}

function timeDiffMs(timeA: string | null, timeB: string | null): number {
  const a = parseGameTime(timeA)
  const b = parseGameTime(timeB)
  if (!a || !b) return Infinity
  return Math.abs(a.getTime() - b.getTime())
}

function isManualOverride(mg: any): boolean {
  return mg.mapping_status === 'manual_override' || mg.mapping_confidence === 'manual'
}

function matchGame(pg: any, masterGames: any[], provider: string) {
  // Priority 1: Exact provider external ID
  const exact = masterGames.find(
    mg => mg.provider === provider && mg.external_game_id === String(pg.externalGameId)
  )
  if (exact) {
    return { status: 'mapped', confidence: 'high', matchedGame: exact, reason: 'exact_external_id' }
  }

  // Priority 2: Team + week/phase + time ±2h
  const weekTimeMatches = masterGames.filter(mg => {
    if (mg.home_abbr !== pg.homeTeamAbbr || mg.away_abbr !== pg.awayTeamAbbr) return false
    if (mg.phase !== pg.phase) return false
    if (pg.week != null && mg.week != null && mg.week !== pg.week) return false
    return timeDiffMs(mg.game_time, pg.gameTime) <= TIME_TOLERANCE_MS
  })
  if (weekTimeMatches.length === 1) {
    return { status: 'mapped', confidence: 'high', matchedGame: weekTimeMatches[0], reason: 'team_week_time' }
  }
  if (weekTimeMatches.length > 1) {
    return { status: 'ambiguous', confidence: 'conflict', candidates: weekTimeMatches, reason: 'multiple_team_week_time' }
  }

  // Priority 3: Team + time (no week constraint)
  const teamTimeMatches = masterGames.filter(mg => {
    if (mg.home_abbr !== pg.homeTeamAbbr || mg.away_abbr !== pg.awayTeamAbbr) return false
    if (mg.phase !== pg.phase) return false
    return timeDiffMs(mg.game_time, pg.gameTime) <= TIME_TOLERANCE_MS
  })
  if (teamTimeMatches.length === 1) {
    return { status: 'mapped', confidence: 'medium', matchedGame: teamTimeMatches[0], reason: 'team_time' }
  }
  if (teamTimeMatches.length > 1) {
    return { status: 'ambiguous', confidence: 'conflict', candidates: teamTimeMatches, reason: 'multiple_team_time' }
  }

  // Priority 4: Fuzzy (same teams + time, no phase constraint)
  const fuzzyMatches = masterGames.filter(mg => {
    if (mg.home_abbr !== pg.homeTeamAbbr || mg.away_abbr !== pg.awayTeamAbbr) return false
    return timeDiffMs(mg.game_time, pg.gameTime) <= TIME_TOLERANCE_MS
  })
  if (fuzzyMatches.length === 1) {
    return { status: 'mapped', confidence: 'low', matchedGame: fuzzyMatches[0], reason: 'fuzzy' }
  }
  if (fuzzyMatches.length > 1) {
    return { status: 'ambiguous', confidence: 'conflict', candidates: fuzzyMatches, reason: 'multiple_fuzzy' }
  }

  return { status: 'unmatched', confidence: null, reason: 'no_candidate' }
}

function resolveConflict(existingMg: any, _pg: any, newProvider: string) {
  if (isManualOverride(existingMg)) {
    return { action: 'skip', reason: 'manual_override_protected' }
  }
  if (existingMg.provider === newProvider && existingMg.external_game_id != null && existingMg.mapping_status === 'mapped') {
    return { action: 'skip', reason: 'existing_authoritative_mapping' }
  }
  if (!existingMg.provider) {
    return { action: 'map', reason: 'no_existing_provider' }
  }
  if (existingMg.provider && existingMg.provider !== newProvider) {
    return { action: 'review', reason: 'provider_precedence_tie' }
  }
  return { action: 'review', reason: 'unresolved_conflict' }
}

function snapshotMasterGame(mg: any) {
  if (!mg) return null
  return {
    id: mg.id, provider: mg.provider ?? null, external_game_id: mg.external_game_id ?? null,
    external_competition_id: mg.external_competition_id ?? null, mapping_status: mg.mapping_status ?? null,
    mapping_confidence: mg.mapping_confidence ?? null, reconciliation_source: mg.reconciliation_source ?? null,
    game_time: mg.game_time ?? null, home_score: mg.home_score ?? null, away_score: mg.away_score ?? null,
    result: mg.result ?? null, finished: mg.finished ?? null, home_abbr: mg.home_abbr ?? null,
    away_abbr: mg.away_abbr ?? null, week: mg.week ?? null, phase: mg.phase ?? null, season: mg.season ?? null,
    mapped_at: mg.mapped_at ?? null, mapped_by: mg.mapped_by ?? null,
  }
}

// ── NORMALIZE ──────────────────────────────────────────────────────────────────
function normalize(g: any) {
  const h = TEAM_MAP[g.teams?.home?.name], a = TEAM_MAP[g.teams?.away?.name]
  if (!h || !a) return null
  const phase = SEASON_TYPE_MAP[g.league?.season_type] || 'regular'
  return {
    externalGameId: String(g.fixture?.id),
    externalCompetitionId: `${g.league?.id}-${g.league?.season}`,
    homeTeamAbbr: h, awayTeamAbbr: a, gameTime: g.fixture?.date,
    week: g.fixture?.week || null, phase,
  }
}

// ── API CALLS ──────────────────────────────────────────────────────────────────
async function fetchGamesByDate(key: string, season: string, date: string) {
  const p = new URLSearchParams({ league: '1', season, date })
  const r = await fetch(`https://v1.american-football.api-sports.io/games?${p}`, {
    headers: { 'x-apisports-key': key, Accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`API-Sports ${r.status}`)
  const d = await r.json()
  if (d.errors?.length) throw new Error(`API-Sports: ${JSON.stringify(d.errors)}`)
  return (d.response || []).map(normalize).filter(Boolean)
}

// ── DRY RUN ────────────────────────────────────────────────────────────────────
function executeDryRun(providerGames: any[], masterGames: any[], provider: string) {
  const stats = {
    total_candidates: providerGames.length,
    high_confidence_matches: 0, medium_confidence_matches: 0, low_confidence_matches: 0,
    ambiguous: 0, unmatched: 0, conflicts: 0, manual_overrides: 0, skipped_already_mapped: 0,
  }
  const details: any[] = []

  for (const pg of providerGames) {
    const match = matchGame(pg, masterGames, provider)
    const detail: any = {
      provider_game_id: pg.externalGameId, home_team: pg.homeTeamAbbr, away_team: pg.awayTeamAbbr,
      game_time: pg.gameTime, week: pg.week, phase: pg.phase,
      match_status: match.status, match_confidence: match.confidence, match_reason: match.reason,
      master_game_id: match.matchedGame?.id ?? null,
    }

    if (match.status === 'mapped' && match.matchedGame) {
      const resolution = resolveConflict(match.matchedGame, pg, provider)
      detail.resolution_action = resolution.action
      detail.resolution_reason = resolution.reason

      if (resolution.action === 'skip' && resolution.reason === 'manual_override_protected') stats.manual_overrides++
      else if (resolution.action === 'skip') stats.skipped_already_mapped++
      else if (resolution.action === 'review') stats.conflicts++
      else {
        if (match.confidence === 'high') stats.high_confidence_matches++
        else if (match.confidence === 'medium') stats.medium_confidence_matches++
        else if (match.confidence === 'low') stats.low_confidence_matches++
      }
    } else if (match.status === 'ambiguous') {
      stats.ambiguous++
    } else if (match.status === 'unmatched') {
      stats.unmatched++
    }
    details.push(detail)
  }

  return { dry_run: true, provider, statistics: stats, details }
}

// ── APPLY ──────────────────────────────────────────────────────────────────────
async function executeApply(supa: any, providerGames: any[], masterGames: any[], provider: string, actor: string) {
  const result = {
    mapped: [] as any[], ambiguous: [] as any[], unmatched: [] as any[],
    skipped: [] as any[], conflicts: [] as any[], auditPayloads: [] as any[],
    propagationUpdates: [] as any[],
  }

  for (const pg of providerGames) {
    const match = matchGame(pg, masterGames, provider)

    if (match.status === 'unmatched') {
      result.unmatched.push({ provider_game_id: pg.externalGameId })
      result.auditPayloads.push({
        action: 'reconciliation_unmatched', entity: 'master_games', entity_id: null,
        payload: { provider, external_game_id: pg.externalGameId, actor, reason: 'no_candidate',
          provider_game: { externalGameId: pg.externalGameId, homeTeamAbbr: pg.homeTeamAbbr, awayTeamAbbr: pg.awayTeamAbbr, gameTime: pg.gameTime, week: pg.week, phase: pg.phase } },
      })
      continue
    }

    if (match.status === 'ambiguous') {
      result.ambiguous.push({ provider_game_id: pg.externalGameId })
      result.auditPayloads.push({
        action: 'reconciliation_ambiguous', entity: 'master_games', entity_id: null,
        payload: { provider, external_game_id: pg.externalGameId, actor, reason: 'multiple_candidates',
          candidates: match.candidates.map((c: any) => ({ id: c.id, home_abbr: c.home_abbr, away_abbr: c.away_abbr, game_time: c.game_time })),
          provider_game: { externalGameId: pg.externalGameId, homeTeamAbbr: pg.homeTeamAbbr, awayTeamAbbr: pg.awayTeamAbbr, gameTime: pg.gameTime } },
      })
      continue
    }

    if (match.status === 'mapped' && match.matchedGame) {
      const resolution = resolveConflict(match.matchedGame, pg, provider)

      if (resolution.action === 'skip') {
        result.skipped.push({ provider_game_id: pg.externalGameId, master_game_id: match.matchedGame.id })
        result.auditPayloads.push({
          action: 'reconciliation_skipped', entity: 'master_games', entity_id: match.matchedGame.id,
          payload: { provider, external_game_id: pg.externalGameId, actor, reason: resolution.reason,
            before_state: snapshotMasterGame(match.matchedGame) },
        })
        continue
      }

      if (resolution.action === 'review') {
        result.conflicts.push({ provider_game_id: pg.externalGameId, master_game_id: match.matchedGame.id })
        result.auditPayloads.push({
          action: 'reconciliation_skipped', entity: 'master_games', entity_id: match.matchedGame.id,
          payload: { provider, external_game_id: pg.externalGameId, actor, reason: 'conflict_requires_review',
            before_state: snapshotMasterGame(match.matchedGame) },
        })
        continue
      }

      // Map: update master_game
      const before = snapshotMasterGame(match.matchedGame)
      const updateData: any = {
        provider,
        external_game_id: pg.externalGameId,
        external_competition_id: pg.externalCompetitionId ?? null,
        mapping_status: 'mapped',
        mapping_confidence: match.confidence,
        reconciliation_source: 'backfill',
        mapped_at: new Date().toISOString(),
        mapped_by: actor !== 'system' ? actor : null,
      }

      const { error: updateError } = await supa.from('master_games')
        .update(updateData)
        .eq('id', match.matchedGame.id)

      if (updateError) {
        console.error(`[Reconcile] Update error for ${match.matchedGame.id}:`, updateError)
        continue
      }

      const after = { ...match.matchedGame, ...updateData }
      result.mapped.push({
        provider_game_id: pg.externalGameId, master_game_id: match.matchedGame.id,
        before, after: snapshotMasterGame(after), confidence: match.confidence, reason: match.reason,
      })

      // Propagate to league_games
      const { data: leagueGames } = await supa.from('league_games')
        .select('id, home_score, away_score, result, finished, game_time, training_session_id')
        .eq('master_game_id', match.matchedGame.id)
        .is('training_session_id', null)

      if (leagueGames && leagueGames.length > 0) {
        const propFields = ['home_score', 'away_score', 'result', 'finished', 'game_time'] as const
        for (const lg of leagueGames) {
          const propUpdate: any = {}
          const propBefore: any = {}
          const propAfter: any = {}
          let hasChanges = false

          for (const field of propFields) {
            const newVal = (after as any)[field] ?? (pg as any)[field === 'game_time' ? 'gameTime' : field]
            if (lg[field] !== newVal) {
              propUpdate[field] = newVal
              propBefore[field] = lg[field]
              propAfter[field] = newVal
              hasChanges = true
            }
          }

          if (hasChanges) {
            await supa.from('league_games').update(propUpdate).eq('id', lg.id)
            result.propagationUpdates.push({
              league_game_id: lg.id, before: propBefore, after: propAfter,
            })
          }
        }
      }

      result.auditPayloads.push({
        action: 'reconciliation_auto_map', entity: 'master_games', entity_id: match.matchedGame.id,
        payload: {
          provider, external_game_id: pg.externalGameId, actor, reason: match.reason, confidence: match.confidence,
          mapping_status_before: before.mapping_status, mapping_status_after: 'mapped',
          provider_before: before.provider, provider_after: provider,
          external_id_before: before.external_game_id, external_id_after: pg.externalGameId,
          before_state: before, after_state: snapshotMasterGame(after),
          propagation_after: {
            league_games_affected: result.propagationUpdates.length,
            changes: result.propagationUpdates.slice(-leagueGames!.length).map((u: any) => ({
              league_game_id: u.league_game_id, before: u.before, after: u.after,
            })),
          },
        },
      })

      // Update local masterGames array for subsequent matches
      masterGames = masterGames.map(mg => mg.id === match.matchedGame.id ? { ...mg, ...updateData } : mg)
    }
  }

  return {
    dry_run: false, provider,
    statistics: {
      total_candidates: providerGames.length,
      mapped: result.mapped.length, ambiguous: result.ambiguous.length,
      unmatched: result.unmatched.length, skipped: result.skipped.length,
      conflicts: result.conflicts.length, propagation_updates: result.propagationUpdates.length,
    },
    auditPayloads: result.auditPayloads,
  }
}

// ── ROLLBACK ───────────────────────────────────────────────────────────────────
function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  return String(a) === String(b)
}

async function executeRollback(supa: any, auditId: string, actor: string) {
  // Fetch the audit record
  const { data: auditRecord, error: auditError } = await supa
    .from('admin_audit_log')
    .select('*')
    .eq('id', auditId)
    .single()

  if (auditError || !auditRecord) {
    return { error: 'audit_record_not_found', auditId }
  }

  const payload = auditRecord.payload
  if (!payload?.before_state || !payload?.after_state) {
    return { error: 'audit_record_missing_state', auditId }
  }

  const entityId = auditRecord.entity_id
  if (!entityId) {
    return { error: 'audit_record_missing_entity_id', auditId }
  }

  // Fetch current master_game
  const { data: currentMg, error: mgError } = await supa
    .from('master_games')
    .select('*')
    .eq('id', entityId)
    .single()

  if (mgError || !currentMg) {
    return { error: 'master_game_not_found', entityId }
  }

  const beforeState = payload.before_state
  const afterState = payload.after_state
  const fieldsToCheck = [
    'provider', 'external_game_id', 'external_competition_id', 'mapping_status',
    'mapping_confidence', 'reconciliation_source', 'game_time', 'home_score',
    'away_score', 'result', 'finished',
  ]

  const conflicts: any[] = []
  const restorePayload: any = {}

  for (const field of fieldsToCheck) {
    const current = (currentMg as any)[field]
    const before = (beforeState as any)[field]
    const after = (afterState as any)[field]

    if (valuesEqual(current, before)) {
      continue // Already rolled back
    }

    if (valuesEqual(current, after)) {
      restorePayload[field] = before // Can safely restore
    } else {
      conflicts.push({ field, current_value: current, recorded_after_value: after, recorded_before_value: before })
    }
  }

  if (conflicts.length > 0) {
    // Log conflict
    await supa.rpc('log_admin_action', {
      p_action: 'rollback_conflict',
      p_entity: 'master_games',
      p_entity_id: entityId,
      p_payload: {
        original_audit_id: auditId, actor,
        reason: 'current_value_differs_from_after',
        conflicts,
        before_state: snapshotMasterGame(currentMg),
      },
    })

    return { status: 'conflict', conflicts, entityId, auditId }
  }

  if (Object.keys(restorePayload).length === 0) {
    return { status: 'already_rolled_back', entityId, auditId }
  }

  // Apply rollback
  const rollbackBefore = snapshotMasterGame(currentMg)
  const { error: rollbackError } = await supa.from('master_games')
    .update(restorePayload)
    .eq('id', entityId)

  if (rollbackError) {
    return { error: 'rollback_update_failed', entityId, message: rollbackError.message }
  }

  // Log rollback applied
  await supa.rpc('log_admin_action', {
    p_action: 'rollback_applied',
    p_entity: 'master_games',
    p_entity_id: entityId,
    p_payload: {
      original_audit_id: auditId, actor,
      reason: 'rollback_applied',
      before_state: rollbackBefore,
      after_state: { ...currentMg, ...restorePayload },
    },
  })

  return { status: 'applied', restored_fields: Object.keys(restorePayload), entityId, auditId }
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────────
serve(async (req) => {
  const t0 = Date.now()
  try {
    const supaUrl = Deno.env.get('SUPABASE_URL')!
    const supaKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supa = createClient(supaUrl, supaKey)

    // ── AUTHORIZATION ─────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supa.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 })
    }

    const { data: profile } = await supa
      .from('profiles')
      .select('platform_role')
      .eq('id', user.id)
      .single()

    if (profile?.platform_role !== 'platform_superadmin') {
      return new Response(JSON.stringify({ error: 'Unauthorized: platform_superadmin required' }), { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const operation = body.operation || 'dry_run'
    const provider = body.provider || 'api-sports'
    const actor = user.id

    // ── FETCH PROVIDER GAMES ──────────────────────────────────────────────
    const apiKey = Deno.env.get('API_SPORTS_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing API_SPORTS_API_KEY' }), { status: 500 })
    }

    const season = body.season || '2026'
    const phase = body.phase || 'regular'
    const date = body.date || null

    let providerGames: any[] = []
    if (date) {
      providerGames = await fetchGamesByDate(apiKey, season, date)
    } else {
      return new Response(JSON.stringify({ error: 'date parameter is required' }), { status: 400 })
    }

    // ── FETCH EXISTING MASTER GAMES ───────────────────────────────────────
    const { data: masterGames } = await supa
      .from('master_games')
      .select('id, provider, external_game_id, external_competition_id, mapping_status, mapping_confidence, reconciliation_source, game_time, home_score, away_score, result, finished, home_abbr, away_abbr, home_team, away_team, week, phase, season, mapped_at, mapped_by')
      .eq('sport', 'NFL')
      .eq('season', season)
      .eq('phase', phase)

    const existingMasterGames = masterGames || []

    // ── EXECUTE OPERATION ─────────────────────────────────────────────────
    if (operation === 'dry_run') {
      const result = executeDryRun(providerGames, existingMasterGames, provider)
      return new Response(JSON.stringify({ ok: true, ...result, duration_ms: Date.now() - t0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (operation === 'apply') {
      const result = await executeApply(supa, providerGames, existingMasterGames, provider, actor)

      // Write audit records
      for (const audit of result.auditPayloads) {
        await supa.rpc('log_admin_action', {
          p_action: audit.action,
          p_entity: audit.entity,
          p_entity_id: audit.entity_id,
          p_payload: audit.payload,
        })
      }

      return new Response(JSON.stringify({ ok: true, ...result, duration_ms: Date.now() - t0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (operation === 'rollback') {
      const auditId = body.audit_id
      if (!auditId) {
        return new Response(JSON.stringify({ error: 'audit_id is required for rollback' }), { status: 400 })
      }

      const result = await executeRollback(supa, auditId, actor)
      return new Response(JSON.stringify({ ok: true, ...result, duration_ms: Date.now() - t0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unknown operation: ${operation}` }), { status: 400 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
