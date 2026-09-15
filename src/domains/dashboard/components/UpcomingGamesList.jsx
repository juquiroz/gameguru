import TeamLogo from '../../../components/TeamLogo'
import GameTime from '../../../components/GameTime'
import { useLanguage } from '../../../i18n/context'
import styles from '../dashboard.module.css'

export default function UpcomingGamesList({ games, timeZone }) {
  const { t } = useLanguage()

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{t('dashboard.upcoming')}</div>
      {games.length === 0 ? (
        <div className={styles.boardEmpty}>{t('dashboard.noUpcoming')}</div>
      ) : (
        <div className={styles.upcoming}>
          {games.map(g => (
            <div key={g.id} className={styles.upcomingRow}>
              <div className={styles.upcomingMatchup}>
                <TeamLogo abbr={g.away_abbr} size={20} />
                <span>{g.away_abbr}</span>
                <span className={styles.gameVs}>@</span>
                <TeamLogo abbr={g.home_abbr} size={20} />
                <span>{g.home_abbr}</span>
              </div>
              <div className={styles.upcomingTime}>
                <GameTime when={g.game_time} timeZone={timeZone} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
