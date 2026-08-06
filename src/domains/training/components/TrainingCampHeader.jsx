import { useLanguage } from '../../../i18n/context'
import { getTrainingLevel } from '../models/levels'
import styles from '../training.module.css'

const fmtStart = (d) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(d))

export default function TrainingCampHeader({ event, phase, levelLabel, sessionNo }) {
  const { t } = useLanguage()
  const level = getTrainingLevel(event?.level)
  const name = event?.name || ''

  // Personalidad del Lobby (BUILD-TC-003): cada estado habla como la sesión.
  const pill = {
    created: t('training.personaCreated'),
    waiting: t('training.personaWaiting'),
    countdown: t('training.personaCountdown'),
    ready: t('training.personaReady'),
    cancelled: t('training.personaCancelled'),
    finished: t('training.personaFinished'),
  }[phase] || t('training.statusUnknown')

  const live = phase === 'countdown'

  return (
    <header className={styles.banner}>
      <div className={styles.bannerTop}>
        <span className={styles.bannerEyebrow}>
          {sessionNo ? t('training.sessionTag', { no: sessionNo }) : t('training.eyebrow')}
        </span>
        {event?.start_at && (
          <span className={styles.chip}>{fmtStart(event.start_at)}</span>
        )}
      </div>
      <div className={styles.bannerTitle}>
        <span className={styles.bannerTitleIcon}>{level.icon}</span>
        <span>{name}</span>
      </div>
      <div className={styles.bannerMeta}>
        <span className={`${styles.chip} ${styles.chipLevel}`}>
          {t('training.level', { level: levelLabel })}
        </span>
        <span className={`${styles.chip} ${styles.chipPill} ${live ? styles.bannerPillLive : ''}`}>
          {pill}
        </span>
      </div>
    </header>
  )
}
