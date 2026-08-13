import { SPORTS } from '../../../data/nflData'
import { useLanguage } from '../../../i18n/context'
import { getLeagueMode } from '../../league/models/modes'
import styles from '../dashboard.module.css'

export default function LeaguesSummary({ myLeagues, currentLeague, memberCounts, user, onEnterLeague, onDeleteLeague }) {
  const { t } = useLanguage()
  if (!myLeagues?.length) return null

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{t('dashboard.myLeagues')}</div>
      <div className={styles.leagueMini}>
        {myLeagues.map(lg => {
          const isCurrent = currentLeague?.id === lg.id
          const sportIcon = SPORTS.find(s => s.id === lg.sport)?.icon || '🏆'
          const members = memberCounts[lg.id]
          const canDelete = onDeleteLeague &&
            !isCurrent &&
            (lg.role === 'admin' || lg.admin_id === user?.id)

          return (
            <div
              key={lg.id}
              className={`${styles.leagueMiniCard} ${isCurrent ? styles.current : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => { if (!isCurrent) onEnterLeague(lg) }}
              onKeyDown={e => e.key === 'Enter' && !isCurrent && onEnterLeague(lg)}
            >
              <span className={styles.leagueMiniIcon}>{sportIcon}</span>
              <div className={styles.leagueMiniInfo}>
                <div className={styles.leagueMiniName}>{lg.name}</div>
                <div className={styles.leagueMiniMeta}>
                  {lg.sport} · {lg.code}
                  {members != null ? ` · ${t('dashboard.members', { n: members })}` : ''}
                </div>
              </div>
              <div className={styles.leagueMiniBadges}>
                {getLeagueMode(lg) === 'practice' && (
                  <span className={`${styles.miniBadge} ${styles.miniBadgeTc}`}>{t('training.name')}</span>
                )}
                {lg.simulation && (
                  <span className={`${styles.miniBadge} ${styles.miniBadgeAdmin}`}>{t('dashboard.sim')}</span>
                )}
                {lg.role === 'admin' && (
                  <span className={`${styles.miniBadge} ${styles.miniBadgeAdmin}`}>{t('dashboard.admin')}</span>
                )}
                {isCurrent && (
                  <span className={`${styles.miniBadge} ${styles.miniBadgeCurrent}`}>{t('dashboard.current')}</span>
                )}
                {canDelete && (
                  <button
                    className={styles.leagueMiniDelete}
                    onClick={e => onDeleteLeague(e, lg)}
                    title={t('league.delete')}
                  >✕</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
