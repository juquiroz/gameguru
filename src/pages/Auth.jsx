import { useState } from 'react'
import { useLanguage } from '../i18n/context'
import { translateAuthError } from '../data/nflData'
import styles from './Auth.module.css'

export default function Auth({ onAuth }) {
  const { t } = useLanguage()
  const [tab,      setTab]      = useState('login')
  const [forgot,   setForgot]   = useState(false)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [realName, setRealName] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState(null) // { type, text }

  const switchTab = (t) => {
    setTab(t)
    setMsg(null)
  }

  const goForgot = () => {
    setForgot(true)
    setMsg(null)
  }

  const backFromForgot = () => {
    setForgot(false)
    setPassword('')
    setMsg(null)
  }

  const handleSubmit = async () => {
    if (!email || !password) return setMsg({ type: 'error', text: t('auth.completeFields') })
    if (tab === 'register' && password.length < 6)
      return setMsg({ type: 'error', text: t('auth.passwordTooShort') })

    setLoading(true)
    setMsg(null)

    const { error, data } = tab === 'login'
      ? await onAuth.signIn(email, password)
      : await onAuth.signUp(email, password, realName)

    setLoading(false)

    if (error) {
      setMsg({ type: 'error', text: translateAuthError(error.message) })
      return
    }

    if (tab === 'register') {
      setMsg({ type: 'success', text: t('auth.registerSuccess') })
      setTimeout(() => {
        setMsg(null)
        setPassword('')
        switchTab('login')
      }, 2500)
    }
    // login success is handled by useAuth listener in App.jsx
  }

  const handleForgot = async () => {
    if (!email || !String(email).trim())
      return setMsg({ type: 'error', text: t('auth.completeFields') })
    setLoading(true)
    setMsg(null)
    const { error } = await onAuth.resetPassword(String(email).trim())
    setLoading(false)
    if (error) {
      setMsg({ type: 'error', text: translateAuthError(error.message) })
      return
    }
    // No se revela si el email existe (seguridad anti-enumeración).
    setMsg({ type: 'success', text: t('auth.forgotSent') })
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.brand}>GameGuru</div>
          <div className={styles.sub}>Liga de Pronósticos</div>
        </div>

        {forgot ? (
          <>
            <div className={styles.forgotTitle}>{t('auth.forgotPassword')}</div>
            <p className={styles.hint} style={{ marginBottom: '1.25rem' }}>{t('auth.forgotHint')}</p>

            <div className="field">
              <label>{t('auth.emailLabel')}</label>
              <input
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleForgot() }}
                autoFocus
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={handleForgot}
              disabled={loading}
            >
              {loading ? t('auth.loading') : t('auth.forgotSubmit')}
            </button>

            <button className={styles.linkBtn} onClick={backFromForgot}>{t('auth.forgotBack')}</button>

            {msg && (
              <div className={`msg ${msg.type}`} style={{ marginTop: '1rem' }}>
                {msg.text}
              </div>
            )}
          </>
        ) : (
          <>
        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${tab === 'login' ? styles.active : ''}`}
            onClick={() => switchTab('login')}
          >
            {t('auth.loginTab')}
          </button>
          <button
            className={`${styles.tabBtn} ${tab === 'register' ? styles.active : ''}`}
            onClick={() => switchTab('register')}
          >
            {t('auth.registerTab')}
          </button>
        </div>

        {/* Google (deshabilitado temporalmente: el OAuth no está operativo) */}

        {/* Fields */}
        {tab === 'register' && (
          <div className="field">
            <label>{t('auth.realName')}</label>
            <input
              type="text"
              placeholder={t('auth.realNameOptional')}
              value={realName}
              onChange={e => setRealName(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="name"
            />
            <div className={styles.hint}>{t('auth.realNameHint')}</div>
          </div>
        )}

        <div className="field">
          <label>{t('auth.emailLabel')}</label>
          <input
            type="email"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="email"
            inputMode="email"
          />
        </div>

        <div className="field">
          <label>{t('auth.password')}</label>
          <input
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKey}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading
            ? t('auth.loading')
            : tab === 'login' ? t('auth.loginBtn') : t('auth.registerBtn')}
        </button>

        {tab === 'login' && (
          <button className={styles.linkBtn} onClick={goForgot}>
            {t('auth.forgotPassword')}
          </button>
        )}

        {msg && (
          <div className={`msg ${msg.type}`} style={{ marginTop: '1rem' }}>
            {msg.text}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}
