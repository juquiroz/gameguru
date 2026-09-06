import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseHash, buildHash } from '../src/router/hashRouter.js'
import {
  resolveForView,
  resolveNavigationTarget,
  isMemberOf,
  LEGACY_VIEW_MAP,
} from '../src/router/routes.js'

const ID_A = '32bb375f-bdd7-47b1-976a-ee57d7ba0612'
const ID_B = '6812c5fe-b9fa-45eb-8793-dbf633f1c875'

const leagueA = { id: ID_A, name: 'm4', role: 'admin' }
const leagueB = { id: ID_B, name: 'liga-b', role: 'member' }

describe('hashRouter — round-trip parse/build', () => {
  it('legacy #picks → legacy', () => {
    const r = parseHash('#picks')
    assert.deepEqual(r, { type: 'legacy', page: 'picks' })
  })

  it('liga con view → #/league/:id/:view', () => {
    const r = parseHash(`#/league/${ID_A}/standings`)
    assert.deepEqual(r, { type: 'league', leagueId: ID_A, page: 'standings' })
    assert.strictEqual(buildHash(r), `#/league/${ID_A}/standings`)
  })

  it('liga sin view → #/league/:id', () => {
    const r = parseHash(`#/league/${ID_A}`)
    assert.deepEqual(r, { type: 'league', leagueId: ID_A, page: 'league' })
    assert.strictEqual(buildHash(r), `#/league/${ID_A}`)
  })

  it('dashboard vacío/malformado → dashboard', () => {
    assert.deepEqual(parseHash(''), { type: 'dashboard' })
    assert.deepEqual(parseHash('#garbage'), { type: 'dashboard' })
    assert.deepEqual(parseHash('#'), { type: 'dashboard' })
  })
})

describe('resolveForView — contexto → ruta de liga', () => {
  it('legacy picks con 1 liga → picks de esa liga', () => {
    const res = resolveForView({ route: { type: 'legacy', page: 'picks' }, myLeagues: [leagueA] })
    assert.deepEqual(res, { type: 'league', leagueId: ID_A, page: 'picks' })
  })

  it('legacy board con 1 liga → standings (LEGACY_VIEW_MAP)', () => {
    const res = resolveForView({ route: { type: 'legacy', page: 'board' }, myLeagues: [leagueA] })
    assert.strictEqual(res.page, LEGACY_VIEW_MAP.board)
    assert.deepEqual(res, { type: 'league', leagueId: ID_A, page: 'standings' })
  })

  it('legacy league con 1 liga → league', () => {
    const res = resolveForView({ route: { type: 'legacy', page: 'league' }, myLeagues: [leagueA] })
    assert.deepEqual(res, { type: 'league', leagueId: ID_A, page: 'league' })
  })

  it('0 ligas → dashboard (las páginas de liga no resuelven)', () => {
    const res = resolveForView({ route: { type: 'legacy', page: 'picks' }, myLeagues: [] })
    assert.deepEqual(res, { type: 'dashboard' })
  })

  it('2+ ligas sin context → primera liga (nunca el hub)', () => {
    const res = resolveForView({ route: { type: 'legacy', page: 'league' }, myLeagues: [leagueA, leagueB] })
    assert.deepEqual(res, { type: 'league', leagueId: ID_A, page: 'league' })
  })

  it('2+ ligas con activeLeagueId miembro → esa liga', () => {
    const res = resolveForView({
      route: { type: 'legacy', page: 'picks' },
      myLeagues: [leagueA, leagueB],
      activeLeagueId: ID_B,
    })
    assert.deepEqual(res, { type: 'league', leagueId: ID_B, page: 'picks' })
  })

  it('activeLeagueId no-miembro → primera liga', () => {
    const res = resolveForView({
      route: { type: 'legacy', page: 'picks' },
      myLeagues: [leagueA, leagueB],
      activeLeagueId: 'stale-not-member',
    })
    assert.deepEqual(res, { type: 'league', leagueId: ID_A, page: 'picks' })
  })

  it('ruta de liga con id → tal cual (la URL manda)', () => {
    const route = { type: 'league', leagueId: ID_B, page: 'standings' }
    const res = resolveForView({ route, myLeagues: [leagueA] })
    assert.strictEqual(res, route)
  })

  it('ruta de liga sin id (#/league) con 1 liga → esa liga', () => {
    const res = resolveForView({ route: { type: 'league', leagueId: null, page: 'dashboard' }, myLeagues: [leagueA] })
    assert.deepEqual(res, { type: 'league', leagueId: ID_A, page: 'league' })
  })
})

describe('resolveNavigationTarget — objetivo del menú en el click', () => {
  it('currentLeague miembro tiene prioridad', () => {
    const target = resolveNavigationTarget({ currentLeague: leagueB, myLeagues: [leagueA, leagueB] })
    assert.strictEqual(target.id, ID_B)
  })

  it('activeLeagueId miembro sin currentLeague → esa liga', () => {
    const target = resolveNavigationTarget({ myLeagues: [leagueA, leagueB], activeLeagueId: ID_A })
    assert.strictEqual(target.id, ID_A)
  })

  it('1 sola liga sin contexto → esa liga', () => {
    const target = resolveNavigationTarget({ myLeagues: [leagueA] })
    assert.strictEqual(target.id, ID_A)
  })

  it('2+ ligas sin contexto → primera liga', () => {
    const target = resolveNavigationTarget({ myLeagues: [leagueA, leagueB] })
    assert.strictEqual(target.id, ID_A)
  })

  it('currentLeague/activeLeagueId no miembro → fallback primera liga', () => {
    const target = resolveNavigationTarget({
      currentLeague: { id: 'outside' },
      activeLeagueId: 'stale',
      myLeagues: [leagueA, leagueB],
    })
    assert.strictEqual(target.id, ID_A)
  })

  it('sin ligas → null (la UI muestra needLeague, nunca el hub)', () => {
    assert.strictEqual(resolveNavigationTarget({ myLeagues: [] }), null)
  })
})

describe('isMemberOf — membresía real', () => {
  it('miembro exacto', () => {
    assert.ok(isMemberOf([leagueA, leagueB], ID_A))
  })
  it('no miembro', () => {
    assert.ok(!isMemberOf([leagueA], ID_B))
  })
  it('lista vacía', () => {
    assert.ok(!isMemberOf([], ID_A))
  })
})