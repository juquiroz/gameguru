import { describe, it } from 'node:test'
import assert from 'node:assert'
import { resolveGame, stableIndexOfWeek } from '../src/domains/training-camp/autoResults.js'

describe('Training Camp v2 — auto results (BUILD-TC-V2-AUTO)', () => {
  it('mismos inputs → mismo resultado (estabilidad entre llamadas)', () => {
    const game = { home_abbr: 'GB', away_abbr: 'CHI' }
    const a = resolveGame(game, { seed: 123, index: 2 })
    const b = resolveGame(game, { seed: 123, index: 2 })
    assert.deepStrictEqual(a, b)
  })

  it('seed distinto → resultados potencialmente distintos; index distinto también', () => {
    const game = { home_abbr: 'GB', away_abbr: 'CHI' }
    const base = resolveGame(game, { seed: 5, index: 0 })
    const otherSeed = resolveGame(game, { seed: 6, index: 0 })
    const otherIndex = resolveGame(game, { seed: 5, index: 1 })
    assert.notDeepStrictEqual(base, otherSeed)
    assert.notDeepStrictEqual(base, otherIndex)
  })

  it('el índice estable de una semana conserva el orden de los tips', () => {
    const games = [
      { id: 'g3', game_time: '2026-09-10T20:10:00.000Z' },
      { id: 'g1', game_time: '2026-09-10T20:00:00.000Z' },
      { id: 'g8', game_time: '2026-09-10T20:05:00.000Z' },
    ]
    const idx = stableIndexOfWeek(games)
    assert.strictEqual(idx({ id: 'g3' }), 2)
    assert.strictEqual(idx({ id: 'g1' }), 0)
    assert.strictEqual(idx({ id: 'g8' }), 1)
  })

  it('resultado siempre coherente con los scores (empate → result null)', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (let i = 0; i < 10; i++) {
        const r = resolveGame({ home_abbr: 'DAL', away_abbr: 'PHI' }, { seed, index: i })
        if (r.home_score === r.away_score) assert.strictEqual(r.result, null)
        else assert.strictEqual(r.result, r.home_score > r.away_score ? 'DAL' : 'PHI')
      }
    }
  })
})