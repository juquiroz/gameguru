import { useState } from 'react'
import { useLanguage } from '../i18n/context'
import { translateAuthError } from '../data/nflData'
import styles from './Auth.module.css'

// FLOW-RECOVER: formulario de NUEVA contraseña. Solo se renderiza cuando la
// sesión viene del link de recuperación de Supabase (evento PASSWORD_RECOVERY).
export default function RecoverPassword({ onUpdate, onFinish }) {
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (done) return
    if (!password) return setMsg({ type: 'error', text: t('auth.completeFields') })
    if (password.length < 6) return setMsg({ type: 'error', text: t('auth.passwordTooShort') })
    if (password !== confirm) return setMsg({ type: 'error', text: t('auth.recoverMismatch') })

    setLoading(true)
    setMsg(null)
    const { error } = await onUpdate(password)
    setLoading(false)
    if (error) {
      setMsg({ type: 'error', text: translateAuthError(error.message) })
      return
    }
    setDone(true)
    setMsg({ type: 'success', text: t('auth.recoverSuccess') })
    setTimeout(() => onFinish(), 1800)
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.brand}>GameGuru</div>
          <div className={styles.sub}>Liga de Pronósticos</div>
        </div>

        <div className={styles.recoverTitle}>{t('auth.recoverTitle')}</div>
        <p className={styles.hint} style={{ marginBottom: '1.25rem' }}>{t('auth.recoverHint')}</p>

        <div className="field">
          <label>{t('auth.newPassword')}</label>
          <input
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
            autoComplete="new-password"
          />
        </div>

        <div className="field">
          <label>{t('auth.confirmPassword')}</label>
          <input
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="new-password"
          />
        </div>

        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? t('auth.loading') : t('auth.recoverSubmit')}
        </button>

        {msg && (
          <div className={`msg ${msg.type}`} style={{ marginTop: '1rem' }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}