import { useState } from 'react'
import { NFL_TEAMS } from '../data/nflData'
import TeamLogo from './TeamLogo'

const TEAM_LIST = Object.entries(NFL_TEAMS).map(([abbr, data]) => ({ abbr, ...data }))

export default function CreateSimulationModal({ onClose, onCreateSimulation, onEnterLeague }) {
  const [name, setName] = useState('')
  const [games, setGames] = useState([])
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState(null)
  const [inviteLeague, setInviteLeague] = useState(null)

  // New game form
  const [away, setAway] = useState('')
  const [home, setHome] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [week, setWeek] = useState(1)

  const addGame = () => {
    if (!away || !home) return setMsg({ type: 'error', text: 'Selecciona ambos equipos.' })
    if (away === home) return setMsg({ type: 'error', text: 'Los equipos deben ser distintos.' })
    if (!date || !time) return setMsg({ type: 'error', text: 'Completa fecha y hora.' })
    if (!week || week < 1) return setMsg({ type: 'error', text: 'Semana inválida.' })
    const dup = games.some(g => g.away === away && g.home === home)
    if (dup) return setMsg({ type: 'error', text: 'Ese partido ya fue agregado.' })
    setMsg(null)
    setGames(prev => [...prev, { away, home, date, time, week }])
    setAway(''); setHome(''); setDate(''); setTime(''); setWeek(1)
  }

  const removeGame = (idx) => {
    setGames(prev => prev.filter((_, i) => i !== idx))
  }

  const handleCreate = async () => {
    if (!name.trim()) return setMsg({ type: 'error', text: 'Escribe un nombre para la liga.' })
    if (games.length === 0) return setMsg({ type: 'error', text: 'Agrega al menos un partido.' })
    setCreating(true)
    setMsg(null)
    const { data, error } = await onCreateSimulation(name.trim(), games)
    setCreating(false)
    if (error) { setMsg({ type: 'error', text: error.message }); return }
    setName('')
    setInviteLeague(data)
  }

  const handleClose = () => {
    if (inviteLeague) onEnterLeague(inviteLeague)
    onClose()
  }

  const availableAway = TEAM_LIST.filter(t => t.abbr !== home)
  const availableHome = TEAM_LIST.filter(t => t.abbr !== away)

  if (inviteLeague) {
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
          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '.5rem' }}>✅ Liga de Simulación creada</div>
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
        </div>
      </div>
    )
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
        width: '100%', maxWidth: '520px',
        position: 'relative',
        maxHeight: '90vh', overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', letterSpacing: '.06em' }}>
            🧪 Crear Liga de Simulación
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
            placeholder="Ej: Test Simulación"
            maxLength={40}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Games list */}
        {games.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '.35rem', fontSize: '.82rem', color: 'var(--text2)' }}>
              Partidos agregados ({games.length})
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {games.map((g, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'var(--bg3)', padding: '.5rem .7rem',
                  borderRadius: 'var(--r-sm)',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                    <TeamLogo abbr={g.away} size={18} />
                    <span style={{ fontWeight: 600, fontSize: '.82rem' }}>{g.away}</span>
                    <span style={{ color: 'var(--text3)', fontSize: '.75rem' }}>@</span>
                    <TeamLogo abbr={g.home} size={18} />
                    <span style={{ fontWeight: 600, fontSize: '.82rem' }}>{g.home}</span>
                  </span>
                  <span style={{ fontSize: '.75rem', color: 'var(--text3)' }}>
                    Sem {g.week} · {g.date} {g.time}
                  </span>
                  <button
                    onClick={() => removeGame(i)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--danger, #ff4b4b)',
                      cursor: 'pointer', fontSize: '.9rem', padding: '2px 6px', opacity: .6,
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add game form */}
        <div style={{
          background: 'var(--bg3)', borderRadius: 'var(--r)',
          padding: '1rem', marginBottom: '1rem',
        }}>
          <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.82rem', color: 'var(--text2)' }}>
            Agregar partido
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <select value={away} onChange={e => setAway(e.target.value)} style={{
              padding: '.5rem', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
              background: 'var(--bg2)', color: 'var(--text)', fontSize: '.82rem',
            }}>
              <option value="">Visitante</option>
              {availableAway.map(t => (
                <option key={t.abbr} value={t.abbr}>{t.abbr} — {t.name}</option>
              ))}
            </select>
            <span style={{ color: 'var(--text3)', fontSize: '.85rem' }}>@</span>
            <select value={home} onChange={e => setHome(e.target.value)} style={{
              padding: '.5rem', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
              background: 'var(--bg2)', color: 'var(--text)', fontSize: '.82rem',
            }}>
              <option value="">Local</option>
              {availableHome.map(t => (
                <option key={t.abbr} value={t.abbr}>{t.abbr} — {t.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{
              flex: 1, padding: '.5rem', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
              background: 'var(--bg2)', color: 'var(--text)', fontSize: '.82rem',
            }} />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{
              flex: 1, padding: '.5rem', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
              background: 'var(--bg2)', color: 'var(--text)', fontSize: '.82rem',
            }} />
            <input type="number" min="1" max="99" value={week} onChange={e => setWeek(Number(e.target.value))}
              placeholder="Sem"
              title="Semana"
              style={{
                width: '3rem', padding: '.5rem', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)', background: 'var(--bg2)',
                color: 'var(--text)', fontSize: '.82rem', textAlign: 'center',
              }}
            />
            <button
              onClick={addGame}
              style={{
                padding: '.5rem 1rem', background: 'var(--accent)', color: '#000',
                border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >+ Agregar</button>
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? 'Creando...' : `Crear liga con ${games.length} partido${games.length !== 1 ? 's' : ''}`}
        </button>

        {msg && (
          <div className={`msg ${msg.type}`} style={{ marginTop: '0.75rem' }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}
