import { useState } from 'react'
import { useLanguage } from '../../../i18n/context'
import TrainingCampWeekManager from './WeekManager'
import styles from '../training-camp.module.css'

// BUILD-TC-V2 — Wizard simple de creación de una liga de simulación.
// Flujo: nombre + número de semanas → construir el calendario semana a semana
// (fecha/hora del primer juego y siguientes) → crear. Sin niveles ni velocidad:
// solo semanas y partidos manuales.
export default function SimulationCampWizard({ initialName, busy, onSubmit, onClose }) {
  const { t } = useLanguage()
  const [step, setStep] = useState('setup')
  const [name, setName] = useState(initialName || '')
  const [totalWeeks, setTotalWeeks] = useState(4)
  const [week, setWeek] = useState(1)
  const [gamesByWeek, setGamesByWeek] = useState({})

  const goConfig = () => {
    const n = Math.max(1, Math.floor(Number(totalWeeks) || 1))
    setTotalWeeks(n)
    setStep('calendar')
  }

  const addGame = ({ week: w, home, away, date, time }) => {
    if (!home || !away) return { error: { message: 'Selecciona ambos equipos.' } }
    if (home.abbr === away.abbr) return { error: { message: 'Los equipos deben ser distintos.' } }
    if (!date || !time) return { error: { message: 'Completa fecha y hora.' } }
    const id = `draft-${Date.now()}`
    const game = {
      id,
      week: Number(w),
      away_abbr: away.abbr,
      home_abbr: home.abbr,
      away_team: away.name,
      home_team: home.name,
      game_time: `${date}T${time}:00`,
      __raw: { home, away, date, time },
    }
    setGamesByWeek(prev => ({ ...prev, [w]: [...(prev[w] || []), game] }))
    return { error: null }
  }

  const removeGame = (gameId) => {
    setGamesByWeek(prev => {
      const next = {}
      for (const [w, list] of Object.entries(prev)) {
        next[w] = list.filter(g => g.id !== gameId)
      }
      return next
    })
  }

  const doFinish = () => {
    const weeksArray = []
    for (let w = 1; w <= totalWeeks; w++) {
      weeksArray.push({ week: w, games: gamesByWeek[w] || [] })
    }
    onSubmit({ name: name.trim() || 'Training Camp', totalWeeks, weeks: weeksArray })
  }

  const onNextWeek = () => setWeek(w => w + 1)
  const onPrevWeek = () => setWeek(w => w - 1)

  if (step === 'setup') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Nueva liga de simulación</div>
        <p style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '.75rem' }}>
          Define el nombre y el número de semanas, luego agregarás los juegos de cada semana.
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
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className={styles.row} style={{ justifyContent: 'space-between' }}>
          <button className={styles.btnGhost} onClick={onClose}>{t('wizard.back')}</button>
          <button className={styles.btnPrimary} onClick={goConfig}>Continuar →</button>
        </div>
      </div>
    )
  }

  const completedWeeks = Object.keys(gamesByWeek).filter(w => (gamesByWeek[w] || []).length > 0).length

  return (
    <div>
      <div className={styles.row} style={{ justifyContent: 'space-between', marginBottom: '.5rem' }}>
        <div className={`${styles.badge} ${styles.badgeSetup}`}>Semana {week} de {totalWeeks}</div>
        <div style={{ fontSize: '.82rem', color: 'var(--text2)' }}>
          {completedWeeks} semana{completedWeeks !== 1 ? 's' : ''} con juegos
        </div>
      </div>

      <TrainingCampWeekManager
        mode="setup"
        week={week}
        totalWeeks={totalWeeks}
        games={gamesByWeek[week] || []}
        busy={busy}
        isAdmin
        onAddGame={addGame}
        onRemoveGame={removeGame}
        onNextWeek={onNextWeek}
        onFinishSchedule={doFinish}
      />

      {week > 1 && (
        <div className={styles.row} style={{ justifyContent: 'flex-start', marginTop: '.5rem' }}>
          <button className={styles.btnGhost} onClick={onPrevWeek}>← Semana anterior</button>
        </div>
      )}
      {week === 1 && (
        <div className={styles.row} style={{ justifyContent: 'flex-start', marginTop: '.5rem' }}>
          <button className={styles.btnGhost} onClick={() => setStep('setup')}>← Configuración</button>
        </div>
      )}
    </div>
  )
}
