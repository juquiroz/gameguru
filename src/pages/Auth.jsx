import { useState } from 'react'
import { useLanguage } from '../i18n/context'
import { translateAuthError } from '../data/nflData'
import styles from './Auth.module.css'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  )
}

export default function Auth({ onAuth }) {
  const { t } = useLanguage()
  const [tab,      setTab]      = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [realName, setRealName] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [msg,      setMsg]      = useState(null) // { type, text }

  const switchTab = (t) => {
    setTab(t)
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

  const handleGoogle = async () => {
    if (!onAuth.signInWithGoogle) return
    setGoogleLoading(true)
    setMsg(null)
    const { error } = await onAuth.signInWithGoogle()
    setGoogleLoading(false)
    // On success the browser redirects to the OAuth provider and back; the
    // session token is captured from the URL hash by the SDK (no-op here).
    if (error) setMsg({ type: 'error', text: translateAuthError(error.message) })
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.brand}>GameGuru</div>
          <div className={styles.sub}>Liga de Pronósticos</div>
        </div>

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

        {/* Google */}
        <button
          className={styles.googleBtn}
          onClick={handleGoogle}
          disabled={googleLoading || !onAuth.signInWithGoogle}
        >
          <GoogleIcon />
          <span>{googleLoading ? t('auth.loading') : t('auth.google')}</span>
        </button>

        <div className={styles.divider}>
          <span>{t('auth.or')}</span>
        </div>

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

        {msg && (
          <div className={`msg ${msg.type}`} style={{ marginTop: '1rem' }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}
