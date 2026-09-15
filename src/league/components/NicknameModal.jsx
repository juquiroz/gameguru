import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/context'
import { leaguesApi, membersApi } from '../../supabase'
import { isNicknameUnique } from '../../domains/league'

// BUILD-AUTH-NICK-001 — Captura única del nickname POR LIGA.
// Se muestra al entrar a una liga cuando el usuario todavía no tiene nickname
// en ella (nuevos miembros y ligas legacy con nickname NULL). El nickname es
// permanente e inmutable; el trigger de BD impide cualquier cambio posterior.
// BUILD-016.1 — nunca es un callejón sin salida: hay botón de cerrar/diferir
// (el skip persiste en sessionStorage por liga, así no reaparece en cada
// navegación dentro de la misma sesión).
const skipKey = (leagueId) => `nickSkip:${leagueId}`

export default function NicknameModal({ league, userId, onSaved }) {
  const { t } = useLanguage()
  const [show, setShow] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const close = useCallback(() => setShow(false), [])

  useEffect(() => {
    if (!league?.id || !userId) return
    let active = true
    if (sessionStorage.getItem(skipKey(league.id))) return
    membersApi.getMyMembership(league.id, userId).then(({ data }) => {
      if (!active) return
      const hasNickname = !!(data && data.nickname && String(data.nickname).trim())
      const finished = !!(league.finished || league.revealed)
      setShow(!hasNickname && !finished)
    })
    return () => { active = false }
  }, [league?.id, league?.finished, league?.revealed, userId])

  // Esc para salir sin atascarse.
  useEffect(() => {
    if (!show) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, close])

  const handleSkip = () => {
    if (league?.id) sessionStorage.setItem(skipKey(league.id), '1')
    close()
  }

  if (!show) return null

  const handleSave = async () => {
    if (saving) return
    if (!value || !String(value).trim()) return setError(t('nickname.required'))
    setSaving(true)
    setError(null)
    try {
      // Evita el falso positivo: si otro evento (o un doble Enter) ya guardó mi
      // nickname en este mismo momento, el modal se cierra en vez de revalidar
      // contra un snapshot a medias.
      const { data: mine } = await membersApi.getMyMembership(league.id, userId)
      if (mine && mine.nickname && String(mine.nickname).trim()) {
        setShow(false)
        if (onSaved) onSaved({ leagueId: league.id, nickname: mine.nickname })
        return
      }

      const { data: members } = await leaguesApi.getMembers(league.id)
      const check = isNicknameUnique(members || [], value, userId)
      if (!check.unique) {
        setError(t('nickname.taken'))
        return
      }

      const { data: saved, error: saveErr } = await membersApi.setNickname(league.id, userId, value.trim())
      // La BD es la fuente de verdad: un conflicto real de unicidad (23505)
      // llega aquí como "taken" aunque el snapshot del cliente estuviera viejo.
      // Cualquier otro error (ej. trigger de inmutabilidad, P0001) es distinto.
      if (saveErr || !saved || saved.length === 0) {
        console.error('[nickname] no se pudo guardar:', saveErr, saved)
        const dbTaken = saveErr && (saveErr.code === '23505' || /duplicate key|duplicat/.test(`${saveErr.code || ''} ${saveErr.message || ''}`))
        setError(dbTaken ? t('nickname.taken') : `${t('nickname.saveError')} ${saveErr?.message || ''}`)
        return
      }

      setShow(false)
      if (onSaved) onSaved({ leagueId: league.id, nickname: value.trim() })
    } catch (ex) {
      console.error('[nickname] excepción al guardar:', ex)
      setError(`${t('nickname.saveError')} ${ex?.message || ''}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 400, position: 'relative' }} role="dialog" aria-modal="true">
        <button
          onClick={handleSkip}
          aria-label={t('nickname.skip')}
          style={{
            position: 'absolute', top: '.6rem', right: '.75rem',
            background: 'none', border: 'none', color: 'var(--text3)',
            fontSize: '1.2rem', cursor: 'pointer', padding: '4px', lineHeight: 1,
          }}
        >✕</button>
        <div className="sec-title" style={{ textAlign: 'center' }}>{t('nickname.prompt')}</div>
        <p style={{ fontSize: '.85rem', color: 'var(--text2)', textAlign: 'center', margin: '.5rem 0 1rem', lineHeight: 1.5 }}>
          {t('nickname.promptHint')}
        </p>
        <div className="field">
          <input
            type="text"
            placeholder={t('nickname.prompt')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            maxLength={24}
            autoFocus
          />
        </div>
        {error && <div className="msg error">{error}</div>}
        <button className="btn-primary" style={{ width: '100%', marginTop: '.5rem' }} onClick={handleSave} disabled={saving}>
          {saving ? t('auth.loading') : t('nickname.save')}
        </button>
        <button
          className="btn-secondary"
          style={{ width: '100%', marginTop: '.5rem' }}
          onClick={handleSkip}
          disabled={saving}
        >
          {t('nickname.skip')}
        </button>
        <p style={{ fontSize: '.75rem', color: 'var(--text3)', textAlign: 'center', margin: '.5rem 0 0' }}>
          {t('nickname.skipHint')}
        </p>
      </div>
    </div>
  )
}
