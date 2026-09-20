import { useLanguage } from '../../../i18n/context'
import { TRAINING_STATES_LIST } from '../models/states'
import { EVENT_TYPES } from '../../event'
import styles from '../training.module.css'

// Timeline del evento (BUILD-TC-003 + TC-004): renderiza los `steps` del
// EventDirector activo (Training Camp o Fixture Generation) con el paso
// actual/último completado como fuente de verdad. No conoce directores: solo
// steps + currentStep/lastCompletedStep + eventType para personalidades.
const STEP_LABEL_KEYS = {
  created: 'stateCreated',
  waiting_players: 'stateWaitingPlayers',
  countdown: 'stateCountdown',
  training_started: 'stateTrainingStarted',
  picks_open: 'statePicksOpen',
  picks_locked: 'statePicksLocked',
  games_in_progress: 'stateGamesInProgress',
  simulation_running: 'stateSimulationRunning',
  finished: 'stateFinished',
  waiting: 'fixtureStepWaiting',
  generating_fixtures: 'fixtureStepGenerating',
  saving_matches: 'fixtureStepSaving',
  completed: 'fixtureStepCompleted',
}

export default function TrainingCampStatus({ state, phase, steps, currentStep, lastCompletedStep, eventType }) {
  const { t } = useLanguage()

  const isFixture = eventType === EVENT_TYPES.FIXTURE_GENERATION
  const timeline = steps?.length ? steps : TRAINING_STATES_LIST

  const cancelled = phase === 'cancelled'

  // Paso activo provisto por el director (fuente de verdad del ciclo).
  const currentIdx = currentStep?.index != null
    ? currentStep.index
    : TRAINING_STATES_LIST.findIndex(s => s.id === state)

  const finished = phase === 'finished' || phase === 'completed'

  const currentText = isFixture
    ? ({
        waiting: t('training.personaFixtureWaiting'),
        generating_fixtures: t('training.personaFixtureGenerating'),
        saving_matches: t('training.personaFixtureSaving'),
        completed: t('training.personaFixtureCompleted'),
        cancelled: t('training.personaCancelled'),
      })[phase] || t('training.statusUnknown')
    : ({
        created: t('training.personaCreated'),
        waiting: t('training.personaWaiting'),
        countdown: t('training.personaCountdown'),
        ready: t('training.personaReady'),
        cancelled: t('training.personaCancelled'),
        finished: t('training.personaFinished'),
      })[phase] || t('training.statusUnknown')

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{t('training.statusLabel')}</div>
      <div className={styles.status}>
        <div className={styles.statusGrid}>
          {timeline.map((s, i) => {
            const cls = [styles.step]
            if (cancelled) cls.push(styles.stepDone)
            else if (finished) cls.push(i < timeline.length - 1 ? styles.stepDone : styles.stepCurrent)
            else if (i < currentIdx) cls.push(styles.stepDone)
            else if (i === currentIdx) cls.push(styles.stepCurrent)
            return (
              <div key={s.id} className={cls.join(' ')}>
                <span className={styles.stepIcon}>{s.icon}</span>
                <span className={styles.stepLabel}>{t(`training.${STEP_LABEL_KEYS[s.id] || 'statusUnknown'}`)}</span>
              </div>
            )
          })}
        </div>
        <div className={styles.statusCurrentLine}>
          <span>{cancelled ? '✕' : finished ? (isFixture ? '✅' : '🏆') : '▶'}</span>
          <em>{currentText}</em>
        </div>
      </div>
    </div>
  )
}
