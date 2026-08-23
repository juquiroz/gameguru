import { describe, it } from 'node:test'
import assert from 'node:assert'
import { TEAM_MAPPING, STATUS_MAPPING, SEASON_TYPE_MAPPING } from '../src/domains/sports/providers/apiSportsNfl.js'

describe('API-Sports NFL Adapter', () => {
  describe('TEAM_MAPPING', () => {
    it('should map all 32 NFL teams', () => {
      assert.strictEqual(Object.keys(TEAM_MAPPING).length, 33)
    })

    it('should map Kansas City Chiefs to KC', () => {
      assert.strictEqual(TEAM_MAPPING['Kansas City Chiefs'], 'KC')
    })

    it('should map Dallas Cowboys to DAL', () => {
      assert.strictEqual(TEAM_MAPPING['Dallas Cowboys'], 'DAL')
    })

    it('should map Green Bay Packers to GB', () => {
      assert.strictEqual(TEAM_MAPPING['Green Bay Packers'], 'GB')
    })

    it('should map Washington Commanders to WAS', () => {
      assert.strictEqual(TEAM_MAPPING['Washington Commanders'], 'WAS')
    })
  })

  describe('STATUS_MAPPING', () => {
    it('should map NS to scheduled', () => {
      assert.strictEqual(STATUS_MAPPING['NS'], 'scheduled')
    })

    it('should map 1H to live', () => {
      assert.strictEqual(STATUS_MAPPING['1H'], 'live')
    })

    it('should map FT to final', () => {
      assert.strictEqual(STATUS_MAPPING['FT'], 'final')
    })

    it('should map P to postponed', () => {
      assert.strictEqual(STATUS_MAPPING['P'], 'postponed')
    })

    it('should map CANC to cancelled', () => {
      assert.strictEqual(STATUS_MAPPING['CANC'], 'cancelled')
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
})
