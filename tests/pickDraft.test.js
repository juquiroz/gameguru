import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { draftKey, readDraft, writeDraft, dropDraft } from '../src/hooks/pickDraft.js'

function memLocalStorage() {
  const store = new Map()
  return {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _store: store,
  }
}

describe('pickDraft — persistencia de picks sin enviar', () => {
  let ls
  beforeEach(() => {
    ls = memLocalStorage()
    globalThis.localStorage = ls
  })

  it('draftKey incluye usuario, liga y semana (aisla draft por contexto)', () => {
    assert.strictEqual(draftKey('u1', 'L1', 3), 'gameguru_picks_draft_u1_L1_3')
    assert.notStrictEqual(draftKey('u2', 'L1', 3), draftKey('u1', 'L1', 3))
    assert.notStrictEqual(draftKey('u1', 'L1', 3), draftKey('u1', 'L2', 3))
    assert.notStrictEqual(draftKey('u1', 'L1', 4), draftKey('u1', 'L1', 3))
  })

  it('writeDraft/readDraft redondea el objeto de picks', () => {
    const key = draftKey('u1', 'L1', 1)
    writeDraft(key, { g1: 'ARI', g2: 'NE' })
    assert.deepStrictEqual(readDraft(key), { g1: 'ARI', g2: 'NE' })
  })

  it('el draft vacío no contamina el estado (null en vez de {})', () => {
    const key = draftKey('u1', 'L1', 1)
    writeDraft(key, '')
    assert.strictEqual(readDraft(key), null)
  })

  it('dropDraft elimina el draft tras enviar', () => {
    const key = draftKey('u1', 'L1', 1)
    writeDraft(key, { g1: 'ARI' })
    dropDraft(key)
    assert.strictEqual(readDraft(key), null)
  })

  it('datos corruptos en storage se ignoran (no rompen el arranque)', () => {
    const key = draftKey('u1', 'L1', 1)
    ls.setItem(key, '{melo:"')
    assert.strictEqual(readDraft(key), null)
  })
})