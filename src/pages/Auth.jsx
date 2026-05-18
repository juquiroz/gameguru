import { useState } from 'react'
import { translateAuthError } from '../data/nflData'
import styles from './Auth.module.css'

export default function Auth({ onAuth }) {
  const [tab,      setTab]      = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState(null) // { type, text }

  const switchTab = (t) => {
    setTab(t)
    setMsg(null)
  }

  const handleSubmit = async () => {
    if (!email || !password) return setMsg({ type: 'error', text: 'Completa todos los campos.' })
    if (tab === 'register' && password.length < 6)
      return setMsg({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' })

    setLoading(true)
    setMsg(null)

    const { error, data } = tab === 'login'
      ? await onAuth.signIn(email, password)
      : await onAuth.signUp(email, password, username)

    setLoading(false)

    if (error) {
      setMsg({ type: 'error', text: translateAuthError(error.message) })
      return
    }

    if (tab === 'register') {
      setMsg({ type: 'success', text: '✅ ¡Registro exitoso! Redirigiendo al inicio de sesión...' })
      setTimeout(() => {
        setMsg(null)
        setPassword('')
        switchTab('login')
      }, 2500)
    }
    // login success is handled by useAuth listener in App.jsx
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
            Entrar
          </button>
          <button
            className={`${styles.tabBtn} ${tab === 'register' ? styles.active : ''}`}
            onClick={() => switchTab('register')}
          >
            Registrarse
          </button>
        </div>

        {/* Fields */}
        {tab === 'register' && (
          <div className="field">
            <label>Nombre de usuario</label>
            <input
              type="text"
              placeholder="Tu nombre en la liga"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="nickname"
            />
          </div>
        )}

        <div className="field">
          <label>Correo electrónico</label>
          <input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="email"
            inputMode="email"
          />
        </div>

        <div className="field">
          <label>Contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
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
            ? 'Cargando...'
            : tab === 'login' ? 'Entrar a la Liga' : 'Unirse a la Liga'}
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
