import { describe, it } from 'node:test'
import assert from 'node:assert'

// ── SCORES PRE-KICKOFF ───────────────────────────────────────────────────────
// Réplica pura de la regla de scores de `supabase/functions/_shared/espn-nfl.ts`
// (normalize): los scores solo se persisten cuando el juego ARRANCÓ — estados
// FINAL (resultado) o LIVE (parcial). Para cualquier otro estado (scheduled /
// pre_game / postponed / cancelled / delayed / suspended) los scores son NULL.
// Sin esto, ESPN manda '0' (o '') en juegos sin iniciar y la UI muestra
// "0 – 0" en semanas abiertas (bug reportado: primer juego @, resto 0-0).

const STATUS_MAP = {
  STATUS_SCHEDULED: 'scheduled',
  STATUS_PRE_GAME: 'scheduled',
  STATUS_IN_PROGRESS: 'live',
  STATUS_HALFTIME: 'live',
  STATUS_FINAL: 'final',
  STATUS_POSTPONED: 'postponed',
  STATUS_DELAYED: 'delayed',
  STATUS_CANCELED: 'cancelled',
  STATUS_CANCELLED: 'cancelled',
  STATUS_SUSPENDED: 'suspended',
}

function toNumScore(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function scoreRule(statusName, home, away) {
  const status = STATUS_MAP[statusName] || 'scheduled'
  const finished = status === 'final'
  const isLive = status === 'live'
  const hs = finished || isLive ? toNumScore(home) : null
  const as_ = finished || isLive ? toNumScore(away) : null
  return { status, finished, homeScore: hs, awayScore: as_ }
}

describe('ESPN normalize — scores solo si FINAL o LIVE', () => {
  it('scheduled con score "0"/"0" (bug 0-0) → scores NULL', () => {
    // ESPN 2026 week 2 real: STATUS_SCHEDULED con competitors[].score = '0'
    const r = scoreRule('STATUS_SCHEDULED', '0', '0')
    assert.strictEqual(r.status, 'scheduled')
    assert.strictEqual(r.finished, false)
    assert.strictEqual(r.homeScore, null)
    assert.strictEqual(r.awayScore, null)
  })

  it('pre_game con score "0"/"0" → scores NULL', () => {
    const r = scoreRule('STATUS_PRE_GAME', '0', '0')
    assert.strictEqual(r.status, 'scheduled')
    assert.strictEqual(r.homeScore, null)
  })

  it('scheduled con score ""/"" (primer juego sin score) → scores NULL', () => {
    const r = scoreRule('STATUS_SCHEDULED', '', '')
    assert.strictEqual(r.homeScore, null)
    assert.strictEqual(r.awayScore, null)
  })

  it('postponed → scores NULL (no conserva 0-0 stale)', () => {
    const r = scoreRule('STATUS_POSTPONED', '0', '0')
    assert.strictEqual(r.status, 'postponed')
    assert.strictEqual(r.homeScore, null)
  })

  it('final → scores reales + finished', () => {
    const r = scoreRule('STATUS_FINAL', 37, 59)
    assert.strictEqual(r.status, 'final')
    assert.strictEqual(r.finished, true)
    assert.strictEqual(r.homeScore, 37)
    assert.strictEqual(r.awayScore, 59)
  })

  it('final con score "0" real (blanqueo real) → se conserva', () => {
    const r = scoreRule('STATUS_FINAL', '0', '17')
    assert.strictEqual(r.finished, true)
    assert.strictEqual(r.homeScore, 0)
    assert.strictEqual(r.awayScore, 17)
  })

  it('live → scores parciales conservados', () => {
    const r = scoreRule('STATUS_IN_PROGRESS', 14, 10)
    assert.strictEqual(r.status, 'live')
    assert.strictEqual(r.finished, false)
    assert.strictEqual(r.homeScore, 14)
    assert.strictEqual(r.awayScore, 10)
  })

  it('live 0-0 real durante el partido → se conserva (no confundir con pre-kickoff)', () => {
    const r = scoreRule('STATUS_IN_PROGRESS', 0, 0)
    assert.strictEqual(r.homeScore, 0)
    assert.strictEqual(r.awayScore, 0)
  })

  it('toNumScore normaliza "0", 0, string vacío y null', () => {
    assert.strictEqual(toNumScore('0'), 0)
    assert.strictEqual(toNumScore(0), 0)
    assert.strictEqual(toNumScore(''), null)
    assert.strictEqual(toNumScore(null), null)
    assert.strictEqual(toNumScore(undefined), null)
  })
})