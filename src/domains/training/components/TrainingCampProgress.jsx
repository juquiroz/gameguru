import { useLanguage } from '../../../i18n/context'
import styles from '../training.module.css'

// Progreso del evento Fixture Generation (BUILD-TC-004): muestra el paso
// activo (persona del director) y la barra generado→guardado de
// `fixture_progress`. Reemplaza al countdown del Training Camp porque este
// evento no tiene hora de inicio: se ejecuta al finalizar la sesión.
export default function TrainingCampProgress({ phase, fixtureProgress, currentStep }) {
  const { t } = useLanguage()
  const { generated = 0, saved = 0, total = 0 } = fixtureProgress || {}

  const pct = total > 0 ? Math.round((saved / total) * 100) : 0

  const persona = {
    waiting: t('training.personaFixtureWaiting'),
    generating_fixtures: t('training.personaFixtureGenerating'),
    saving_matches: t('training.personaFixtureSaving'),
    completed: t('training.personaFixtureCompleted'),
    cancelled: t('training.personaCancelled'),
  }[phase] || t('training.statusUnknown')

  const saving = phase === 'saving_matches' || phase === 'completed'

  return (
    <div className={styles.countdownCard}>
      <div className={styles.countdownLabel}>{t('training.fixtureLabel')}</div>
      <div className={styles.progressPersona}>{persona}</div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.progressMeta}>
        {saving
          ? t('training.fixtureProgressSaved', { generated, saved, total })
          : t('training.fixtureProgressGenerated', { generated, total })}
      </div>
    </div>
  )
}
