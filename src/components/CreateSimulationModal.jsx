import { useState } from 'react'
import { NFL_TEAMS } from '../data/nflData'
import TeamLogo from './TeamLogo'
import styles from './CreateSimulationModal.module.css'

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

  const addGame = () => {
    if (!away || !home) return setMsg({ type: 'error', text: 'Selecciona ambos equipos.' })
    if (away === home) return setMsg({ type: 'error', text: 'Los equipos deben ser distintos.' })
    if (!date || !time) return setMsg({ type: 'error', text: 'Completa fecha y hora.' })
    const dup = games.some(g => g.away === away && g.home === home)
    if (dup) return setMsg({ type: 'error', text: 'Ese partido ya fue agregado.' })
    setMsg(null)
    setGames(prev => [...prev, { away, home, date, time, week: 1 }])
    setAway(''); setHome(''); setDate(''); setTime('')
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
      <div className={styles.overlay}>
        <div className={styles.successModal}>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '.5rem' }}>✅ Liga de Simulación creada</div>
          <p style={{ color: 'var(--text2)', lineHeight: 1.5, marginBottom: '1rem' }}>
            Comparte el código <strong style={{ color: 'var(--accent)', letterSpacing: '.12em' }}>{inviteLeague.code}</strong>{' '}
            con tus amigos para que se unan.
          </p>
          <input
            readOnly
            value={`${window.location.origin}/?join=${inviteLeague.code}`}
            className={styles.input}
            style={{ width: '100%', marginBottom: '1rem', fontSize: '.78rem' }}
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
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>🧪 Crear Liga de Simulación</div>
          <button className={styles.headerClose} onClick={onClose}>✕</button>
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
          <div className={styles.gamesList}>
            <label className={styles.gamesListLabel}>
              Partidos agregados ({games.length})
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {games.map((g, i) => (
                <div key={i} className={styles.gameItem}>
                  <span className={styles.gameItemTeams}>
                    <TeamLogo abbr={g.away} size={18} />
                    <span style={{ fontWeight: 600, fontSize: '.82rem' }}>{g.away}</span>
                    <span style={{ color: 'var(--text3)', fontSize: '.75rem' }}>@</span>
                    <TeamLogo abbr={g.home} size={18} />
                    <span style={{ fontWeight: 600, fontSize: '.82rem' }}>{g.home}</span>
                  </span>
                  <span className={styles.gameItemMeta}>
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
        <div className={styles.addGameForm}>
          <label className={styles.addGameLabel}>Agregar partido</label>

          <div className={styles.teamRow}>
            <select className={styles.teamSelect} value={away} onChange={e => setAway(e.target.value)}>
              <option value="">Visitante</option>
              {availableAway.map(t => (
                <option key={t.abbr} value={t.abbr}>{t.abbr} — {t.name}</option>
              ))}
            </select>
            <span className={styles.teamVs}>@</span>
            <select className={styles.teamSelect} value={home} onChange={e => setHome(e.target.value)}>
              <option value="">Local</option>
              {availableHome.map(t => (
                <option key={t.abbr} value={t.abbr}>{t.abbr} — {t.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.dateRow}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className={styles.inputDate} />
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className={styles.inputTime} />
            <button onClick={addGame} className={styles.addBtn}>+ Agregar</button>
          </div>
        </div>

        <button
          className={`btn-primary ${styles.createBtn}`}
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
