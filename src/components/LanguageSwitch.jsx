import { useLanguage } from '../i18n/context'
import styles from './LanguageSwitch.module.css'

export default function LanguageSwitch() {
  const { lang, toggleLang } = useLanguage()

  return (
    <button
      className={styles.switch}
      onClick={toggleLang}
      title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
    >
      <span className={`${styles.opt} ${lang === 'es' ? styles.active : ''}`}>ES</span>
      <span className={styles.divider}>|</span>
      <span className={`${styles.opt} ${lang === 'en' ? styles.active : ''}`}>EN</span>
    </button>
  )
}
