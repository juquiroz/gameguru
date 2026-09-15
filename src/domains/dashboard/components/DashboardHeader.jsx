import { useLanguage } from '../../../i18n/context'
import styles from '../dashboard.module.css'

export default function DashboardHeader({ profile, currentWeek, leagueCount, user, badge, sub }) {
  const { t } = useLanguage()
  const name = profile?.username || user?.email?.split('@')[0] || ''

  return (
    <div className={styles.header}>
      <div className={styles.greeting}>
        {t('dashboard.greeting', { name })}
      </div>
      <div className={styles.greetingSub}>
        {sub ?? <span>{t('dashboard.leagueCount', { n: leagueCount })}</span>}
        {badge ?? (currentWeek != null && (
          <span className={styles.weekBadge}>{t('dashboard.week', { week: currentWeek })}</span>
        ))}
      </div>
    </div>
  )
}
