import { useLanguage } from '../../../i18n/context'
import { LEAGUE_MODES_LIST } from '../../league/models/modes'
import styles from '../experience.module.css'

const EXP_KEY = {
  practice: { name: 'wizard.expPractice', desc: 'wizard.expPracticeDesc', chip: 'wizard.expPracticeChip' },
  preseason: { name: 'wizard.expPreseason', desc: 'wizard.expPreseasonDesc', chip: 'wizard.expPreseasonChip' },
  regular: { name: 'wizard.expRegular', desc: 'wizard.expRegularDesc', chip: 'wizard.expRegularChip' },
}

const EXP_ACCENT = {
  practice: 'var(--mode-tc, #3B82F6)',
  preseason: 'var(--mode-ps, #14B8A6)',
  regular: 'var(--mode-rs, #F5A623)',
}

// Paso 1 del wizard: elegir la experiencia. Training Camp abre la intro
// educativa; Preseason/Regular van directo a la configuración de la liga.
export default function ExperiencePicker({ onSelect }) {
  const { t } = useLanguage()

  return (
    <div className={styles.pickerGrid}>
      {LEAGUE_MODES_LIST.map(mode => {
        const k = EXP_KEY[mode.id]
        return (
          <button
            key={mode.id}
            className={styles.expCard}
            style={{ '--card-accent': EXP_ACCENT[mode.id] }}
            onClick={() => onSelect(mode.id)}
          >
            <span className={styles.expIcon}>{mode.icon}</span>
            <span className={styles.expName}>{t(k.name)}</span>
            <span className={styles.expDesc}>{t(k.desc)}</span>
            <span className={styles.expChip}>{t(k.chip)}</span>
            <span className={styles.expArrow}>→</span>
          </button>
        )
      })}
    </div>
  )
}
