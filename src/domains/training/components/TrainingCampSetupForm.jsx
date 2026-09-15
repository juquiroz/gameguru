import { useState } from 'react'
import { useLanguage } from '../../../i18n/context'
import { TRAINING_LEVELS_LIST, TRAINING_SPEEDS, GAME_COUNT_OPTIONS } from '../models/levels'
import styles from '../training.module.css'

const roundUp = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const toLocalInput = (iso) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const levelLabelKey = (id) => `training.level${id.charAt(0).toUpperCase()}${id.slice(1)}`

// Formulario de configuración del evento. Reutilizado por el modal standalone
// (BUILD-TC-001) y por el paso "Configuración" del wizard de experiencias
// (BUILD-TC-002). No renderiza overlay: el contenedor define el contexto.
export default function TrainingCampSetupForm({
  initialName = '',
  initialStart,
  initialLevel = 'standard',
  initialGameCount = 10,
  initialSpeed = 'normal',
  submitLabel, busyLabel, onSubmit, onSuccess,
}) {
  const { t } = useLanguage()

  const [name, setName] = useState(initialName)
  const [start, setStart] = useState(initialStart || roundUp())
  const [level, setLevel] = useState(initialLevel)
  const [gameCount, setGameCount] = useState(initialGameCount)
  const [speed, setSpeed] = useState(initialSpeed)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setMsg(null)
    if (!name.trim()) return setMsg({ type: 'error', text: t('training.nameRequired') })
    if (!start) return setMsg({ type: 'error', text: t('training.startRequired') })
    if (new Date(start).getTime() <= Date.now()) return setMsg({ type: 'error', text: t('training.startInPast') })

    setBusy(true)
    const config = { name: name.trim(), startAt: new Date(start).toISOString(), level, gameCount, speed }
    const result = await onSubmit(config)
    setBusy(false)

    if (result?.error) { setMsg({ type: 'error', text: result.error.message }); return }
    onSuccess?.(result)
  }

  return (
    <>
      <label className={styles.fieldLabel}>{t('training.nameLabel')}</label>
      <input
        className={styles.fieldInput}
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={t('training.namePlaceholder')}
        maxLength={60}
      />

      <label className={styles.fieldLabel}>{t('training.startLabel')}</label>
      <input
        className={styles.fieldInput}
        type="datetime-local"
        value={start}
        onChange={e => setStart(e.target.value)}
      />
      <div className={styles.fieldHint}>{t('training.startHint')}</div>

      <label className={styles.fieldLabel}>{t('training.levelLabel')}</label>
      <div className={styles.levelGrid}>
        {TRAINING_LEVELS_LIST.map(lv => {
          const lvKey = levelLabelKey(lv.id)
          const selected = level === lv.id
          return (
            <button
              key={lv.id}
              className={`${styles.levelCard} ${selected ? styles.levelCardSel : ''}`}
              onClick={() => setLevel(lv.id)}
            >
              <span className={styles.levelCardIcon}>{lv.icon}</span>
              <span className={styles.levelCardName}>{t(lvKey)}</span>
              <span className={styles.levelCardDesc}>{t(`${lvKey}Desc`)}</span>
            </button>
          )
        })}
      </div>

      {level === 'custom' && (
        <div className={styles.customRow}>
          <div>
            <label className={styles.fieldLabel}>{t('training.gamesLabel')}</label>
            <select className={styles.fieldSelect} value={gameCount} onChange={e => setGameCount(Number(e.target.value))}>
              {GAME_COUNT_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className={styles.fieldLabel}>{t('training.speedLabel')}</label>
            <select className={styles.fieldSelect} value={speed} onChange={e => setSpeed(e.target.value)}>
              {TRAINING_SPEEDS.map(sp => (
                <option key={sp.id} value={sp.id}>{t(`training.speed${sp.id.charAt(0).toUpperCase()}${sp.id.slice(1)}`)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {msg && <div className={`msg ${msg.type}`} style={{ marginTop: '0.75rem' }}>{msg.text}</div>}

      <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={submit} disabled={busy}>
        {busy ? busyLabel : submitLabel}
      </button>
    </>
  )
}
