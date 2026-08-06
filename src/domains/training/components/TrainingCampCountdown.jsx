import { useLanguage } from '../../../i18n/context'
import styles from '../training.module.css'

const pad = (n) => String(n).padStart(2, '0')

const split = (ms) => {
  if (!ms || ms <= 0) return { d: 0, h: 0, m: 0, s: 0 }
  const total = Math.floor(ms / 1000)
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  }
}

const fmtStart = (d) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(d))

export default function TrainingCampCountdown({ phase, remainingMs, startAt, sessionNo }) {
  const { t } = useLanguage()

  const active = phase === 'waiting' || phase === 'countdown'
  const live = phase === 'countdown'

  if (phase === 'ready' || phase === 'training_started') {
    return (
      <div className={styles.countdownCard}>
        <div className={styles.countdownReady}>
          <div className={styles.readyTitle}>🎬 {t('training.personaReady')}</div>
          <div className={styles.readySub}>{t('training.readySub')}</div>
        </div>
      </div>
    )
  }

  if (!active || remainingMs == null) {
    return (
      <div className={styles.countdownCard}>
        {sessionNo && (
          <div className={styles.sessionTag}>{t('training.sessionTag', { no: sessionNo })}</div>
        )}
        <div className={styles.countdownLabel}>{t('training.personaCountdown')}</div>
        <div className={styles.readySub}>
          {startAt ? fmtStart(startAt) : t('training.statusUnknown')}
        </div>
      </div>
    )
  }

  const { d, h, m, s } = split(remainingMs)
  const boxes = [
    { v: d, u: t('training.unitDays') },
    { v: h, u: t('training.unitHours') },
    { v: m, u: t('training.unitMin') },
    { v: s, u: t('training.unitSec') },
  ]

  return (
    <div className={styles.countdownCard}>
      {sessionNo && (
        <div className={styles.sessionTag}>{t('training.sessionTag', { no: sessionNo })}</div>
      )}
      <div className={`${styles.countdownLabel} ${live ? styles.countdownLabelLive : ''}`}>
        {t('training.personaCountdown')}
      </div>
      <div className={styles.countdownBoxes}>
        {boxes.map((b, i) => (
          <div key={b.u} className={styles.cdItem}>
            <div className={`${styles.cdBox} ${live ? styles.cdBoxLive : ''}`}>
              <div className={styles.cdValue}>{pad(b.v)}</div>
              <div className={styles.cdUnit}>{b.u}</div>
            </div>
            {i < boxes.length - 1 && <span className={styles.cdSep}>:</span>}
          </div>
        ))}
      </div>
      <div className={styles.countdownMeta}>{t('training.startsAt', { date: fmtStart(startAt) })}</div>
    </div>
  )
}
