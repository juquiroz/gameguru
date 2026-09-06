import { useState } from 'react'
import { useLanguage } from '../../../i18n/context'
import styles from '../training-camp.module.css'

// BUILD-TC-V2 — Wizard simple de creación de una liga de simulación.
// Flujo: nombre + número de semanas → "Crear liga". Los juegos de cada semana
// los agrega el admin después, desde la página del Training Camp (WeekManager).
export default function SimulationCampWizard({ initialName, busy, onSubmit, onClose }) {
  const { t } = useLanguage()
  const [name, setName] = useState(initialName || '')
  const [totalWeeks, setTotalWeeks] = useState(2)

  const handleCreate = () => {
    const n = Math.max(1, Math.floor(Number(totalWeeks) || 1))
    onSubmit({ name: name.trim() || 'Training Camp', totalWeeks: n, weeks: [] })
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Nueva liga de simulación</div>
      <p style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '.75rem' }}>
        Elige el nombre y el número de semanas. Al crear la liga podrás agregar
        los juegos de cada semana manualmente.
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
        <label style={{ fontSize: '.85rem', fontWeight: 600 }}>Número de semanas</label>
        <select className={styles.select} value={totalWeeks} onChange={e => setTotalWeeks(e.target.value)}>
          {[2, 3, 4, 5, 6, 7, 8].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className={styles.row} style={{ justifyContent: 'space-between' }}>
        <button className={styles.btnGhost} onClick={onClose}>{t('wizard.back')}</button>
        <button className={styles.btnPrimary} onClick={handleCreate} disabled={busy}>
          {busy ? 'Creando…' : 'Crear liga'}
        </button>
      </div>
    </div>
  )
}