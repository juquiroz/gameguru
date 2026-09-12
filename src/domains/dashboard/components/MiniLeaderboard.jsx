import { useLanguage } from '../../../i18n/context'
import styles from '../dashboard.module.css'

const MEDALS = ['🥇', '🥈', '🥉']

export default function MiniLeaderboard({ standings, currentUserId, onNavigate, week }) {
  const { t } = useLanguage()
  const top = standings.slice(0, 3)

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        {week != null ? t('dashboard.top3Week', { week }) : t('dashboard.top3')}
      </div>
      <div className={styles.miniBoard}>
        {top.length === 0 ? (
          <div className={styles.boardEmpty}>{t('dashboard.boardEmpty')}</div>
        ) : (
          top.map((r, i) => (
            <div key={r.userId} className={`${styles.boardRow} ${r.userId === currentUserId ? styles.me : ''}`}>
              <span className={styles.medal}>{MEDALS[i]}</span>
              <span className={styles.boardName}>{r.username}</span>
              <span className={styles.boardScore}>{r.correct}/{r.total}</span>
            </div>
          ))
        )}
      </div>
      <button className="btn-ghost" style={{ width: '100%', marginTop: '.6rem' }} onClick={() => onNavigate('board')}>
        {t('dashboard.seeBoard')}
      </button>
    </div>
  )
}
