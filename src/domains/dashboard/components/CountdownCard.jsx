import { useEffect, useState } from 'react'
import { useLanguage } from '../../../i18n/context'
import styles from '../dashboard.module.css'

function useNow(interval = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), interval)
    return () => clearInterval(id)
  }, [interval])
  return now
}

const fmtLeft = (ms) => {
  if (ms <= 0) return '0 h 00 min'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h} h ${String(m).padStart(2, '0')} min`
}

const fmtDeadline = (d) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)

export default function CountdownCard({ deadline, locked }) {
  const { t } = useLanguage()
  const now = useNow()

  if (!deadline) return null

  const remaining = new Date(deadline) - now
  const closed = locked || remaining <= 0

  return (
    <div className={styles.countdown}>
      <span className={styles.countdownIcon}>{closed ? '🔒' : '⏳'}</span>
      <div className={styles.countdownBody}>
        <div className={styles.countdownTitle}>{t('dashboard.countdownTitle')}</div>
        <div className={`${styles.countdownValue} ${closed ? styles.countdownValueLocked : ''}`}>
          {closed ? t('dashboard.countdownLocked') : t('dashboard.countdownLeft', { time: fmtLeft(remaining) })}
        </div>
        <div className={styles.countdownMeta}>{fmtDeadline(deadline)}</div>
      </div>
    </div>
  )
}
