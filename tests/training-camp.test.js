import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parseHash, buildHash } from '../src/router/hashRouter.js'
import {
  PICK_DEADLINE_MINUTES,
  MIN_GAMES_PER_WEEK,
  MAX_GAMES_PER_WEEK,
  derivePhase,
  weekDeadline,
  isWeekPicksLocked,
  isWeekComplete,
  validateWeeksOrder,
  firstGameTimeOf,
  lastGameTime,
  buildSnapshotPayload,
  snapshotHash,
  reducer,
  ACTION,
} from '../src/domains/training-camp/model.js'

describe('Training Camp v2 — dominio (modelo simple/manual)', () => {
  it('deadline de picks = 5 min antes del primer juego', () => {
    const games = [
      { game_time: '2026-09-10T20:00:00.000Z' },
      { game_time: '2026-09-10T23:30:00.000Z' },
    ]
    const d = weekDeadline(games)
    assert.ok(d)
    assert.strictEqual(d.toISOString(), '2026-09-10T19:55:00.000Z')
    assert.strictEqual(PICK_DEADLINE_MINUTES, 5)
  })

  it('detecta primer y último juego de la semana (deadline y cierre)', () => {
    const games = [
      { game_time: '2026-09-10T23:30:00.000Z' },
      { game_time: '2026-09-10T20:00:00.000Z' },
    ]
    assert.strictEqual(firstGameTimeOf(games), '2026-09-10T20:00:00.000Z')
    assert.strictEqual(lastGameTime(games), '2026-09-10T23:30:00.000Z')
  })

  it('deadline = 5 min antes del primer juego, no del último', () => {
    const games = [
      { game_time: '2026-09-10T20:00:00.000Z' },
      { game_time: '2026-09-10T23:30:00.000Z' },
    ]
    const d = weekDeadline(games)
    assert.strictEqual(d.toISOString(), '2026-09-10T19:55:00.000Z')
  })

  it('límites de juegos por semana (1..5)', () => {
    assert.strictEqual(MIN_GAMES_PER_WEEK, 1)
    assert.strictEqual(MAX_GAMES_PER_WEEK, 5)
  })

  it('sin juegos no hay deadline', () => {
    assert.strictEqual(weekDeadline([]), null)
    assert.strictEqual(weekDeadline(), null)
  })

  it('los picks se cierran cuando pasa el deadline', () => {
    const games = [{ game_time: '2026-01-10T20:00:00.000Z' }]
    // now antes del deadline
    assert.strictEqual(isWeekPicksLocked({ games, now: new Date('2026-01-10T19:00:00.000Z') }), false)
    // now después del primer juego
    assert.strictEqual(isWeekPicksLocked({ games, now: new Date('2026-01-10T20:30:00.000Z') }), true)
  })

  it('la semana está completa solo si todos los juegos tienen resultado', () => {
    assert.strictEqual(isWeekComplete([]), false)
    assert.strictEqual(isWeekComplete([{ finished: false }]), false)
    assert.strictEqual(isWeekComplete([{ finished: true }, { finished: true }]), true)
  })

  it('valida el orden: semana N+1 no puede empezar antes que la N', () => {
    const ok = validateWeeksOrder([
      { week: 1, games: [{ game_time: '2026-01-01T00:00:00Z' }, { game_time: '2026-01-05T00:00:00Z' }] },
      { week: 2, games: [{ game_time: '2026-01-06T00:00:00Z' }] },
    ])
    assert.strictEqual(ok.valid, true)

    const bad = validateWeeksOrder([
      { week: 1, games: [{ game_time: '2026-01-10T00:00:00Z' }] },
      { week: 2, games: [{ game_time: '2026-01-05T00:00:00Z' }] },
    ])
    assert.strictEqual(bad.valid, false)
    assert.strictEqual(bad.errors[0].week, 2)
  })

  it('derivePhase recorre setup → inviting → active → finished', () => {
    assert.strictEqual(derivePhase({ scheduleComplete: false }), 'setup')
    assert.strictEqual(derivePhase({ scheduleComplete: true, started: false }), 'inviting')
    assert.strictEqual(derivePhase({ scheduleComplete: true, started: true, currentWeek: 1 }), 'active')
    assert.strictEqual(derivePhase({ scheduleComplete: true, started: true, finished: true }), 'finished')
  })

  it('reducer maneja INIT / START / semanas', () => {
    const init = reducer(undefined, { type: ACTION.INIT, totalWeeks: 6, currentWeek: 1, scheduleComplete: true, started: true })
    assert.strictEqual(init.totalWeeks, 6)
    assert.strictEqual(init.scheduleComplete, true)
    const started = reducer(init, { type: ACTION.START })
    assert.strictEqual(started.started, true)
    const next = reducer(started, { type: ACTION.SET_CURRENT_WEEK, value: 3 })
    assert.strictEqual(next.currentWeek, 3)
  })

  it('snapshot: payload no expone email y usa nickname de la liga', () => {
    const games = [
      { game_id: 'g1', home_abbr: 'KC', away_abbr: 'BUF', game_time: '2026-01-01T00:00:00Z' },
      { game_id: 'g2', home_abbr: 'GB', away_abbr: 'CHI', game_time: '2026-01-01T00:00:00Z' },
    ]
    const picks = [
      { user_id: 'u1', game_id: 'g1', pick: 'KC' },
      { user_id: 'u1', game_id: 'g2', pick: 'CHI' },
      { user_id: 'u2', game_id: 'g1', pick: 'BUF' },
    ]
    const membersByUser = {
      u1: { nickname: 'Crack99' },
      u2: { nickname: 'Admin' },
    }
    const payload = buildSnapshotPayload({ games, picks, membersByUser })
    assert.strictEqual(payload.games.length, 2)
    const p1 = payload.players.find(p => p.player === 'Crack99')
    assert.ok(p1)
    assert.strictEqual(p1.picks.g1, 'KC')
    assert.strictEqual(p1.picks.g2, 'CHI')
    const json = JSON.stringify(payload)
    assert.ok(!/@/.test(json), 'no debe contener ningún email')
  })

  it('snapshotHash es determinista y estable', async () => {
    const a = await snapshotHash({ x: 1 })
    const b = await snapshotHash({ x: 1 })
    assert.strictEqual(a, b)
    const c = await snapshotHash({ x: 2 })
    assert.notStrictEqual(a, c)
  })

  it('ruta pública de auditoría hace round-trip (hashRouter)', () => {
    const route = parseHash('#/training/audit/abc123')
    assert.strictEqual(route.type, 'audit')
    assert.strictEqual(route.hash, 'abc123')
    assert.strictEqual(buildHash(route), '#/training/audit/abc123')
  })
})
