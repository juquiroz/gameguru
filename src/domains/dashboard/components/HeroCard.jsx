import { useLanguage } from '../../../i18n/context'
import styles from '../dashboard.module.css'

export default function HeroCard({ onCreateNew, onJoinClick }) {
  const { t } = useLanguage()

  return (
    <div className={styles.heroCard}>
      <div className={styles.heroCardTitle}>{t('home.newUserTitle')}</div>
      <p className={styles.heroCardDesc}>{t('home.newUserDesc')}</p>
      <div className={styles.heroCardActions}>
        <button className="btn-primary" onClick={onCreateNew}>
          {t('home.createFirst')}
        </button>
        <button className="btn-secondary" onClick={onJoinClick}>
          {t('home.joinFirst')}
        </button>
      </div>
    </div>
  )
}
