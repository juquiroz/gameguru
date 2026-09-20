import { useLanguage } from '../../../i18n/context'
import styles from '../experience.module.css'

// Pantalla introductoria del Training Camp (paso 2 del wizard).
// Vende la experiencia guiada antes de pedir configuración: qué aprenderás,
// duración, simulación y recompensa. Cierra con el embudo TC → Preseason → Regular.
export default function TrainingCampIntro({ onBack, onContinue }) {
  const { t } = useLanguage()

  return (
    <div>
      <div className={styles.introHero}>
        <span className={styles.introEyebrow}>🎓 {t('wizard.introEyebrow')}</span>
        <div className={styles.introTitle}>{t('wizard.introTitle')}</div>
        <p className={styles.introLead}>{t('wizard.introLead')}</p>
      </div>

      <div className={styles.introBlock}>
        <div className={styles.introBlockTitle}>📚 {t('wizard.introLearn')}</div>
        <ul className={styles.introList}>
          <li>{t('wizard.introLearn1')}</li>
          <li>{t('wizard.introLearn2')}</li>
          <li>{t('wizard.introLearn3')}</li>
        </ul>
      </div>

      <div className={styles.introBlock}>
        <div className={styles.introBlockTitle}>⏱️ {t('wizard.introDuration')}</div>
        <p className={styles.introBlockText}>{t('wizard.introDurationText')}</p>
      </div>

      <div className={styles.introBlock}>
        <div className={styles.introBlockTitle}>⚙️ {t('wizard.introSim')}</div>
        <p className={styles.introBlockText}>{t('wizard.introSimText')}</p>
      </div>

      <div className={styles.introBlock}>
        <div className={styles.introBlockTitle}>🏆 {t('wizard.introReward')}</div>
        <p className={styles.introBlockText}>{t('wizard.introRewardText')}</p>
      </div>

      <div className={styles.introJourney}>
        <div className={styles.introJourneyTitle}>{t('wizard.introJourney')}</div>
        <div className={styles.introJourneyPath}>
          <span className={styles.journeyStep}>🎓</span><span className={styles.journeyArrow}>→</span>
          <span className={styles.journeyStep}>🏈</span><span className={styles.journeyArrow}>→</span>
          <span className={styles.journeyStep}>🏆</span>
        </div>
        <p className={styles.introBlockText}>{t('wizard.introJourneyText')}</p>
      </div>

      <div className={styles.introActions}>
        <button className={styles.btnGhost} onClick={onBack}>{t('wizard.back')}</button>
        <button className={styles.btnPrimaryTc} onClick={onContinue}>{t('wizard.introCta')}</button>
      </div>
    </div>
  )
}
