// ════════════════════════════════════════════════════════════════════
// SimulationProgress — progreso en vivo de la corrida (BUILD-TC-006.3)
//
// Se muestra mientras la Game Week está en `games_in_progress` /
// `simulation_running`: NO hay edición de picks durante la simulación.
// Consume SOLO la proyección pura `simRun` (estado + completed/total + %)
// derivada de `game_weeks.simulation_progress`; no toca el motor.
// ════════════════════════════════════════════════════════════════════

import { useLanguage } from '../../i18n/context'
import { useGameWeek } from './GameWeekContext'
import styles from './game-week.module.css'

const STATUS_KEYS = {
  waiting: 'gameWeek.statusWaiting',
  simulating: 'gameWeek.statusSimulating',
  persisting_results: 'gameWeek.statusPersisting',
  updating_standings: 'gameWeek.statusUpdating',
  completed: 'gameWeek.simulationCompleted',
}

export default function SimulationProgress() {
  const { t } = useLanguage()
  const { simRun } = useGameWeek()

  const statusKey = STATUS_KEYS[simRun.state] || STATUS_KEYS.waiting

  return (
    <div className={`${styles.centerState} ${styles.simCard}`}>
      <div className={styles.simTitle}>{t('gameWeek.simulationProgress')}</div>
      <div className={styles.simStatus}>{t(statusKey)}</div>
      <div className={styles.simCounter}>
        {t('gameWeek.gamesCompleted', { completed: simRun.completed, total: simRun.total })}
      </div>
      <div className={styles.simBarTrack}>
        <div className={styles.simBarFill} style={{ width: `${Math.max(0, Math.min(100, simRun.percent))}%` }} />
      </div>
      <div className={styles.simPercent}>{simRun.percent}%</div>
      <div className={styles.simDesc}>{t('gameWeek.simLockedNote')}</div>
    </div>
  )
}
