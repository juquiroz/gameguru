import { useState } from 'react'
import { SPORTS } from '../data/nflData'

export default function CreateLeagueModal({ onClose, onCreateLeague, onEnterLeague }) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState('NFL')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [inviteLeague, setInviteLeague] = useState(null)

  const handleCreate = async () => {
    if (!name.trim()) return setMsg({ type: 'error', text: 'Escribe un nombre para la liga.' })
    setCreating(true)
    setMsg(null)
    const { data, error, warning } = await onCreateLeague(name.trim(), sport)
    setCreating(false)
    if (error) { setMsg({ type: 'error', text: error.message }); return }
    setName('')
    setMsg(warning ? { type: 'warning', text: warning } : null)
    setInviteLeague(data)
  }

  const handleClose = () => {
    if (inviteLeague) onEnterLeague(inviteLeague)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--r-xl)',
        padding: '1.75rem 1.5rem',
        width: '100%', maxWidth: '440px',
        position: 'relative',
      }}>
        {inviteLeague ? (
          <>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '.5rem' }}>✅ Liga creada</div>
            <p style={{ color: 'var(--text2)', lineHeight: 1.5, marginBottom: '1rem' }}>
              Comparte el código <strong style={{ color: 'var(--accent)', letterSpacing: '.12em' }}>{inviteLeague.code}</strong>{' '}
              con tus amigos para que se unan.
            </p>
            <input
              readOnly
              value={`${window.location.origin}/gameguru/?join=${inviteLeague.code}`}
              style={{
                width: '100%', padding: '.6rem .8rem',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', color: 'var(--text2)',
                fontSize: '.78rem', marginBottom: '1rem',
              }}
              onClick={e => e.target.select()}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleClose}>
                Entrar a la liga
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', letterSpacing: '.06em' }}>
                ➕ Crear Liga
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', color: 'var(--text3)',
                  fontSize: '1.2rem', cursor: 'pointer', padding: '4px',
                }}
              >✕</button>
            </div>

            <div className="field">
              <label>Nombre de la liga</label>
              <input
                type="text"
                placeholder="Ej: Los Carnales Fantasy"
                maxLength={40}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>

            <div className="field">
              <label>Deporte</label>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
              }}>
                {SPORTS.map(s => (
                  <button
                    key={s.id}
                    style={{
                      background: sport === s.id ? 'rgba(245,166,35,.1)' : 'var(--bg3)',
                      border: `2px solid ${sport === s.id ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--r-sm)', padding: '.65rem .3rem',
                      textAlign: 'center', cursor: 'pointer', transition: 'all .15s',
                    }}
                    onClick={() => setSport(s.id)}
                  >
                    <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '3px' }}>{s.icon}</span>
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: '.85rem',
                      letterSpacing: '.05em', display: 'block',
                      color: sport === s.id ? 'var(--accent)' : 'var(--text2)',
                    }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>


            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: '.25rem' }}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? 'Creando...' : 'Crear y obtener enlace'}
            </button>

            {msg && (
              <div className={`msg ${msg.type}`} style={{ marginTop: '0.75rem' }}>
                {msg.text}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
