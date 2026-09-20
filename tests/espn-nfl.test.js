import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  normalizeGame,
  TEAM_MAPPING,
  STATUS_MAPPING,
  SEASON_TYPE_MAPPING,
} from '../src/domains/sports/providers/espn.js'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('ESPN NFL Adapter', () => {
  describe('TEAM_MAPPING', () => {
    it('should map all 32 NFL teams', () => {
      assert.strictEqual(Object.keys(TEAM_MAPPING).length, 32)
    })

    it('should map Detroit Lions to DET', () => {
      assert.strictEqual(TEAM_MAPPING['Detroit Lions'], 'DET')
    })

    it('should map New Orleans Saints to NO', () => {
      assert.strictEqual(TEAM_MAPPING['New Orleans Saints'], 'NO')
    })

    it('should map Washington Commanders to WAS', () => {
      assert.strictEqual(TEAM_MAPPING['Washington Commanders'], 'WAS')
    })
  })

  describe('STATUS_MAPPING', () => {
    it('should map STATUS_SCHEDULED to scheduled', () => {
      assert.strictEqual(STATUS_MAPPING['STATUS_SCHEDULED'], 'scheduled')
    })

    it('should map STATUS_IN_PROGRESS to live', () => {
      assert.strictEqual(STATUS_MAPPING['STATUS_IN_PROGRESS'], 'live')
    })

    it('should map STATUS_FINAL to final', () => {
      assert.strictEqual(STATUS_MAPPING['STATUS_FINAL'], 'final')
    })

    it('should map STATUS_POSTPONED to postponed', () => {
      assert.strictEqual(STATUS_MAPPING['STATUS_POSTPONED'], 'postponed')
    })

    it('should map STATUS_CANCELED to cancelled', () => {
      assert.strictEqual(STATUS_MAPPING['STATUS_CANCELED'], 'cancelled')
    })
  })

  describe('SEASON_TYPE_MAPPING', () => {
    it('should map 1 to preseason', () => {
      assert.strictEqual(SEASON_TYPE_MAPPING[1], 'preseason')
    })

    it('should map 2 to regular', () => {
      assert.strictEqual(SEASON_TYPE_MAPPING[2], 'regular')
    })

    it('should map 3 to postseason', () => {
      assert.strictEqual(SEASON_TYPE_MAPPING[3], 'postseason')
    })
  })

  describe('normalizeGame (fixture real semana 1 2026)', () => {
    let events
    before(() => {
      const fixture = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'espn-w1.json'), 'utf8'))
      events = fixture.events
    })

    it('fixture final: scores, resultado (winner abbr) y finished', () => {
      const event = events.find((e) =>
        e.competitions.some((c) => c.status.type.name === 'STATUS_FINAL')
      )
      const g = normalizeGame(event)
      assert.ok(g)
      assert.strictEqual(g.status, 'final')
      assert.strictEqual(g.finished, true)
      assert.strictEqual(g.result, 'CHI') // Chicago Bears 59 > Carolina Panthers 37
      assert.strictEqual(g.homeScore, 37)
      assert.strictEqual(g.awayScore, 59)
      assert.strictEqual(g.homeTeamAbbr, 'CAR')
      assert.strictEqual(g.awayTeamAbbr, 'CHI')
      assert.strictEqual(g.phase, 'regular')
      assert.strictEqual(g.week, 1)
      assert.strictEqual(typeof g.externalGameId, 'string')
      assert.strictEqual(g.externalCompetitionId, 'nfl-2026')
    })

    it('fixture en vivo: status live, scores parciales, finished false, sin resultado', () => {
      const event = events.find((e) =>
        e.competitions.some((c) => c.status.type.name === 'STATUS_IN_PROGRESS')
      )
      const g = normalizeGame(event)
      assert.ok(g)
      assert.strictEqual(g.status, 'live')
      assert.strictEqual(g.finished, false)
      assert.strictEqual(g.result, null)
      assert.strictEqual(typeof g.homeScore, 'number')
    })

    it('descartar evento sin competitors mapeables', () => {
      const g = normalizeGame({ id: 'x', competitions: [] })
      assert.strictEqual(g, null)
    })

    it('descartar evento con solamente 1 competitor', () => {
      const g = normalizeGame({ id: 'x', competitions: [{ competitors: [{ homeAway: 'home' }] }] })
      assert.strictEqual(g, null)
    })

    it('produccion: todos los eventos de la semana normalizan', () => {
      for (const e of events) {
        const g = normalizeGame(e)
        assert.ok(g, `event ${e.id} debería normalizar`)
      }
    })
  })
})