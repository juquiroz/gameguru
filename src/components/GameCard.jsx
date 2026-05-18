import { teamLogo } from '../data/nflData'
import styles from './GameCard.module.css'

export default function GameCard({ game, pick, onPick, results, locked }) {
  const result = results?.[game.id]

  const teamClass = (abbr) => {
    if (!result) return pick === abbr ? styles.selected : ''
    if (pick === abbr) return result === abbr ? styles.correct : styles.wrong
    return ''
  }

  const indicatorClass = () => {
    if (result && pick) return result === pick ? styles.correct : styles.wrong
    if (pick) return styles.hasPick
    return ''
  }

  const indicatorText = () => {
    if (result && pick) return result === pick ? '✓ CORRECTO' : '✗ FALLIDO'
    if (pick) return `✓ ${pick}`
    return locked ? '—' : 'SIN SELECCIÓN'
  }

  return (
    <div className={`${styles.card} ${locked ? styles.locked : ''}`}>
      <div className={styles.time}>{game.time}</div>

      <div className={styles.teamsRow}>
        {/* Away team */}
        <button
          className={`${styles.teamBtn} ${teamClass(game.aA)}`}
          onClick={() => !locked && onPick(game.id, game.aA)}
          disabled={locked}
        >
          <span className={styles.emoji}>{teamLogo(game.aA)}</span>
          <span className={styles.abbr}>{game.aA}</span>
          <span className={styles.name}>{game.away.split(' ').slice(-1)[0]}</span>
        </button>

        <span className={styles.vs}>@</span>

        {/* Home team */}
        <button
          className={`${styles.teamBtn} ${teamClass(game.hA)}`}
          onClick={() => !locked && onPick(game.id, game.hA)}
          disabled={locked}
        >
          <span className={styles.emoji}>{teamLogo(game.hA)}</span>
          <span className={styles.abbr}>{game.hA}</span>
          <span className={styles.name}>{game.home.split(' ').slice(-1)[0]}</span>
        </button>
      </div>

      <div className={`${styles.indicator} ${indicatorClass()}`}>
        {indicatorText()}
      </div>
    </div>
  )
}
