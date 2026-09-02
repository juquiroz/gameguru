import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  IDENTITY_FALLBACK,
  isEmailLike,
  isNicknameUnique,
  resolveDisplayName,
  buildLeagueIdentityMap,
  revealLifecycle,
} from '../src/domains/league/models/identity.js'

describe('Identity — nickname POR LIGA + reveal', () => {
  it('sin reveal usa el nickname de la liga (primary)', () => {
    assert.strictEqual(
      resolveDisplayName({ nickname: 'ElCrack99', realName: 'José Quiroz', username: 'jquiroz' }),
      'ElCrack99'
    )
  })

  it('sin nickname en una liga usa el fallback (nunca cae al username global)', () => {
    assert.strictEqual(
      resolveDisplayName({ nickname: null, username: 'bruce', revealed: false }),
      IDENTITY_FALLBACK
    )
    // el username global puede ser el prefijo de un email: nunca debe usarse
    // como identidad pública en pantallas de liga.
    assert.strictEqual(
      resolveDisplayName({ nickname: null, username: 'jquiroz', revealed: false }),
      IDENTITY_FALLBACK
    )
  })

  it('sin nada usa el fallback', () => {
    assert.strictEqual(resolveDisplayName({}), IDENTITY_FALLBACK)
  })

  it('con reveal muestra real_name (nickname)', () => {
    assert.strictEqual(
      resolveDisplayName({ nickname: 'ElCrack99', realName: 'José Quiroz', revealed: true }),
      'José Quiroz (ElCrack99)'
    )
  })

  it('con reveal y sin nickname muestra real_name', () => {
    assert.strictEqual(
      resolveDisplayName({ realName: 'Hulk Hogan', revealed: true }),
      'Hulk Hogan'
    )
  })

  it('NUNCA muestra un email como identidad: reveal con real_name tipo email usa solo el nick', () => {
    assert.strictEqual(
      resolveDisplayName({ nickname: 'ElCrack99', realName: 'juan@example.com', revealed: true }),
      'ElCrack99'
    )
    assert.strictEqual(
      resolveDisplayName({ nickname: null, realName: 'juan@example.com', revealed: true }),
      IDENTITY_FALLBACK
    )
    assert.strictEqual(
      resolveDisplayName({ nickname: null, realName: 'juan@example.com', revealed: false }),
      IDENTITY_FALLBACK
    )
  })

  it('isEmailLike detecta correos válidos y no confunde nombres', () => {
    assert.strictEqual(isEmailLike('juan@example.com'), true)
    assert.strictEqual(isEmailLike('a.b_c-d@sub.example.co'), true)
    assert.strictEqual(isEmailLike('   juan@example.com '), true)
    assert.strictEqual(isEmailLike('José Quiroz'), false)
    assert.strictEqual(isEmailLike('jquiroz'), false)
    assert.strictEqual(isEmailLike(''), false)
    assert.strictEqual(isEmailLike(null), false)
  })

  it('buildLeagueIdentityMap arma display por userId', () => {
    const members = [
      { user_id: 'u1', nickname: 'hulk' },
      { user_id: 'u2', nickname: null },
    ]
    const profiles = {
      u1: { username: 'hulkuser', real_name: 'Hulk Hogan' },
      u2: { username: 'taskmaster', real_name: null },
    }
    const notRevealed = buildLeagueIdentityMap(members, profiles, { revealed: false })
    assert.strictEqual(notRevealed.u1.display, 'hulk')
    assert.strictEqual(notRevealed.u2.display, IDENTITY_FALLBACK)
    assert.strictEqual(notRevealed.u1.realName, 'Hulk Hogan')

    const revealed = buildLeagueIdentityMap(members, profiles, { revealed: true })
    assert.strictEqual(revealed.u1.display, 'Hulk Hogan (hulk)')
    assert.strictEqual(revealed.u2.display, IDENTITY_FALLBACK)
  })

  it('buildLeagueIdentityMap niega el real_name tipo email incluso revelado', () => {
    const members = [{ user_id: 'u1', nickname: 'hulk' }]
    const profiles = { u1: { username: 'jquiroz', real_name: 'jquiroz@example.com' } }
    const revealed = buildLeagueIdentityMap(members, profiles, { revealed: true })
    assert.strictEqual(revealed.u1.display, 'hulk')
  })

  it('isNicknameUnique: vacío → required; repetido en la liga → taken; libre → ok', () => {
    const members = [
      { user_id: 'u1', nickname: 'hulk' },
      { user_id: 'u2', nickname: 'macho' },
    ]
    assert.strictEqual(isNicknameUnique(members, '').error, 'nickname_required')
    assert.strictEqual(isNicknameUnique(members, 'HULK', 'u3').error, 'nickname_taken')
    assert.strictEqual(isNicknameUnique(members, 'macho', 'u2').unique, true) // mismo usuario lo tiene
    assert.strictEqual(isNicknameUnique(members, 'nuevo', 'u3').unique, true)
  })

  it('revela solo cuando el usuario reutiliza el mismo nick en otra liga (no choca global)', () => {
    const ligaA = [{ user_id: 'u1', nickname: 'hulkhogan' }]
    const ligaB = [{ user_id: 'u1', nickname: 'hulkhogan' }, { user_id: 'u9', nickname: 'otro' }]
    assert.strictEqual(isNicknameUnique(ligaA, 'hulkhogan', 'u1').unique, true)
    assert.strictEqual(isNicknameUnique(ligaB, 'hulkhogan', 'u1').unique, true)
    assert.strictEqual(isNicknameUnique(ligaB, 'hulkhogan', 'u2').unique, false)
  })

  it('revealLifecycle: no se puede revelar sin finalizar; irreversible', () => {
    assert.strictEqual(revealLifecycle({ finished: false }).canReveal, false)
    assert.strictEqual(revealLifecycle({ finished: true }).canReveal, true)
    assert.strictEqual(revealLifecycle({ finished: true }).canFinish, false)
    assert.strictEqual(revealLifecycle({ finished: true, revealed: true }).canReveal, false)
    assert.strictEqual(revealLifecycle({ finished: true, revealed: true }).isRevealed, true)
  })
})
