import GameCard from '../../../components/GameCard'
import { getLeagueTimezone } from '../../league/models/timezone'
import styles from '../training-camp.module.css'

// BUILD-TC-V2-AUTO: en el campamento automático los picks se confirman POR
// JUEGO (no hay planilla semanal): cada juego cierra solo 10 min antes de su
// tip-off y el pick se guarda/confirma en el momento de elegirlo.
export default function TrainingCampPicksBoard({
  league, session, week, games, picks, submitted, picksLocked, deadline,
  busy, onPick, onConfirm, auto = false, gameLocks = null, deadlineMinutes = 10,
}) {
  const cards = (games || []).map(g => ({
    id: g.game_id || g.id,
    time: g.game_time,
    aA: g.away_abbr,
    hA: g.home_abbr,
    away: g.away_team || g.away || g.away_abbr,
    home: g.home_team || g.home || g.home_abbr,
    away_score: g.away_score,
    home_score: g.home_score,
    active: g.active,
    finished: g.finished,
  }))
  const active = cards.filter(c => c.active !== false)
  const done = active.filter(c => picks[c.id]?.pick).length
  const complete = done === active.length
  const lockedCount = auto ? active.filter(c => gameLocks?.[c.id]).length : (picksLocked ? active.length : 0)

  const lockedFor = (c) =>
    auto ? !!gameLocks?.[c.id] || c.finished : picksLocked

  const deadlineLabel = () => {
    if (!active.length) return null
    if (!deadline) return `cada juego cierra ${deadlineMinutes} min antes de su inicio`
    return `Cierra ${new Date(deadline).toLocaleString()}`
  }

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Semana {week} · Tus picks</div>

        <div className={styles.row} style={{ justifyContent: 'space-between', marginBottom: '.75rem' }}>
          <span style={{ fontSize: '.82rem', color: 'var(--text2)' }}>
            {done}/{active.length} seleccionados
            {auto && lockedCount > 0 && ` · ${lockedCount} cerrados`}
          </span>
          {picksLocked && <span className={`${styles.badge} ${styles.badgeLocked}`}>Picks cerrados</span>}
          {!picksLocked && deadlineLabel && (
            <span className={`${styles.badge} ${styles.badgeOpen}`}>{deadlineLabel()}</span>
          )}
        </div>

        {auto ? (
          <div className={`${styles.note} ${styles.noteInfo}`} style={{ marginBottom: '.75rem' }}>
            Cada pick se confirma en el momento. Un juego queda cerrado {deadlineMinutes} min antes de su inicio y no se puede cambiar.
          </div>
        ) : (
          !picksLocked && submitted && (
            <div className={`${styles.note} ${styles.noteOk}`}>Planilla confirmada ✓</div>
          )
        )}

        {active.length === 0 ? (
          <div className={styles.empty}>Todavía no hay juegos en esta semana.</div>
        ) : (
          <div className={styles.grid}>
            {active.map(c => (
              <GameCard
                key={c.id}
                game={c}
                pick={picks[c.id]?.pick}
                onPick={onPick}
                results={null}
                locked={lockedFor(c)}
                timeZone={getLeagueTimezone(league)}
              />
            ))}
          </div>
        )}
      </div>

      {!auto && !picksLocked && active.length > 0 && (
        <button
          className={styles.btnPrimary}
          disabled={!complete || busy}
          onClick={onConfirm}
          style={{ width: '100%' }}
        >
          {!complete
            ? 'Completa todos los picks para confirmar'
            : (submitted ? 'Confirmar nuevamente' : 'Confirmar planilla')}
        </button>
      )}
    </div>
  )
}
