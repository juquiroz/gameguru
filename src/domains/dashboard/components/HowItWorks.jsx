import { useLanguage } from '../../../i18n/context'
import styles from '../dashboard.module.css'

export default function HowItWorks() {
  const { t } = useLanguage()

  const items = [
    { icon: '🏆', title: t('home.featureCreate'), desc: t('home.featureCreateDesc') },
    { icon: '📨', title: t('home.featureInvite'), desc: t('home.featureInviteDesc') },
    { icon: '🏅', title: t('home.featureWin'), desc: t('home.featureWinDesc') },
  ]

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{t('dashboard.howItWorks')}</div>
      <div className={styles.features}>
        {items.map(it => (
          <div key={it.title} className={styles.feature}>
            <span className={styles.featureIcon}>{it.icon}</span>
            <span className={styles.featureTitle}>{it.title}</span>
            <span className={styles.featureDesc}>{it.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
