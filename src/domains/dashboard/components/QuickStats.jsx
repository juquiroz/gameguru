import { useLanguage } from '../../../i18n/context'
import styles from '../dashboard.module.css'

export default function QuickStats({ position, correctCount, pendingCount, streak }) {
  const { t } = useLanguage()

  const items = [
    {
      label: t('dashboard.statPosition'),
      value: position ? `#${position}` : '—',
      sub: t('dashboard.statPositionSub'),
    },
    {
      label: t('dashboard.statCorrect'),
      value: correctCount,
      sub: t('dashboard.statCorrectSub'),
    },
    {
      label: t('dashboard.statPending'),
      value: pendingCount,
      sub: t('dashboard.statPendingSub'),
    },
    {
      label: t('dashboard.statStreak'),
      value: streak,
      sub: t('dashboard.statStreakSub'),
    },
  ]

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{t('dashboard.statsTitle')}</div>
      <div className={styles.statsGrid}>
        {items.map(it => (
          <div key={it.label} className={styles.statCard}>
            <div className={styles.statLabel}>{it.label}</div>
            <div className={styles.statVal}>{it.value}</div>
            <div className={styles.statSub}>{it.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
