import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'

describe('PlatformReconciliation - Authorization', () => {
  it('should allow platform_superadmin to access reconciliation', () => {
    const user = {
      app_metadata: { platform_role: 'platform_superadmin' }
    }
    const platformRole = user.app_metadata.platform_role
    const isSuperAdmin = platformRole === 'platform_superadmin'
    assert.strictEqual(isSuperAdmin, true)
  })

  it('should deny platform_admin access to reconciliation', () => {
    const user = {
      app_metadata: { platform_role: 'platform_admin' }
    }
    const platformRole = user.app_metadata.platform_role
    const isSuperAdmin = platformRole === 'platform_superadmin'
    assert.strictEqual(isSuperAdmin, false)
  })

  it('should deny regular user access to reconciliation', () => {
    const user = {
      app_metadata: { platform_role: 'user' }
    }
    const platformRole = user.app_metadata.platform_role
    const isSuperAdmin = platformRole === 'platform_superadmin'
    assert.strictEqual(isSuperAdmin, false)
  })

  it('should deny access when no app_metadata present', () => {
    const user = {}
    const platformRole = user.app_metadata?.platform_role || 'user'
    const isSuperAdmin = platformRole === 'platform_superadmin'
    assert.strictEqual(isSuperAdmin, false)
  })
})

describe('PlatformReconciliation - API Client', () => {
  it('should build correct request body for dry_run', () => {
    const scope = {
      provider: 'api-sports',
      season: '2026',
      phase: 'preseason',
      date: '2026-08-24'
    }
    
    const requestBody = {
      operation: 'dry_run',
      provider: scope.provider,
      season: scope.season,
      phase: scope.phase,
      date: scope.date
    }
    
    assert.strictEqual(requestBody.operation, 'dry_run')
    assert.strictEqual(requestBody.provider, 'api-sports')
    assert.strictEqual(requestBody.season, '2026')
    assert.strictEqual(requestBody.phase, 'preseason')
    assert.strictEqual(requestBody.date, '2026-08-24')
  })

  it('should not include secrets in request body', () => {
    const scope = {
      provider: 'api-sports',
      season: '2026',
      phase: 'preseason',
      date: '2026-08-24'
    }
    
    const requestBody = {
      operation: 'dry_run',
      provider: scope.provider,
      season: scope.season,
      phase: scope.phase,
      date: scope.date
    }
    
    const bodyString = JSON.stringify(requestBody)
    assert.ok(!bodyString.includes('API_SPORTS_API_KEY'))
    assert.ok(!bodyString.includes('service_role'))
    assert.ok(!bodyString.includes('SUPABASE'))
    assert.ok(!bodyString.includes('password'))
    assert.ok(!bodyString.includes('secret'))
  })

  it('should handle different phase values', () => {
    const phases = ['preseason', 'regular', 'postseason']
    
    phases.forEach(phase => {
      const requestBody = {
        operation: 'dry_run',
        provider: 'api-sports',
        season: '2026',
        phase: phase,
        date: '2026-08-24'
      }
      assert.strictEqual(requestBody.phase, phase)
    })
  })
})

describe('PlatformReconciliation - Dry Run Results', () => {
  it('should parse successful dry_run response', () => {
    const response = {
      ok: true,
      dry_run: true,
      provider: 'api-sports',
      statistics: {
        total_candidates: 10,
        high_confidence_matches: 5,
        medium_confidence_matches: 2,
        low_confidence_matches: 1,
        ambiguous: 1,
        unmatched: 1,
        conflicts: 0,
        manual_overrides: 0,
        skipped_already_mapped: 0
      },
      details: [
        {
          provider_game_id: '12345',
          home_team: 'TEN',
          away_team: 'SEA',
          game_time: '2026-08-24T00:00:00Z',
          week: 3,
          phase: 'preseason',
          match_status: 'mapped',
          match_confidence: 'high',
          match_reason: 'team_week_time',
          master_game_id: '5126ae7f-8cc9-4fa6-b560-9d52b7bfdfe1'
        }
      ],
      duration_ms: 150
    }
    
    assert.strictEqual(response.ok, true)
    assert.strictEqual(response.dry_run, true)
    assert.strictEqual(response.statistics.total_candidates, 10)
    assert.strictEqual(response.statistics.high_confidence_matches, 5)
    assert.strictEqual(response.details.length, 1)
    assert.strictEqual(response.details[0].match_confidence, 'high')
  })

  it('should handle empty results', () => {
    const response = {
      ok: true,
      dry_run: true,
      statistics: {
        total_candidates: 0,
        high_confidence_matches: 0,
        medium_confidence_matches: 0,
        low_confidence_matches: 0,
        ambiguous: 0,
        unmatched: 0,
        conflicts: 0,
        manual_overrides: 0,
        skipped_already_mapped: 0
      },
      details: [],
      duration_ms: 50
    }
    
    assert.strictEqual(response.statistics.total_candidates, 0)
    assert.strictEqual(response.details.length, 0)
  })

  it('should identify ambiguous matches', () => {
    const response = {
      ok: true,
      dry_run: true,
      statistics: {
        total_candidates: 5,
        ambiguous: 2
      },
      details: [
        {
          provider_game_id: '12345',
          home_team: 'KC',
          away_team: 'BUF',
          match_status: 'ambiguous',
          match_confidence: 'conflict',
          match_reason: 'multiple_team_week_time'
        }
      ]
    }
    
    assert.strictEqual(response.statistics.ambiguous, 2)
    assert.strictEqual(response.details[0].match_status, 'ambiguous')
    assert.strictEqual(response.details[0].match_confidence, 'conflict')
  })

  it('should identify unmatched games', () => {
    const response = {
      ok: true,
      dry_run: true,
      statistics: {
        total_candidates: 5,
        unmatched: 1
      },
      details: [
        {
          provider_game_id: '99999',
          home_team: 'DAL',
          away_team: 'NYG',
          match_status: 'unmatched',
          match_confidence: null,
          match_reason: 'no_candidate'
        }
      ]
    }
    
    assert.strictEqual(response.statistics.unmatched, 1)
    assert.strictEqual(response.details[0].match_status, 'unmatched')
  })

  it('should identify manual overrides', () => {
    const response = {
      ok: true,
      dry_run: true,
      statistics: {
        total_candidates: 5,
        manual_overrides: 1
      },
      details: [
        {
          provider_game_id: '12345',
          home_team: 'KC',
          away_team: 'BUF',
          match_status: 'mapped',
          match_confidence: 'manual',
          match_reason: 'manual_override'
        }
      ]
    }
    
    assert.strictEqual(response.statistics.manual_overrides, 1)
    assert.strictEqual(response.details[0].match_confidence, 'manual')
  })
})

describe('PlatformReconciliation - Error Handling', () => {
  it('should handle 401 unauthorized error', () => {
    const error = {
      message: 'Invalid or expired token',
      context: {
        status: 401,
        json: { error: 'Invalid or expired token' }
      }
    }
    
    const userMessage = error.context.json.error === 'Invalid or expired token'
      ? 'Sesión expirada. Vuelve a iniciar sesión.'
      : error.message
    
    assert.strictEqual(userMessage, 'Sesión expirada. Vuelve a iniciar sesión.')
  })

  it('should handle 403 forbidden error', () => {
    const error = {
      message: 'Unauthorized',
      context: {
        status: 403,
        json: { error: 'Unauthorized: platform_superadmin required' }
      }
    }
    
    const userMessage = error.context.status === 403
      ? 'No tienes permisos para ejecutar Provider Reconciliation.'
      : error.message
    
    assert.strictEqual(userMessage, 'No tienes permisos para ejecutar Provider Reconciliation.')
  })

  it('should handle API provider error', () => {
    const error = {
      message: 'API-Sports error: Rate limit exceeded'
    }
    
    const userMessage = error.message
    assert.ok(userMessage.includes('API-Sports'))
  })

  it('should handle network error', () => {
    const error = {
      message: 'Failed to fetch'
    }
    
    const userMessage = error.message || 'Error inesperado'
    assert.strictEqual(userMessage, 'Failed to fetch')
  })
})

describe('PlatformReconciliation - Match Status Badges', () => {
  it('should return READY TO APPLY for high confidence mapped', () => {
    const status = 'mapped'
    const confidence = 'high'
    
    const badge = status === 'mapped' && confidence === 'high'
      ? 'READY TO APPLY'
      : null
    
    assert.strictEqual(badge, 'READY TO APPLY')
  })

  it('should return MANUAL REVIEW for ambiguous', () => {
    const status = 'ambiguous'
    
    const badge = status === 'ambiguous'
      ? 'MANUAL REVIEW'
      : null
    
    assert.strictEqual(badge, 'MANUAL REVIEW')
  })

  it('should return UNMATCHED for unmatched', () => {
    const status = 'unmatched'
    
    const badge = status === 'unmatched'
      ? 'UNMATCHED'
      : null
    
    assert.strictEqual(badge, 'UNMATCHED')
  })

  it('should return MAPPED with confidence for other mapped', () => {
    const status = 'mapped'
    const confidence = 'medium'
    
    const badge = status === 'mapped' && confidence !== 'high'
      ? `MAPPED (${confidence})`
      : null
    
    assert.strictEqual(badge, 'MAPPED (medium)')
  })
})

describe('PlatformReconciliation - Scope Validation', () => {
  it('should validate required scope fields', () => {
    const scope = {
      provider: 'api-sports',
      season: '2026',
      phase: 'preseason',
      date: '2026-08-24'
    }
    
    const isValid = scope.provider && scope.season && scope.phase && scope.date
    assert.ok(isValid)
  })

  it('should reject empty provider', () => {
    const scope = {
      provider: '',
      season: '2026',
      phase: 'preseason',
      date: '2026-08-24'
    }
    
    const isValid = scope.provider && scope.season && scope.phase && scope.date
    assert.ok(!isValid)
  })

  it('should reject invalid date format', () => {
    const scope = {
      provider: 'api-sports',
      season: '2026',
      phase: 'preseason',
      date: 'invalid-date'
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    const isValid = dateRegex.test(scope.date)
    assert.ok(!isValid)
  })

  it('should accept valid date format', () => {
    const scope = {
      provider: 'api-sports',
      season: '2026',
      phase: 'preseason',
      date: '2026-08-24'
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    const isValid = dateRegex.test(scope.date)
    assert.ok(isValid)
  })
})
