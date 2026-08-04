import { useState } from 'react'
import { useLanguage } from '../i18n/context'
import TeamLogo from './TeamLogo'
import styles from './ScoreEditor.module.css'

export default function ScoreEditor({
  away = {},
  home = {},
  initialAwayScore,
  initialHomeScore,
  saving = false,
  onSave,
  onCancel,
}) {
  const { t } = useLanguage()
  const [awayScore, setAwayScore] = useState(initialAwayScore ?? '')
  const [homeScore, setHomeScore] = useState(initialHomeScore ?? '')

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave?.(awayScore.trim(), homeScore.trim())
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel?.()
    }
  }

  return (
    <div className={styles.editor}>
      <div className={styles.teams}>
        <div className={styles.team}>
          <span className={styles.side}>{t('manager.away')}</span>
          <span className={styles.identity}>
            <TeamLogo abbr={away.abbr} size={28} />
            <span className={styles.abbr}>{away.abbr}</span>
          </span>
          <input
            type="number"
            min="0"
            max="99"
            inputMode="numeric"
            className={styles.input}
            value={awayScore}
            onChange={e => setAwayScore(e.target.value)}
            placeholder="0"
            aria-label={t('manager.away')}
            autoFocus
            onKeyDown={handleKeyDown}
          />
        </div>

        <span className={styles.vs}>@</span>

        <div className={styles.team}>
          <span className={styles.side}>{t('manager.home')}</span>
          <span className={styles.identity}>
            <TeamLogo abbr={home.abbr} size={28} />
            <span className={styles.abbr}>{home.abbr}</span>
          </span>
          <input
            type="number"
            min="0"
            max="99"
            inputMode="numeric"
            className={styles.input}
            value={homeScore}
            onChange={e => setHomeScore(e.target.value)}
            placeholder="0"
            aria-label={t('manager.home')}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.save} onClick={() => onSave?.(awayScore.trim(), homeScore.trim())} disabled={saving}>
          {saving ? '...' : t('manager.save')}
        </button>
        <button className={styles.cancel} onClick={onCancel} disabled={saving}>
          {t('manager.cancel')}
        </button>
      </div>
    </div>
  )
}
