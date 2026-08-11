// ════════════════════════════════════════════════════════════════════
// GameWeekResults — resultados de la jornada (BUILD-TC-006.3)
//
// Se muestra cuando la jornada quedó `completed`/`finished`. Renderiza las
// filas RAW de `league_games` (scores, result, finished) SIN recalcularlas:
// GameCard lee home_score/away_score/result tal cual están persistidos.
// El feedback ✓/✗ es solo de la planilla del usuario actual (picks propios);
// el leaderboard agregado por usuario lo provee GameWeekLeaderboard.
// ════════════════════════════════════════════════════════════════════

import { useLanguage } from '../../i18n/context'
import { useGameWeek } from './GameWeekContext'
import { buildResultsView } from './simulationView'
import GameCard from '../../components/GameCard'
import styles from './game-week.module.css'

export default function GameWeekResults() {
  const { t } = useLanguage()
  const { requiredGames, resultsMap, picks, standings, myUserId } = useGameWeek()

  const rows = buildResultsView(requiredGames)
  const me = standings.find(s => s.userId === myUserId)

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>{t('gameWeek.results')}</div>
        <div className={styles.counter}>
          {me
            ? t('gameWeek.myResult', { correct: me.correct, total: me.total, points: me.points })
            : t('gameWeek.noPicks')}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.noGames}>{t('gameWeek.noGames')}</div>
      ) : (
        <div className={styles.grid}>
          {requiredGames.map(g => (
            <div key={g.id} className={styles.resultWrap}>
              <GameCard game={g} pick={picks[g.id]} results={resultsMap} locked />
              {!!g.finished && g.result == null && (
                <span className={styles.drawTag}>{t('gameWeek.draw')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
