import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/context'
import { membersApi } from '../../supabase'
import { isNicknameUnique } from '../../domains/league'

// BUILD-AUTH-NICK-001 — Captura única del nickname POR LIGA.
// Se muestra al entrar a una liga cuando el usuario todavía no tiene nickname
// en ella (nuevos miembros y ligas legacy con nickname NULL). El nickname es
// permanente e inmutable; el trigger de BD impide cualquier cambio posterior.
export default function NicknameModal({ league, userId, onSaved }) {
  const { t } = useLanguage()
  const [show, setShow] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!league?.id || !userId) return
    let active = true
    membersApi.getMyMembership(league.id, userId).then(({ data }) => {
      if (!active) return
      const hasNickname = !!(data && data.nickname && String(data.nickname).trim())
      const finished = !!(league.finished || league.revealed)
      setShow(!hasNickname && !finished)
    })
    return () => { active = false }
  }, [league?.id, league?.finished, league?.revealed, userId])

  if (!show) return null

  const handleSave = async () => {
    if (!value || !String(value).trim()) return setError(t('nickname.required'))
    setSaving(true)
    setError(null)
    try {
      const { data: members } = await membersApi.getMembers(league.id)
      const check = isNicknameUnique(members || [], value, userId)
      if (!check.unique) {
        setError(t('nickname.taken'))
        return
      }

      const { error: saveErr } = await membersApi.setNickname(league.id, userId, value.trim())
      if (saveErr) {
        console.error('[nickname] no se pudo guardar:', saveErr)
        setError(t('nickname.taken'))
        return
      }

      setShow(false)
      if (onSaved) onSaved({ leagueId: league.id, nickname: value.trim() })
    } catch (ex) {
      console.error('[nickname] excepción al guardar:', ex)
      setError(t('nickname.taken'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 400 }} role="dialog" aria-modal="true">
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
      </div>
    </div>
  )
}
