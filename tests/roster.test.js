import { describe, it } from 'node:test'
import assert from 'node:assert'
import { canJoinLeague, getRosterStatus, ROSTER_STATUS } from '../src/domains/league/services/leagueService.js'

// BUILD-TC-005.4 / TC-V2-AUTO — Regla central del roster.
// El roster de una liga Training Camp v2 (auto o manual) permanece ABIERTO
// mientras el flag `started` sea falso (fase setup/inviting), SIN depender de
// la hora del primer juego. Solo el admin lo cierra al pulsar "Comenzar
// semana 1" (started=true). El bug 2026-09-06: se bloqueaba el ingreso por
// interpretar la sesión como cerrada aunque faltara arrancar.
describe('Roster — Training Camp v2 (auto)', () => {
  const v2 = (started) => ({ event_type: 'training_camp', state: 'training_camp_v2', started })

  it('sin evento (liga recién creada) el roster está abierto', () => {
    assert.strictEqual(canJoinLeague(null), true)
    assert.strictEqual(getRosterStatus(undefined).open, true)
  })

  it('v2 en inviting (started=false) acepta jugadores aunque el primer juego ya exista', () => {
    assert.strictEqual(canJoinLeague(v2(false)), true)
    assert.strictEqual(getRosterStatus(v2(false)).status, ROSTER_STATUS.OPEN)
  })

  it('v2 solo cierra cuando el admin inicia (started=true)', () => {
    assert.strictEqual(canJoinLeague(v2(true)), false)
    assert.strictEqual(getRosterStatus(v2(true)).status, ROSTER_STATUS.CLOSED_STARTED)
  })

  it('una liga de otro tipo (fixture_generation / game_week) siempre cerrada', () => {
    assert.strictEqual(canJoinLeague({ event_type: 'fixture_generation', state: 'waiting' }), false)
    assert.strictEqual(canJoinLeague({ event_type: 'game_week', state: 'picks_open' }), false)
  })

  it('el estado v2 no depende de la hora: aunque el primer juego pasó, con started=false sigue abierto', () => {
    const past = { event_type: 'training_camp', state: 'training_camp_v2', started: false }
    assert.strictEqual(canJoinLeague(past), true)
  })
})
