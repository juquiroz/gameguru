// ════════════════════════════════════════════════════════════════════
// GameWeekLeaderboard — tabla de posiciones por usuario (BUILD-TC-006.3)
//
// Proyección pura `standings` (buildLeaderboard): rank 1..N, ordenado por
// points desc → correct desc → total asc → username asc (desempate
// determinista), sin pick → 0. El jugador actual se resalta. PRIVACY-001:
// aquí solo se muestran agregados (correct/total/points); los picks
// individuales de OTROS usuarios nunca se revelan en esta tabla.
// ════════════════════════════════════════════════════════════════════

import { useLanguage } from '../../i18n/context'
import { useGameWeek } from './GameWeekContext'
import styles from './game-week.module.css'

export default function GameWeekLeaderboard() {
  const { t } = useLanguage()
  const { standings, myUserId } = useGameWeek()

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>{t('gameWeek.leaderboard')}</div>
      </div>

      {standings.length === 0 ? (
        <div className={styles.noGames}>{t('gameWeek.noPicks')}</div>
      ) : (
        <div className={styles.board}>
          <div className={`${styles.boardRow} ${styles.boardHead}`}>
            <span className={styles.boardRank}>{t('gameWeek.rank')}</span>
            <span className={styles.boardName}>{t('gameWeek.player')}</span>
            <span className={styles.boardNum}>{t('gameWeek.correctPicks')}</span>
            <span className={styles.boardNum}>{t('gameWeek.totalPicks')}</span>
            <span className={styles.boardNum}>{t('gameWeek.points')}</span>
          </div>
          {standings.map(row => (
            <div
              key={row.userId}
              className={`${styles.boardRow} ${row.userId === myUserId ? styles.boardMe : ''}`}
            >
              <span className={styles.boardRank}>{row.rank}</span>
              <span className={styles.boardName}>{row.username}</span>
              <span className={styles.boardNum}>{row.correct}</span>
              <span className={styles.boardNum}>{row.total}</span>
              <span className={`${styles.boardNum} ${styles.boardPoints}`}>{row.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
