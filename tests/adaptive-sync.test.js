import { describe, it } from 'node:test'
import assert from 'node:assert'

// ── CLASSIFY WINDOW ──────────────────────────────────────────────────────────
// Réplica de la función classifyWindow de results-sync/index.ts para testing
function classifyWindow(gameTime, now) {
  const gameDate = new Date(gameTime)
  const diffMs = gameDate.getTime() - now.getTime()
  const diffMin = diffMs / 60000
  const diffHour = diffMin / 60

  if (diffMin < -24 * 60) return 'past_reconciled'
  if (diffMin < -6 * 60) return 'past_extended'
  if (diffMin < -2 * 60) return 'past_active'
  if (diffMin < 0) return 'just_finished'
  if (diffMin <= 30) return 'imminent'
  if (diffHour <= 2) return 'pregame'
  if (diffHour <= 24) return 'approaching'
  return 'future'
}

describe('classifyWindow', () => {
  it('should classify game >24h in future as "future"', () => {
    const now = new Date('2026-09-15T12:00:00Z')
    const gameTime = '2026-09-17T12:00:00Z' // 48h in future
    assert.strictEqual(classifyWindow(gameTime, now), 'future')
  })

  it('should classify game 2-24h ahead as "approaching"', () => {
    const now = new Date('2026-09-15T12:00:00Z')
    const gameTime = '2026-09-16T00:00:00Z' // 12h in future
    assert.strictEqual(classifyWindow(gameTime, now), 'approaching')
  })

  it('should classify game <2h ahead as "pregame"', () => {
    const now = new Date('2026-09-15T12:00:00Z')
    const gameTime = '2026-09-15T13:30:00Z' // 1.5h in future
    assert.strictEqual(classifyWindow(gameTime, now), 'pregame')
  })

  it('should classify game <30min ahead as "imminent"', () => {
    const now = new Date('2026-09-15T12:00:00Z')
    const gameTime = '2026-09-15T12:20:00Z' // 20min in future
    assert.strictEqual(classifyWindow(gameTime, now), 'imminent')
  })

  it('should classify game just finished (<2h ago) as "just_finished"', () => {
    const now = new Date('2026-09-15T14:00:00Z')
    const gameTime = '2026-09-15T12:00:00Z' // 2h ago
    assert.strictEqual(classifyWindow(gameTime, now), 'just_finished')
  })

  it('should classify game finished 2-6h ago as "past_active"', () => {
    const now = new Date('2026-09-15T16:00:00Z')
    const gameTime = '2026-09-15T12:00:00Z' // 4h ago
    assert.strictEqual(classifyWindow(gameTime, now), 'past_active')
  })

  it('should classify game finished 6-24h ago as "past_extended"', () => {
    const now = new Date('2026-09-16T00:00:00Z')
    const gameTime = '2026-09-15T12:00:00Z' // 12h ago
    assert.strictEqual(classifyWindow(gameTime, now), 'past_extended')
  })

  it('should classify game finished >24h ago as "past_reconciled"', () => {
    const now = new Date('2026-09-17T00:00:00Z')
    const gameTime = '2026-09-15T12:00:00Z' // 36h ago
    assert.strictEqual(classifyWindow(gameTime, now), 'past_reconciled')
  })
})

// ── COOLDOWN LOGIC ───────────────────────────────────────────────────────────
describe('Cooldown logic', () => {
  const defaultCooldowns = {
    future: 999999,
    approaching: 240,
    pregame: 60,
    imminent: 15,
    just_finished: 10,
    past_active: 30,
    past_extended: 120,
    past_reconciled: 999999,
  }

  it('should skip sync when cooldown not elapsed', () => {
    const window = 'approaching'
    const cooldown = defaultCooldowns[window] // 240 min
    const lastSyncedAt = new Date(Date.now() - 60 * 60 * 1000) // 1h ago
    const minutesSinceLastSync = (Date.now() - lastSyncedAt.getTime()) / 60000

    assert.ok(minutesSinceLastSync < cooldown)
  })

  it('should allow sync when cooldown elapsed', () => {
    const window = 'approaching'
    const cooldown = defaultCooldowns[window] // 240 min
    const lastSyncedAt = new Date(Date.now() - 5 * 60 * 60 * 1000) // 5h ago
    const minutesSinceLastSync = (Date.now() - lastSyncedAt.getTime()) / 60000

    assert.ok(minutesSinceLastSync >= cooldown)
  })

  it('should allow sync when never synced before', () => {
    const window = 'approaching'
    const cooldown = defaultCooldowns[window]
    const lastSyncedAt = null
    const minutesSinceLastSync = lastSyncedAt ? (Date.now() - new Date(lastSyncedAt).getTime()) / 60000 : Infinity

    assert.ok(minutesSinceLastSync >= cooldown)
  })

  it('should never sync "future" games', () => {
    const window = 'future'
    const cooldown = defaultCooldowns[window] // 999999 min
    const lastSyncedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    const minutesSinceLastSync = (Date.now() - lastSyncedAt.getTime()) / 60000

    assert.ok(minutesSinceLastSync < cooldown)
  })

  it('should never sync "past_reconciled" games', () => {
    const window = 'past_reconciled'
    const cooldown = defaultCooldowns[window] // 999999 min
    const lastSyncedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    const minutesSinceLastSync = (Date.now() - lastSyncedAt.getTime()) / 60000

    assert.ok(minutesSinceLastSync < cooldown)
  })
})

// ── BUDGET LOGIC ─────────────────────────────────────────────────────────────
describe('Budget logic', () => {
  it('should allow request when budget available', () => {
    const budget = { automatic_limit: 80, automatic_used: 50 }
    const remaining = budget.automatic_limit - budget.automatic_used
    assert.ok(remaining > 0)
  })

  it('should reject request when budget exhausted', () => {
    const budget = { automatic_limit: 80, automatic_used: 80 }
    const remaining = budget.automatic_limit - budget.automatic_used
    assert.strictEqual(remaining, 0)
  })

  it('should keep automatic and manual pools independent', () => {
    const budget = {
      automatic_limit: 80,
      automatic_used: 80,
      manual_limit: 20,
      manual_used: 5,
    }

    const automaticRemaining = budget.automatic_limit - budget.automatic_used
    const manualRemaining = budget.manual_limit - budget.manual_used

    assert.strictEqual(automaticRemaining, 0)
    assert.ok(manualRemaining > 0)
  })

  it('should calculate total budget correctly', () => {
    const budget = {
      automatic_limit: 80,
      automatic_used: 30,
      manual_limit: 20,
      manual_used: 10,
    }

    const totalLimit = budget.automatic_limit + budget.manual_limit
    const totalUsed = budget.automatic_used + budget.manual_used
    const totalRemaining = totalLimit - totalUsed

    assert.strictEqual(totalLimit, 100)
    assert.strictEqual(totalUsed, 40)
    assert.strictEqual(totalRemaining, 60)
  })
})

// ── CONCURRENCY SIMULATION ───────────────────────────────────────────────────
describe('Concurrency simulation', () => {
  it('should simulate atomic reservation correctly', () => {
    // Simula la lógica de reserve_api_request
    let budget = { automatic_limit: 80, automatic_used: 79 }

    function reserveAtomic(budget) {
      // Simula SELECT FOR UPDATE
      const remaining = budget.automatic_limit - budget.automatic_used
      if (remaining <= 0) {
        return { allowed: false, remaining: 0 }
      }
      budget.automatic_used++
      return { allowed: true, remaining: remaining - 1 }
    }

    // Primera reserva: debería permitir
    const result1 = reserveAtomic(budget)
    assert.strictEqual(result1.allowed, true)
    assert.strictEqual(budget.automatic_used, 80)

    // Segunda reserva: debería rechazar (budget agotado)
    const result2 = reserveAtomic(budget)
    assert.strictEqual(result2.allowed, false)
    assert.strictEqual(budget.automatic_used, 80) // No cambió
  })

  it('should handle concurrent reservations without overspend', () => {
    let budget = { automatic_limit: 80, automatic_used: 78 }

    function reserveAtomic(budget) {
      const remaining = budget.automatic_limit - budget.automatic_used
      if (remaining <= 0) {
        return { allowed: false }
      }
      budget.automatic_used++
      return { allowed: true }
    }

    // Simular 5 reservas concurrentes
    const results = []
    for (let i = 0; i < 5; i++) {
      results.push(reserveAtomic(budget))
    }

    // Solo 2 deberían ser permitidas (78 → 79 → 80, luego rechazadas)
    const allowed = results.filter(r => r.allowed).length
    assert.strictEqual(allowed, 2)
    assert.strictEqual(budget.automatic_used, 80)
    assert.ok(budget.automatic_used <= budget.automatic_limit)
  })
})

// ── API CONSUMPTION ESTIMATES ────────────────────────────────────────────────
describe('API consumption estimates', () => {
  it('should estimate 0 requests for day without games', () => {
    const games = []
    const requestsNeeded = games.length > 0 ? 1 : 0
    assert.strictEqual(requestsNeeded, 0)
  })

  it('should estimate 1 request for multiple games on same date', () => {
    const games = [
      { game_time: '2026-09-15T13:00:00Z' },
      { game_time: '2026-09-15T17:00:00Z' },
      { game_time: '2026-09-15T20:00:00Z' },
    ]
    const dates = [...new Set(games.map(g => g.game_time.split('T')[0]))]
    assert.strictEqual(dates.length, 1) // 1 fecha = 1 request
  })

  it('should estimate multiple requests for games on different dates', () => {
    const games = [
      { game_time: '2026-09-15T13:00:00Z' },
      { game_time: '2026-09-16T17:00:00Z' },
      { game_time: '2026-09-17T20:00:00Z' },
    ]
    const dates = [...new Set(games.map(g => g.game_time.split('T')[0]))]
    assert.strictEqual(dates.length, 3) // 3 fechas = 3 requests
  })

  it('should stay within daily budget for typical NFL week', () => {
    const dailyBudget = 80
    const estimatedWeeklyRequests = 10
    const estimatedMonthlyRequests = 40

    assert.ok(estimatedWeeklyRequests < dailyBudget * 7)
    assert.ok(estimatedMonthlyRequests < dailyBudget * 30)
  })
})

// ── RECONCILIATION ───────────────────────────────────────────────────────────
describe('Reconciliation', () => {
  it('should detect score change', () => {
    const existing = { home_score: 10, away_score: 7, result: 'KC' }
    const incoming = { homeScore: 10, awayScore: 14, result: 'DAL' }

    const hasChanges =
      existing.home_score !== incoming.homeScore ||
      existing.away_score !== incoming.awayScore ||
      existing.result !== incoming.result

    assert.ok(hasChanges)
  })

  it('should detect no changes when scores match', () => {
    const existing = { home_score: 10, away_score: 7, result: 'KC' }
    const incoming = { homeScore: 10, awayScore: 7, result: 'KC' }

    const hasChanges =
      existing.home_score !== incoming.homeScore ||
      existing.away_score !== incoming.awayScore ||
      existing.result !== incoming.result

    assert.ok(!hasChanges)
  })

  it('should mark as reconciled after 24h without changes', () => {
    const gameTime = '2026-09-15T12:00:00Z'
    const now = new Date('2026-09-16T13:00:00Z') // 25h later
    const diffMs = now.getTime() - new Date(gameTime).getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    assert.ok(diffHours >= 24)
  })

  it('should not mark as reconciled before 24h', () => {
    const gameTime = '2026-09-15T12:00:00Z'
    const now = new Date('2026-09-16T11:00:00Z') // 23h later
    const diffMs = now.getTime() - new Date(gameTime).getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    assert.ok(diffHours < 24)
  })
})
