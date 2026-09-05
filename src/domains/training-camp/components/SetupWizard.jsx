import { useState } from 'react'
import styles from '../training-camp.module.css'

export default function TrainingCampSetupWizard({ initialName, initialWeeks, busy, onSave }) {
  const [name, setName] = useState(initialName || '')
  const [weeks, setWeeks] = useState(initialWeeks || 4)

  const submit = () => {
    const n = Math.max(1, Math.floor(Number(weeks) || 1))
    onSave({ name: name.trim() || 'Training Camp', totalWeeks: n })
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Configura tu Training Camp</div>
      <p style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '.75rem' }}>
        Define el número de semanas y luego agregarás los juegos de cada semana manualmente.
      </p>

      <div className={styles.row} style={{ marginBottom: '.75rem' }}>
        <label style={{ fontSize: '.85rem', fontWeight: 600 }}>Nombre</label>
        <input
          className={styles.input}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Mi Training Camp"
          style={{ flex: 1 }}
        />
      </div>

      <div className={styles.row} style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '.85rem', fontWeight: 600 }}>Número de semanas</label>
        <select className={styles.select} value={weeks} onChange={e => setWeeks(e.target.value)}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <button className={styles.btnPrimary} disabled={busy} onClick={submit}>
        {busy ? 'Guardando…' : 'Continuar'}
      </button>
    </div>
  )
}
