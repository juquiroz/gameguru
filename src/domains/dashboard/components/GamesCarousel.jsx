import TeamLogo from '../../../components/TeamLogo'
import GameTime from '../../../components/GameTime'
import { useLanguage } from '../../../i18n/context'
import styles from '../dashboard.module.css'

export default function GamesCarousel({ title, games, locked }) {
  const { t } = useLanguage()

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {games.length === 0 ? (
        <div className={styles.carouselEmpty}>{t('dashboard.noGamesToday')}</div>
      ) : (
        <div className={styles.carousel}>
          {games.map(g => (
            <div key={g.id} className={styles.gameCard}>
              <div className={styles.gameTeams}>
                <div className={styles.gameTeam}>
                  <TeamLogo abbr={g.away_abbr} size={26} />
                  <span className={styles.gameTeamAbbr}>{g.away_abbr}</span>
                </div>
                <span className={styles.gameVs}>@</span>
                <div className={`${styles.gameTeam} ${styles.gameTeamRight}`}>
                  <span className={styles.gameTeamAbbr}>{g.home_abbr}</span>
                  <TeamLogo abbr={g.home_abbr} size={26} />
                </div>
              </div>
              <div className={styles.gameMeta}>
                <span className={styles.gameTime}>
                  <GameTime when={g.game_time} />
                </span>
                {g.finished ? (
                  <span className={`${styles.statusTag} ${styles.statusFinal}`}>
                    {t('picks.final')}
                  </span>
                ) : locked ? (
                  <span className={`${styles.statusTag} ${styles.statusLocked}`}>
                    {t('dashboard.gameLocked')}
                  </span>
                ) : (
                  <span className={`${styles.statusTag} ${styles.statusOpen}`}>
                    {t('dashboard.gameOpen')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
