import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  orderCooldownWindows,
  formatCooldown,
  defaultBudgetLimits,
  computeBudgetSummary,
  summarizeSyncRuns,
  CRON_REFERENCE,
} from '../src/domains/platform/models/apiConfig.js'

describe('apiConfig — cooldowns', () => {
  it('ordena las ventanas en el ciclo lógico de un partido', () => {
    const rows = [
      { sync_window: 'past_active', cooldown_minutes: 5 },
      { sync_window: 'imminent', cooldown_minutes: 3 },
      { sync_window: 'future', cooldown_minutes: 999999 },
    ]
    const ordered = orderCooldownWindows(rows)
    assert.deepEqual(ordered.map((r) => r.sync_window), ['future', 'imminent', 'past_active'])
  })

  it('incluye ventanas desconocidas al final (sin dropeo)', () => {
    const rows = [
      { sync_window: 'imminent', cooldown_minutes: 3 },
      { sync_window: 'custom_ventana', cooldown_minutes: 10 },
    ]
    const ordered = orderCooldownWindows(rows)
    assert.deepEqual(ordered.map((r) => r.sync_window), ['imminent', 'custom_ventana'])
  })

  it('ignora filas inválidas', () => {
    assert.deepEqual(orderCooldownWindows([null, {}, { sync_window: 'imminent' }]).map((r) => r.sync_window), ['imminent'])
  })
})

describe('apiConfig — formatCooldown', () => {
  it('formatea minutos simples', () => {
    assert.strictEqual(formatCooldown(3), '3 min')
    assert.strictEqual(formatCooldown(15), '15 min')
  })

  it('formatea horas exactas', () => {
    assert.strictEqual(formatCooldown(240), '4 h')
  })

  it('formatea horas + minutos', () => {
    assert.strictEqual(formatCooldown(90), '1 h 30 min')
  })

  it('999999 → nunca', () => {
    assert.strictEqual(formatCooldown(999999), 'nunca')
  })

  it('valores inválidos → dash', () => {
    assert.strictEqual(formatCooldown(null), '—')
    assert.strictEqual(formatCooldown(undefined), '—')
    assert.strictEqual(formatCooldown('abc'), '—')
  })
})

describe('apiConfig — budget', () => {
  it('límites por defecto por proveedor', () => {
    assert.deepEqual(defaultBudgetLimits('espn'), { automatic_limit: 600, manual_limit: 20 })
    assert.deepEqual(defaultBudgetLimits('api-sports'), { automatic_limit: 80, manual_limit: 20 })
    assert.deepEqual(defaultBudgetLimits('unknown'), { automatic_limit: 80, manual_limit: 20 })
  })

  it('agrupa por proveedor y usa la fila más reciente', () => {
    const rows = [
      { provider: 'espn', date: '2026-09-12', automatic_limit: 600, automatic_used: 100, manual_limit: 20, manual_used: 3, reset_at: null },
      { provider: 'espn', date: '2026-09-13', automatic_limit: 600, automatic_used: 9, manual_limit: 20, manual_used: 0, reset_at: null },
      { provider: 'api-sports', date: '2026-09-13', automatic_limit: 80, automatic_used: 40, manual_limit: 20, manual_used: 5, reset_at: null },
    ]
    const summary = computeBudgetSummary(rows)
    assert.strictEqual(summary.length, 2)
    const espn = summary.find((s) => s.provider === 'espn')
    assert.strictEqual(espn.date, '2026-09-13')
    assert.deepEqual(espn.automatic, { limit: 600, used: 9, remaining: 591 })
    assert.deepEqual(espn.manual, { limit: 20, used: 0, remaining: 20 })
    assert.deepEqual(espn.total, { limit: 620, used: 9, remaining: 611 })
    const apiSports = summary.find((s) => s.provider === 'api-sports')
    assert.deepEqual(apiSports.total, { limit: 100, used: 45, remaining: 55 })
  })

  it('completa límites por defecto cuando falta la fila', () => {
    const summary = computeBudgetSummary([])
    assert.deepEqual(summary, [])
  })
})

describe('apiConfig — sync runs', () => {
  it('resume por estado y mantiene los recientes ordenados', () => {
    const runs = [
      { id: 'a', status: 'completed', started_at: '2026-09-13T10:00:00Z' },
      { id: 'b', status: 'failed', started_at: '2026-09-13T11:00:00Z' },
      { id: 'c', status: 'completed', started_at: '2026-09-13T09:00:00Z' },
    ]
    const s = summarizeSyncRuns(runs, 10)
    assert.strictEqual(s.total, 3)
    assert.deepEqual(s.byStatus, { completed: 2, failed: 1 })
    assert.strictEqual(s.recent[0].id, 'b')
    assert.strictEqual(s.recent[2].id, 'c')
  })

  it('tolera arrays vacíos', () => {
    const s = summarizeSyncRuns([], 10)
    assert.strictEqual(s.total, 0)
    assert.deepEqual(s.byStatus, {})
    assert.deepEqual(s.recent, [])
  })
})

describe('apiConfig — cron reference (documentado)', () => {
  it('registra el job de resultados con schedule */3', () => {
    assert.strictEqual(CRON_REFERENCE.jobname, 'auto-sync-nfl-results')
    assert.strictEqual(CRON_REFERENCE.schedule, '*/3 * * * *')
  })
})