import TeamLogo from './TeamLogo'
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
        <button
          className={`${styles.teamBtn} ${teamClass(game.aA)}`}
          onClick={() => !locked && onPick(game.id, game.aA)}
          disabled={locked}
        >
          <TeamLogo abbr={game.aA} className={styles.emoji} size={28} />
          <span className={styles.abbr}>{game.aA}</span>
          <span className={styles.name}>{game.away.split(' ').slice(-1)[0]}</span>
        </button>

        <span className={styles.vs}>@</span>

        <button
          className={`${styles.teamBtn} ${teamClass(game.hA)}`}
          onClick={() => !locked && onPick(game.id, game.hA)}
          disabled={locked}
        >
          <TeamLogo abbr={game.hA} className={styles.emoji} size={28} />
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
