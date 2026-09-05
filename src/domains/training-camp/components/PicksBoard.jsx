import GameCard from '../../../components/GameCard'
import { getLeagueTimezone } from '../../league/models/timezone'
import styles from '../training-camp.module.css'

export default function TrainingCampPicksBoard({
  league, session, week, games, picks, submitted, picksLocked, deadline,
  busy, onPick, onConfirm,
}) {
  const cards = (games || []).map(g => ({
    id: g.game_id || g.id,
    time: g.game_time,
    aA: g.away_abbr,
    hA: g.home_abbr,
    active: g.active,
    finished: g.finished,
  }))
  const active = cards.filter(c => c.active !== false)
  const done = active.filter(c => picks[c.id]?.pick).length
  const complete = done === active.length

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Semana {week} · Tus picks</div>

        <div className={styles.row} style={{ justifyContent: 'space-between', marginBottom: '.75rem' }}>
          <span style={{ fontSize: '.82rem', color: 'var(--text2)' }}>
            {done}/{active.length} seleccionados
          </span>
          {picksLocked && <span className={`${styles.badge} ${styles.badgeLocked}`}>Picks cerrados</span>}
          {!picksLocked && deadline && (
            <span className={`${styles.badge} ${styles.badgeOpen}`}>
              Cierra {new Date(deadline).toLocaleString()}
            </span>
          )}
        </div>

        {!picksLocked && submitted && (
          <div className={`${styles.note} ${styles.noteOk}`}>Planilla confirmada ✓</div>
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
                locked={picksLocked}
                timeZone={getLeagueTimezone(league)}
              />
            ))}
          </div>
        )}
      </div>

      {!picksLocked && active.length > 0 && (
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
