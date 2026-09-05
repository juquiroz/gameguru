import { useState } from 'react'
import { SPORTS } from '../../../data/nflData'
import { useLanguage } from '../../../i18n/context'
import { detectBrowserTimezone } from '../../league/models/timezone'
import SimulationCampWizard from '../../training-camp/components/SimulationCampWizard'
import ExperiencePicker from './ExperiencePicker'
import styles from '../experience.module.css'

// Wizard oficial de creación (BUILD-TC-002).
// Flujo: Experience Picker → [Training Camp Intro] → Configuración → Confirmación → Lobby/liga.
// Es la ÚNICA puerta de entrada para crear una experiencia nueva.
export default function ExperienceWizard({ initialExperience, onClose, onCreateLeague, onCreateTrainingCamp, onEnterLeague }) {
  const { t } = useLanguage()

  const [experience, setExperience] = useState(initialExperience || null)
  const [step, setStep] = useState(initialExperience === 'practice' ? 'sim-camp' : 'picker')

  // Configuración de liga (Preseason/Regular)
  const [name, setName] = useState('')
  const [sport, setSport] = useState('NFL')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [invite, setInvite] = useState(null)

  const goPicker = () => { setStep('picker') }

  const handlePick = (id) => {
    setExperience(id)
    if (id === 'practice') setStep('sim-camp')
    else setStep('league-config')
  }

  // Paso de creación: crea la liga + sesión + juegos y entra al Campamento.
  const handleCreateEvent = async (campDraft) => {
    if (!campDraft) return
    setMsg(null)
    setBusy(true)
    const result = await onCreateTrainingCamp(campDraft)
    setBusy(false)
    if (result?.error) { setMsg({ type: 'error', text: result.error.message }); return }
    onEnterLeague(result.data, 'practice')
  }

  const handleCreateLeague = async () => {
    setMsg(null)
    if (!name.trim()) return setMsg({ type: 'error', text: t('lobby.nameRequired') })
    setBusy(true)
    const result = await onCreateLeague(name.trim(), sport, { leagueMode: experience, timezone: detectBrowserTimezone() })
    setBusy(false)
    if (result?.error) { setMsg({ type: 'error', text: result.error.message }); return }
    setInvite(result.data)
    if (result.warning) setMsg({ type: 'warning', text: result.warning })
  }

  const renderStep = () => {
    if (step === 'picker') {
      return (
        <>
          <div className={styles.modalHeader}>
            <div className={styles.modalTitle}>{t('wizard.title')}</div>
            <button className={styles.modalClose} onClick={onClose}>✕</button>
          </div>
          <p className={styles.modalSub}>{t('wizard.subtitle')}</p>
          <ExperiencePicker onSelect={handlePick} />
        </>
      )
    }

    if (step === 'sim-camp') {
      return (
        <>
          <div className={styles.modalHeader}>
            <div className={styles.modalTitle}>🎯 {t('training.name')}</div>
            <button className={styles.modalClose} onClick={onClose}>✕</button>
          </div>
          {msg && <div className={`msg ${msg.type}`} style={{ marginTop: '0.75rem' }}>{msg.text}</div>}
          <SimulationCampWizard
            busy={busy}
            onClose={onClose}
            onSubmit={handleCreateEvent}
          />
        </>
      )
    }

    if (invite) {
      return (
        <>
          <div className={styles.modalHeader}>
            <div className={styles.modalTitle}>✅ {t('lobby.inviteTitle')}</div>
            <button className={styles.modalClose} onClick={onClose}>✕</button>
          </div>
          <p className={styles.modalSub}>{t('lobby.inviteDesc', { code: invite.code })}</p>
          <input
            readOnly
            value={`${window.location.origin}/?join=${invite.code}`}
            className={styles.inviteInput}
            onClick={e => e.target.select()}
          />
          {msg && <div className={`msg ${msg.type}`} style={{ marginTop: '0.6rem' }}>{msg.text}</div>}
          <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => onEnterLeague(invite, experience)}>
            {t('lobby.enterLeague')}
          </button>
        </>
      )
    }

    // league-config (Preseason/Regular)
    return (
      <>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{experience === 'preseason' ? '🏈' : '🏆'} {t(experience === 'preseason' ? 'wizard.expPreseason' : 'wizard.expRegular')}</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <p className={styles.modalSub}>{t('lobby.createDesc')}</p>

        <label className={styles.fieldLabel}>{t('lobby.nameLabel')}</label>
        <input
          className={styles.fieldInput}
          type="text"
          placeholder={t('lobby.namePlaceholder')}
          maxLength={40}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateLeague()}
        />

        <label className={styles.fieldLabel}>{t('lobby.sportLabel')}</label>
        <div className={styles.sportGrid}>
          {SPORTS.map(s => (
            <button
              key={s.id}
              className={`${styles.sportBtn} ${sport === s.id ? styles.sportBtnSel : ''}`}
              onClick={() => setSport(s.id)}
            >
              <span className={styles.sportIcon}>{s.icon}</span>
              <span className={styles.sportName}>{s.label}</span>
            </button>
          ))}
        </div>

        {msg && <div className={`msg ${msg.type}`} style={{ marginTop: '0.75rem' }}>{msg.text}</div>}

        <div className={styles.introActions}>
          <button className={styles.btnGhost} onClick={goPicker}>{t('wizard.back')}</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleCreateLeague} disabled={busy}>
            {busy ? t('lobby.creating') : t('lobby.createBtn')}
          </button>
        </div>
      </>
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {renderStep()}
      </div>
    </div>
  )
}
