import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  resolveConflict,
  shouldProceed,
  isManualOverride,
  hasExistingMapping,
  RESOLUTION,
} from '../src/domains/sports/reconciliation/conflictResolution.js'

function makeMasterGame(overrides = {}) {
  return {
    id: 'mg-1',
    provider: null,
    external_game_id: null,
    mapping_status: 'unmapped',
    mapping_confidence: null,
    ...overrides,
  }
}

// ── MANUAL OVERRIDE ────────────────────────────────────────────────────────────

describe('Manual Override Detection', () => {
  it('detects manual_override mapping_status', () => {
    const mg = makeMasterGame({ mapping_status: 'manual_override' })
    assert.strictEqual(isManualOverride(mg), true)
  })

  it('detects manual mapping_confidence', () => {
    const mg = makeMasterGame({ mapping_confidence: 'manual' })
    assert.strictEqual(isManualOverride(mg), true)
  })

  it('returns false for non-manual', () => {
    const mg = makeMasterGame({ mapping_status: 'mapped', mapping_confidence: 'high' })
    assert.strictEqual(isManualOverride(mg), false)
  })
})

// ── EXISTING MAPPING ───────────────────────────────────────────────────────────

describe('Existing Mapping Detection', () => {
  it('detects existing authoritative mapping', () => {
    const mg = makeMasterGame({
      provider: 'api-sports',
      external_game_id: '12345',
      mapping_status: 'mapped',
    })
    assert.strictEqual(hasExistingMapping(mg, 'api-sports'), true)
  })

  it('returns false for different provider', () => {
    const mg = makeMasterGame({
      provider: 'other-provider',
      external_game_id: '12345',
      mapping_status: 'mapped',
    })
    assert.strictEqual(hasExistingMapping(mg, 'api-sports'), false)
  })

  it('returns false for unmapped', () => {
    const mg = makeMasterGame({
      provider: 'api-sports',
      external_game_id: '12345',
      mapping_status: 'unmapped',
    })
    assert.strictEqual(hasExistingMapping(mg, 'api-sports'), false)
  })
})

// ── CONFLICT RESOLUTION ────────────────────────────────────────────────────────

describe('Conflict Resolution', () => {
  it('manual_override has highest precedence', () => {
    const mg = makeMasterGame({
      mapping_status: 'manual_override',
      provider: 'api-sports',
      external_game_id: '12345',
    })

    const result = resolveConflict(mg, {}, 'api-sports')
    assert.strictEqual(result.action, 'skip')
    assert.strictEqual(result.reason, 'manual_override_protected')
  })

  it('existing authoritative mapping is skipped', () => {
    const mg = makeMasterGame({
      provider: 'api-sports',
      external_game_id: '12345',
      mapping_status: 'mapped',
    })

    const result = resolveConflict(mg, {}, 'api-sports')
    assert.strictEqual(result.action, 'skip')
    assert.strictEqual(result.reason, 'existing_authoritative_mapping')
  })

  it('no existing provider allows new claim', () => {
    const mg = makeMasterGame({ provider: null })

    const result = resolveConflict(mg, {}, 'api-sports')
    assert.strictEqual(result.action, 'map')
    assert.strictEqual(result.reason, 'no_existing_provider')
  })

  it('different provider with lower precedence triggers review', () => {
    const mg = makeMasterGame({
      provider: 'api-sports',
      external_game_id: '12345',
      mapping_status: 'mapped',
    })

    const result = resolveConflict(mg, {}, 'unknown-provider', ['api-sports'])
    assert.strictEqual(result.action, 'skip')
  })

  it('different provider with higher precedence triggers remap', () => {
    const mg = makeMasterGame({
      provider: 'other-provider',
      external_game_id: '12345',
      mapping_status: 'mapped',
    })

    const result = resolveConflict(mg, {}, 'api-sports', ['api-sports', 'other-provider'])
    assert.strictEqual(result.action, 'remap')
  })
})

// ── SHOULD PROCEED ─────────────────────────────────────────────────────────────

describe('Should Proceed', () => {
  it('does not proceed for unmatched', () => {
    const matchResult = { status: 'unmatched' }
    const result = shouldProceed(matchResult, 'api-sports')
    assert.strictEqual(result.shouldProceed, false)
  })

  it('does not proceed for ambiguous', () => {
    const matchResult = { status: 'ambiguous' }
    const result = shouldProceed(matchResult, 'api-sports')
    assert.strictEqual(result.shouldProceed, false)
  })

  it('does not proceed for manual override', () => {
    const matchResult = {
      status: 'mapped',
      matchedGame: makeMasterGame({ mapping_status: 'manual_override' }),
    }
    const result = shouldProceed(matchResult, 'api-sports')
    assert.strictEqual(result.shouldProceed, false)
  })

  it('proceeds for valid match without conflicts', () => {
    const matchResult = {
      status: 'mapped',
      matchedGame: makeMasterGame({ provider: null }),
    }
    const result = shouldProceed(matchResult, 'api-sports')
    assert.strictEqual(result.shouldProceed, true)
  })
})
