import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  MAX_AUTO_WEEKS,
  AUTO_GAMES_PER_WEEK,
  AUTO_GAME_SPACING_MINUTES,
  AUTO_PICK_DEADLINE_MINUTES,
  leagueSeed,
  buildWeekStarts,
  drawMatchups,
  generateWeekGames,
  buildCalendar,
  gameDeadline,
  isGamePicksLocked,
  isGameDue,
  activeWeekOf,
  canRevealNames,
  stableIndexOfWeek,
  gamesOfWeek,
} from '../src/domains/training-camp/autoSchedule.js'
import { resolveGame } from '../src/domains/training-camp/autoResults.js'

describe('Training Camp v2 — auto schedule (dominio puro)', () => {
  it('las semanas se limitan a 1..3 en el modo automático', () => {
    assert.strictEqual(MAX_AUTO_WEEKS, 3)
    assert.strictEqual(buildWeekStarts({ totalWeeks: 5, firstStart: '2026-09-10T20:00:00.000Z' }).length, 3)
    assert.strictEqual(buildWeekStarts({ totalWeeks: 0, firstStart: '2026-09-10T20:00:00.000Z' }).length, 1)
  })

  it('los inicios de semana se separan 7 días', () => {
    const starts = buildWeekStarts({ totalWeeks: 3, firstStart: '2026-09-10T20:00:00.000Z' })
    assert.strictEqual(starts[0], '2026-09-10T20:00:00.000Z')
    assert.strictEqual(starts[1], '2026-09-17T20:00:00.000Z')
    assert.strictEqual(starts[2], '2026-09-24T20:00:00.000Z')
    assert.strictEqual(AUTO_GAME_SPACING_MINUTES, 5)
  })

  it('genera exactamente 5 juegos por semana con tips +5 min aparte', () => {
    assert.strictEqual(AUTO_GAMES_PER_WEEK, 5)
    const calendar = buildCalendar({
      totalWeeks: 2,
      weekStarts: ['2026-09-10T20:00:00.000Z', '2026-09-17T20:00:00.000Z'],
      seed: 99,
    })
    assert.strictEqual(calendar.length, 10)
    assert.strictEqual(gamesOfWeek(calendar, 1).length, 5)
    assert.strictEqual(gamesOfWeek(calendar, 2).length, 5)
    const g1 = gamesOfWeek(calendar, 1).sort((a, b) => new Date(a.game_time) - new Date(b.game_time))[0]
    const g2 = gamesOfWeek(calendar, 1).sort((a, b) => new Date(a.game_time) - new Date(b.game_time))[1]
    assert.strictEqual(
      new Date(g2.game_time).getTime() - new Date(g1.game_time).getTime(),
      AUTO_GAME_SPACING_MINUTES * 60 * 1000
    )
  })

  it('cada semana usa 10 equipos distintos y nunca repele la misma jornada', () => {
    const matchups = drawMatchups(() => 0)
    assert.strictEqual(matchups.length, AUTO_GAMES_PER_WEEK)
    const teams = matchups.flatMap(m => [m.home_abbr, m.away_abbr])
    assert.strictEqual(new Set(teams).size, 10, 'no hay equipos repetidos en la semana')
    matchups.forEach(m => {
      assert.notStrictEqual(m.home_abbr, m.away_abbr, 'ningún equipo juega contra sí mismo')
    })
  })

  it('el sorteo es determinista por (seed + week) pero cambia con seed/semana', () => {
    const a = generateWeekGames(42, 1)
    const b = generateWeekGames(42, 1)
    assert.deepStrictEqual(a, b)
    const c = generateWeekGames(43, 1)
    const d = generateWeekGames(42, 2)
    assert.notDeepStrictEqual(a, c)
    assert.notDeepStrictEqual(a, d)
  })

  it('leagueSeed es estable, distinto para ids distintos y cabe en int4', () => {
    assert.strictEqual(leagueSeed('abc'), leagueSeed('abc'))
    assert.notStrictEqual(leagueSeed('abc'), leagueSeed('abd'))
    assert.ok(leagueSeed('abc') > 0)
    const MAX_INT4 = 2147483647
    ;['abc', 'league-123', 'e2d5c1a0-9f4b-4b2a-8f1d-abcdef012345', 'zzzz-zzzz-zzzz', '93233879-0959-4bb2-a235-9363ce4e8fca'].forEach(id => {
      const s = leagueSeed(id)
      assert.ok(Number.isInteger(s) && s > 0 && s <= MAX_INT4, `seed ${s} debe caber en int4`)
    })
  })

  it('gameDeadline = tip − 10 min por juego', () => {
    assert.strictEqual(AUTO_PICK_DEADLINE_MINUTES, 10)
    const d = gameDeadline({ game_time: '2026-09-10T20:00:00.000Z' })
    assert.strictEqual(d.toISOString(), '2026-09-10T19:50:00.000Z')
    assert.strictEqual(gameDeadline({}), null)
    assert.strictEqual(gameDeadline(), null)
  })

  it('pick de un juego: cerrado por deadline, por finished o por inactivo', () => {
    const game = { game_time: '2026-09-10T20:00:00.000Z' }
    assert.strictEqual(isGamePicksLocked(game, new Date('2026-09-10T19:30:00.000Z')), false)
    assert.strictEqual(isGamePicksLocked(game, new Date('2026-09-10T19:50:00.000Z')), true)
    assert.strictEqual(isGamePicksLocked(game, new Date('2026-09-10T20:30:00.000Z')), true)
    assert.strictEqual(isGamePicksLocked({ ...game, finished: true }, new Date('2026-09-10T10:00:00.000Z')), true)
    assert.strictEqual(isGamePicksLocked({ ...game, active: false }, new Date('2026-09-10T10:00:00.000Z')), true)
  })

  it('un juego debe resolverse solo cuando pasó su tip-off y no está finished', () => {
    const game = { game_time: '2026-09-10T20:00:00.000Z' }
    assert.strictEqual(isGameDue(game, new Date('2026-09-10T19:59:00.000Z')), false)
    assert.strictEqual(isGameDue(game, new Date('2026-09-10T20:00:00.000Z')), true)
    assert.strictEqual(isGameDue({ ...game, finished: true }, new Date('2026-09-10T21:00:00.000Z')), false)
  })

  it('activeWeekOf: primera semana con juegos sin resolver; la última al completarse', () => {
    const base = '2026-09-10T20:00:00.000Z'
    const mk = (w, fin) => ({ week: w, game_time: base, finished: fin })
    assert.strictEqual(activeWeekOf({ games: [mk(1, false), mk(2, false)], totalWeeks: 3 }), 1)
    assert.strictEqual(activeWeekOf({ games: [mk(1, true), mk(2, false)], totalWeeks: 3 }), 2)
    assert.strictEqual(activeWeekOf({ games: [mk(1, true), mk(2, true)], totalWeeks: 3 }), 2)
    assert.strictEqual(activeWeekOf({ games: [], totalWeeks: 2 }), 2)
  })

  it('canRevealNames: SOLO cuando terminó el último juego de la última semana', () => {
    assert.strictEqual(canRevealNames({ games: [] }), false)
    assert.strictEqual(canRevealNames({ games: [{ finished: true }, { finished: false }] }), false)
    assert.strictEqual(canRevealNames({ games: [{ finished: true }, { finished: true }] }), true)
  })

  it('stableIndexOfWeek ordena por game_time y es estable entre llamadas', () => {
    const games = [
      { id: 'a', game_time: '2026-09-10T20:00:00.000Z' },
      { id: 'b', game_time: '2026-09-10T20:05:00.000Z' },
      { id: 'c', game_time: '2026-09-10T20:10:00.000Z' },
    ]
    const idx = stableIndexOfWeek(games)
    assert.strictEqual(idx(games[0]), 0)
    assert.strictEqual(idx(games[2]), 2)
    assert.strictEqual(idx({ id: 'a' }), 0)
  })

  it('resolveGame delega en el MatchSimulator determinista y marca finished', () => {
    const game = { home_abbr: 'KC', away_abbr: 'BUF' }
    const a = resolveGame(game, { seed: 7, index: 1 })
    const b = resolveGame(game, { seed: 7, index: 1 })
    assert.deepStrictEqual(a, b)
    assert.strictEqual(a.finished, true)
    if (a.home_score !== a.away_score) {
      assert.strictEqual(a.result, a.home_score > a.away_score ? 'KC' : 'BUF')
    } else {
      assert.strictEqual(a.result, null)
    }
  })
})