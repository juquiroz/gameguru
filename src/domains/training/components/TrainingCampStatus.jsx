import { useLanguage } from '../../../i18n/context'
import { TRAINING_STATES_LIST } from '../models/states'
import styles from '../training.module.css'

// Timeline de las 9 etapas del evento (PLAN-005). BUILD-TC-003 la alimenta con
// el paso actual/último completado del EventDirector; en BUILD-TC-001 solo los
// tres primeros eran alcanzables y el resto se mostraba atenuado.
export default function TrainingCampStatus({ state, phase, steps, currentStep, lastCompletedStep }) {
  const { t } = useLanguage()

  const stepKey = {
    created: 'stateCreated',
    waiting_players: 'stateWaitingPlayers',
    countdown: 'stateCountdown',
    training_started: 'stateTrainingStarted',
    picks_open: 'statePicksOpen',
    picks_locked: 'statePicksLocked',
    games_in_progress: 'stateGamesInProgress',
    simulation_running: 'stateSimulationRunning',
    finished: 'stateFinished',
  }

  const cancelled = phase === 'cancelled'

  // Paso activo provisto por el director (fuente de verdad del ciclo).
  const currentIdx = currentStep?.index != null
    ? currentStep.index
    : TRAINING_STATES_LIST.findIndex(s => s.id === state)

  const finished = phase === 'finished'

  const currentText = {
    created: t('training.personaCreated'),
    waiting: t('training.personaWaiting'),
    countdown: t('training.personaCountdown'),
    ready: t('training.personaReady'),
    cancelled: t('training.personaCancelled'),
    finished: t('training.personaFinished'),
  }[phase] || t('training.statusUnknown')

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{t('training.statusLabel')}</div>
      <div className={styles.status}>
        <div className={styles.statusGrid}>
          {TRAINING_STATES_LIST.map((s, i) => {
            const cls = [styles.step]
            if (cancelled) cls.push(styles.stepDone)
            else if (finished) cls.push(i < TRAINING_STATES_LIST.length - 1 ? styles.stepDone : styles.stepCurrent)
            else if (i < currentIdx) cls.push(styles.stepDone)
            else if (i === currentIdx) cls.push(styles.stepCurrent)
            return (
              <div key={s.id} className={cls.join(' ')}>
                <span className={styles.stepIcon}>{s.icon}</span>
                <span className={styles.stepLabel}>{t(`training.${stepKey[s.id]}`)}</span>
              </div>
            )
          })}
        </div>
        <div className={styles.statusCurrentLine}>
          <span>{cancelled ? '✕' : finished ? '🏆' : '▶'}</span>
          <em>{currentText}</em>
        </div>
      </div>
    </div>
  )
}
