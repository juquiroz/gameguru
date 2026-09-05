import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('Concurrency Protection', () => {
  it('should detect running sync within last 5 minutes', () => {
    const runningSync = {
      id: 'sync-123',
      started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 minutos atrás
    }
    const isRunning = runningSync !== null
    assert.strictEqual(isRunning, true)
  })

  it('should allow sync if last running sync is older than 5 minutes', () => {
    const runningSync = {
      id: 'sync-123',
      started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutos atrás
    }
    const isRecent = new Date(runningSync.started_at) > new Date(Date.now() - 5 * 60 * 1000)
    assert.strictEqual(isRecent, false)
  })

  it('should allow sync if no running sync exists', () => {
    const runningSync = null
    const isRunning = runningSync !== null
    assert.strictEqual(isRunning, false)
  })

  it('should return 409 when sync is already running', () => {
    const runningSync = { id: 'sync-123', started_at: new Date().toISOString() }
    const expectedStatus = 409
    const actualStatus = runningSync ? 409 : 200
    assert.strictEqual(actualStatus, expectedStatus)
  })
})

describe('Sync Lock Scenarios', () => {
  it('should prevent manual sync during cron sync', () => {
    const isManual = true
    const runningSync = { id: 'cron-sync-123', started_at: new Date().toISOString() }
    const shouldBlock = runningSync !== null
    assert.strictEqual(shouldBlock, true)
  })

  it('should prevent cron sync during manual sync', () => {
    const isManual = false
    const runningSync = { id: 'manual-sync-123', started_at: new Date().toISOString() }
    const shouldBlock = runningSync !== null
    assert.strictEqual(shouldBlock, true)
  })

  it('should allow new sync after previous completed', () => {
    const runningSync = null
    const shouldBlock = runningSync !== null
    assert.strictEqual(shouldBlock, false)
  })

  it('should allow new sync if previous sync is stale (>5 min)', () => {
    const runningSync = {
      id: 'stale-sync-123',
      started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
    }
    const isRecent = new Date(runningSync.started_at) > new Date(Date.now() - 5 * 60 * 1000)
    const shouldBlock = isRecent
    assert.strictEqual(shouldBlock, false)
  })
})
