import { useState } from 'react'
import { useLanguage } from '../../../i18n/context'
import { MAX_AUTO_WEEKS, AUTO_GAMES_PER_WEEK, AUTO_GAME_SPACING_MINUTES, AUTO_PICK_DEADLINE_MINUTES } from '../autoSchedule'
import styles from '../training-camp.module.css'

// BUILD-TC-V2-AUTO — Wizard del Training Camp AUTOMÁTICO.
// El admin solo elige: nombre + número de semanas (1..3) + fecha/hora de
// inicio de cada semana. Al crear: la liga genera 5 juegos por semana (5 min
// entre tips), los picks cierran 10 min antes de cada juego, los resultados
// se resuelven solos al tip y los nombres se revelan al final.
const pad = (n) => String(n).padStart(2, '0')
const toLocalInput = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  const off = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
  return `${off.getFullYear()}-${pad(off.getMonth() + 1)}-${pad(off.getDate())}T${pad(off.getHours())}:${pad(off.getMinutes())}`
}
const fromLocalInput = (v) => {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
const addDays = (iso, days) => {
  const d = new Date(iso)
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

export default function SimulationCampWizard({ initialName, busy, onSubmit, onClose }) {
  const { t } = useLanguage()
  const [name, setName] = useState(initialName || '')
  const [totalWeeks, setTotalWeeks] = useState(1)
  const [weekStarts, setWeekStarts] = useState(() => {
    const base = addDays(new Date().toISOString(), 0)
    return [toLocalInput(base), toLocalInput(addDays(base, 7)), toLocalInput(addDays(base, 14))]
  })
  const [msg, setMsg] = useState(null)

  const setStart = (idx, value) => {
    setWeekStarts(prev => prev.map((v, i) => (i === idx ? value : v)))
  }

  const handleCreate = () => {
    const n = Math.max(1, Math.min(Math.floor(Number(totalWeeks) || 1), MAX_AUTO_WEEKS))
    const starts = weekStarts.slice(0, n).map(fromLocalInput)
    if (!starts[0]) return setMsg('Elige la fecha y hora de inicio de la semana 1.')
    for (let i = 1; i < starts.length; i++) {
      if (!starts[i]) return setMsg(`Elige la fecha y hora de inicio de la semana ${i + 1}.`)
      if (new Date(starts[i]) <= new Date(starts[i - 1])) {
        return setMsg(`La semana ${i + 1} debe empezar después de la semana ${i}.`)
      }
    }
    if (new Date(starts[0]) <= new Date()) {
      return setMsg('El inicio de la semana 1 debe ser en el futuro.')
    }
    onSubmit({ name: name.trim() || 'Training Camp', totalWeeks: n, weeks: [], weekStarts: starts })
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Nueva liga de simulación</div>
      <p style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '.75rem' }}>
        Solo eliges el nombre, las semanas y la hora de inicio de cada una. Se generarán
        automáticamente {AUTO_GAMES_PER_WEEK} juegos por semana (cada {AUTO_GAME_SPACING_MINUTES} minutos),
        los picks cierran {AUTO_PICK_DEADLINE_MINUTES} min antes de cada juego y los resultados se
        resuelven solos al inicio. Los nombres de los jugadores se revelan al final del campamento.
      </p>
      <div className={styles.row} style={{ marginBottom: '.75rem' }}>
        <label style={{ fontSize: '.85rem', fontWeight: 600 }}>Nombre</label>
        <input
          className={styles.input}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Mi liga de simulación"
          style={{ flex: 1 }}
        />
      </div>
      <div className={styles.row} style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '.85rem', fontWeight: 600 }}>Semanas</label>
        <select className={styles.select} value={totalWeeks} onChange={e => setTotalWeeks(Number(e.target.value))}>
          {Array.from({ length: MAX_AUTO_WEEKS }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span style={{ fontSize: '.8rem', color: 'var(--text2)' }}>equipos aleatorios cada semana</span>
      </div>

      <div style={{ fontSize: '.8rem', color: 'var(--text2)', marginBottom: '.5rem', fontWeight: 600 }}>
        Inicio de cada semana
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1rem' }}>
        {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
          <div key={w} className={styles.row}>
            <label style={{ fontSize: '.82rem', width: 78 }}>Semana {w}</label>
            <input
              className={styles.input}
              type="datetime-local"
              value={weekStarts[w - 1] || ''}
              onChange={e => setStart(w - 1, e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        ))}
      </div>

      {msg && <div className={`${styles.note} ${styles.noteInfo}`}>{msg}</div>}

      <div className={styles.row} style={{ justifyContent: 'space-between' }}>
        <button className={styles.btnGhost} onClick={onClose}>{t('wizard.back')}</button>
        <button className={styles.btnPrimary} onClick={handleCreate} disabled={busy}>
          {busy ? 'Creando…' : 'Crear liga'}
        </button>
      </div>
    </div>
  )
}