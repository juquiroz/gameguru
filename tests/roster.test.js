import { describe, it } from 'node:test'
import assert from 'node:assert'
import { canJoinLeague, getRosterStatus, ROSTER_STATUS } from '../src/domains/league/services/leagueService.js'

// BUILD-016 — Roster siempre abierto.
// Regla de producto: las ligas aceptan nuevos participantes con el código de
// invitación en CUALQUIER momento del ciclo (regular, Training Camp, Game
// Week…), aunque ya hayan comenzado. Reemplaza el cierre de BUILD-TC-005.4
// (que bloqueaba el ingreso cuando el evento superaba START). Espejo de
// league_roster_open() en 016.0-roster-always-open.sql.
describe('Roster — siempre abierto', () => {
  it('sin evento (liga recién creada) el roster está abierto', () => {
    assert.strictEqual(canJoinLeague(null), true)
    assert.strictEqual(getRosterStatus(undefined).open, true)
  })

  it('TC v2 con started=true sigue aceptando jugadores', () => {
    const started = { event_type: 'training_camp', state: 'training_camp_v2', started: true }
    assert.strictEqual(canJoinLeague(started), true)
    assert.strictEqual(getRosterStatus(started).status, ROSTER_STATUS.OPEN)
  })

  it('liga regular ya iniciada (game_week / fixture_generation) también acepta', () => {
    assert.strictEqual(canJoinLeague({ event_type: 'game_week', state: 'picks_open' }), true)
    assert.strictEqual(canJoinLeague({ event_type: 'fixture_generation', state: 'waiting' }), true)
  })

  it('el roster siempre reporta OPEN sin importar el estado del evento', () => {
    assert.strictEqual(getRosterStatus({ event_type: 'game_week', state: 'picks_locked' }).open, true)
    assert.strictEqual(getRosterStatus({ event_type: 'training_camp', state: 'training_started' }).open, true)
  })
})