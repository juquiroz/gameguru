import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getCurrentWeek } from '../src/utils/dates.js'

const H = 3600 * 1000
const iso = (ms) => new Date(ms).toISOString()
const now = Date.now()
// Juego único = define el "último partido" de la semana (borde de cierre).
const single = (week, offsetH, finished = false) => ({ week, game_time: iso(now + offsetH * H), finished })
// Dos juegos = ventana [primer juego, último juego] de la semana.
const windowWeek = (week, firstOffsetH, lastOffsetH, finished = false) => [
  { week, game_time: iso(now + firstOffsetH * H), finished },
  { week, game_time: iso(now + lastOffsetH * H), finished },
]

describe('dates — getCurrentWeek (default por fechas)', () => {
  it('antes de que arranque la temporada → semana 1', () => {
    const games = [single(1, 72), single(2, 240)]
    assert.strictEqual(getCurrentWeek(games), 1)
  })

  it('durante una semana (entre primer y último juego) → esa semana', () => {
    const games = [...windowWeek(1, -4, 4), single(2, 240)]
    assert.strictEqual(getCurrentWeek(games), 1)
  })

  it('cerrada la semana 1 → semana 2 de default', () => {
    const games = [single(1, -6), single(2, 48)]
    assert.strictEqual(getCurrentWeek(games), 2)
  })

  it('una semana marcada finalizada no cuenta aunque su fecha sea futura', () => {
    const games = [single(1, 72, true), single(2, 240)]
    assert.strictEqual(getCurrentWeek(games), 2)
  })

  it('toda la temporada finalizada → última semana', () => {
    const games = [single(1, -24, true), single(2, -2, true)]
    assert.strictEqual(getCurrentWeek(games), 2)
  })

  it('sin juegos → null', () => {
    assert.strictEqual(getCurrentWeek(null), null)
    assert.strictEqual(getCurrentWeek([]), null)
  })
})