import { useLanguage } from '../../../i18n/context'
import styles from '../dashboard.module.css'

export default function PendingActionCard({ pendingCount, locked, onNavigate }) {
  const { t } = useLanguage()
  const done = pendingCount === 0

  return (
    <div className={`${styles.actionCard} ${done ? styles.actionDone : ''}`}>
      <span className={styles.actionIcon}>{done ? '🎉' : '🏈'}</span>
      <div className={styles.actionBody}>
        <div className={styles.actionTitle}>
          {done
            ? t('dashboard.pendingDone')
            : t('dashboard.pendingTitle', { n: pendingCount })}
        </div>
        <div className={styles.actionDesc}>
          {locked ? t('dashboard.pendingLocked') : t('dashboard.pendingDesc')}
        </div>
      </div>
      {!done && !locked && (
        <button className={styles.actionBtn} onClick={() => onNavigate('picks')}>
          {t('dashboard.pendingBtn')}
        </button>
      )}
    </div>
  )
}
