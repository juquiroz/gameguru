import { useState } from 'react'
import { SPORTS } from '../../../data/nflData'
import { useLanguage } from '../../../i18n/context'
import TrainingCampSetupForm from '../../training/components/TrainingCampSetupForm'
import { getTrainingLevel, resolveConfig } from '../../training/models/levels'
import ExperiencePicker from './ExperiencePicker'
import TrainingCampIntro from './TrainingCampIntro'
import { detectBrowserTimezone } from '../../league/models/timezone'
import styles from '../experience.module.css'

const levelLabelKey = (id) => `training.level${id.charAt(0).toUpperCase()}${id.slice(1)}`

const fmtDateTime = (iso) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))

// ISO → valor local para <input type="datetime-local">
const fmtInput = (iso) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// Wizard oficial de creación (BUILD-TC-002).
// Flujo: Experience Picker → [Training Camp Intro] → Configuración → Confirmación → Lobby/liga.
// Es la ÚNICA puerta de entrada para crear una experiencia nueva.
export default function ExperienceWizard({ initialExperience, onClose, onCreateLeague, onCreateTrainingCamp, onEnterLeague }) {
  const { t } = useLanguage()

  const [experience, setExperience] = useState(initialExperience || null)
  const [step, setStep] = useState(initialExperience === 'practice' ? 'intro' : 'picker')

  // Configuración de liga (Preseason/Regular)
  const [name, setName] = useState('')
  const [sport, setSport] = useState('NFL')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [invite, setInvite] = useState(null)

  // Borrador del Training Camp (config → confirmación → creación)
  const [draft, setDraft] = useState(null)

  const goPicker = () => { setStep('picker') }

  const handlePick = (id) => {
    setExperience(id)
    if (id === 'practice') setStep('intro')
    else setStep('league-config')
  }

  // Paso de configuración: solo guarda el borrador y avanza a la confirmación.
  const handleTcConfigSubmit = async (cfg) => {
    setDraft(cfg)
    setStep('tc-review')
    return { data: { draft: true } }
  }

  // Paso de confirmación: crea la liga + sesión y entra al Lobby.
  const handleCreateEvent = async () => {
    if (!draft) return
    setMsg(null)
    setBusy(true)
    const result = await onCreateTrainingCamp(draft)
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

    if (step === 'intro') {
      return (
        <>
          <div className={styles.modalHeader}>
            <div className={styles.modalTitle}>🎓 {t('training.name')}</div>
            <button className={styles.modalClose} onClick={onClose}>✕</button>
          </div>
          <TrainingCampIntro onBack={goPicker} onContinue={() => setStep('tc-config')} />
        </>
      )
    }

    if (step === 'tc-config') {
      return (
        <>
          <div className={styles.modalHeader}>
            <div className={styles.modalTitle}>{t('training.createTitle')}</div>
            <button className={styles.modalClose} onClick={onClose}>✕</button>
          </div>
          <p className={styles.modalSub}>{t('training.createSub')}</p>
          <TrainingCampSetupForm
            submitLabel={t('training.create')}
            busyLabel={t('training.creating')}
            initialName={draft?.name || ''}
            initialStart={draft?.startAt ? fmtInput(draft.startAt) : undefined}
            initialLevel={draft?.level}
            initialGameCount={draft?.gameCount}
            initialSpeed={draft?.speed}
            onSubmit={handleTcConfigSubmit}
          />
        </>
      )
    }

    if (step === 'tc-review') {
      const resolved = resolveConfig({
        level: draft?.level,
        gameCount: draft?.gameCount,
        speed: draft?.speed,
      })
      const level = getTrainingLevel(resolved.level)
      return (
        <>
          <div className={styles.modalHeader}>
            <div className={styles.modalTitle}>{t('training.reviewTitle')}</div>
            <button className={styles.modalClose} onClick={onClose}>✕</button>
          </div>
          <p className={styles.modalSub}>{t('training.reviewSub')}</p>

          <div className={styles.reviewCard}>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{t('training.reviewName')}</span>
              <span className={styles.reviewValue}>{draft?.name}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{t('training.reviewStart')}</span>
              <span className={styles.reviewValue}>{draft?.startAt ? fmtDateTime(draft.startAt) : '—'}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{t('training.reviewLevel')}</span>
              <span className={styles.reviewValue}>{level.icon} {t(levelLabelKey(level.id))}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{t('training.reviewGames')}</span>
              <span className={styles.reviewValue}>{t('training.reviewGamesCount', { count: resolved.gameCount })}</span>
            </div>
          </div>

          {msg && <div className={`msg ${msg.type}`} style={{ marginTop: '0.75rem' }}>{msg.text}</div>}

          <div className={styles.introActions}>
            <button className={styles.btnGhost} onClick={() => setStep('tc-config')}>{t('wizard.back')}</button>
            <button className={styles.btnPrimaryTc} onClick={handleCreateEvent} disabled={busy}>
              {busy ? t('training.creating') : t('training.reviewCreate')}
            </button>
          </div>
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
