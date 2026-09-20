import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getCurrentWeek, isGameLocked } from '../src/utils/dates.js'

const H = 3600 * 1000
const M = 60 * 1000
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

describe('dates — isGameLocked (cierre POR PARTIDO, no por semana)', () => {
  it('juego sin finalizar y con kickoff a >5 min en el futuro → abierto', () => {
    assert.strictEqual(isGameLocked({ game_time: iso(now + 10 * M) }), false)
  })

  it('juego cuyo kickoff ya pasó la ventana de 5 min → bloqueado', () => {
    assert.strictEqual(isGameLocked({ game_time: iso(now - 1 * M) }), true)
  })

  it('juego que arranca en <5 min (dentro de la ventana) → bloqueado', () => {
    assert.strictEqual(isGameLocked({ game_time: iso(now + 3 * M) }), true)
  })

  it('juego finalizado → bloqueado aunque su fecha sea futura', () => {
    assert.strictEqual(isGameLocked({ game_time: iso(now + 24 * H), finished: true }), true)
  })

  it('soporta el campo time (formato NFL_WEEKS estático)', () => {
    assert.strictEqual(isGameLocked({ time: iso(now + 10 * M) }), false)
  })

  it('sin fecha → abierto (no se puede afirmar bloqueo)', () => {
    assert.strictEqual(isGameLocked({}), false)
  })

  it('sin juego → bloqueado', () => {
    assert.strictEqual(isGameLocked(null), true)
    assert.strictEqual(isGameLocked(undefined), true)
  })
})