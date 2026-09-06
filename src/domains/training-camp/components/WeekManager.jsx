import { useState } from 'react'
import { NFL_TEAMS } from '../../../data/nflData'
import { MIN_GAMES_PER_WEEK, MAX_GAMES_PER_WEEK } from '../model'
import ScoreEditor from '../../../components/ScoreEditor'
import TeamLogo from '../../../components/TeamLogo'
import styles from '../training-camp.module.css'

const TEAM_OPTIONS = Object.entries(NFL_TEAMS).map(([abbr, data]) => ({ abbr, name: data.name }))

// BUILD-TC-V2 — Gestión de una semana del Training Camp.
// mode:
//   'setup'  → fase de construcción del calendario: agrega juegos semanal, valida
//              orden secuencial, avanza semana. En la última semana ofrece
//              "Finalizar calendario" (onScheduleComplete → INVITING).
//   'active' → fase de juego: agrega juegos, resultados manuales (ScoreEditor),
//              avanza semanas y completa el campamento.
export default function TrainingCampWeekManager({
  mode = 'active', week, totalWeeks, games, deadline, picksLocked, weekComplete, progress,
  busy, isAdmin, onAddGame, onRemoveGame, onSetResult, onNextWeek, onFinishSchedule,
}) {
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [resultFor, setResultFor] = useState(null)
  const [msg, setMsg] = useState(null)

  const submitGame = async () => {
    if (!home || !away) return setMsg('Selecciona ambos equipos.')
    if (home === away) return setMsg('Los equipos deben ser distintos.')
    if (!date || !time) return setMsg('Completa fecha y hora.')
    if (games.length >= MAX_GAMES_PER_WEEK) {
      return setMsg(`Máximo ${MAX_GAMES_PER_WEEK} juegos por semana.`)
    }
    const res = await onAddGame({ week, home: TEAM_OPTIONS.find(t => t.abbr === home), away: TEAM_OPTIONS.find(t => t.abbr === away), date, time })
    if (res?.error) return setMsg(res.error.message)
    setHome(''); setAway(''); setDate(''); setTime(''); setMsg(null)
  }

  const doSetResult = async (game, awayVal, homeVal) => {
    const res = await onSetResult({ game, homeScore: homeVal, awayScore: awayVal })
    if (res?.error) setMsg(res.error.message)
    else { setResultFor(null); setMsg(null) }
  }

  const isLastWeek = Number(week) >= Number(totalWeeks)
  // Min 1 / máx N juegos por semana para avanzar en modo setup.
  const atMax = games.length >= MAX_GAMES_PER_WEEK
  const canAdvance = games.length >= MIN_GAMES_PER_WEEK

  return (
    <div>
      {msg && <div className={`${styles.note} ${styles.noteInfo}`}>{msg}</div>}

      {/* Semana en curso */}
      <div className={styles.row} style={{ justifyContent: 'space-between', marginBottom: '.5rem' }}>
        <div className={`${styles.badge} ${styles.badgeSetup}`}>Semana {week} de {totalWeeks}</div>
        {mode === 'active' && deadline && !picksLocked && (
          <span style={{ fontSize: '.8rem', color: 'var(--text2)' }}>
            Picks cierran: {new Date(deadline).toLocaleString()}
          </span>
        )}
        {mode === 'active' && picksLocked && <span className={`${styles.badge} ${styles.badgeLocked}`}>Picks cerrados</span>}
        {mode === 'active' && weekComplete && <span className={`${styles.badge} ${styles.badgeDone}`}>Completada ✓</span>}
        {mode === 'setup' && <span style={{ fontSize: '.8rem', color: 'var(--text2)' }}>Agrega los juegos de esta semana</span>}
      </div>

      {mode === 'active' && (
        <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginBottom: '1rem' }}>
          Resultados manuales: {progress.done}/{progress.total}
        </div>
      )}

      {/* Lista de juegos de la semana */}
      <div className={styles.grid}>
        {games.map(g => (
          <div key={g.game_id || g.id} className={styles.gameCard}>
            <div className={styles.gameTop}>
              <span>{g.game_time ? new Date(g.game_time).toLocaleString() : '—'}</span>
              {isAdmin && <button className={styles.btnGhost} onClick={() => onRemoveGame(g.game_id || g.id)}>✕</button>}
            </div>
            <div className={styles.gameMatchup}>
              <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
                <TeamLogo abbr={g.away_abbr} size={18} /> {g.away_abbr}
              </span>
              <span style={{ color: 'var(--text2)' }}>@</span>
              <span style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
                <TeamLogo abbr={g.home_abbr} size={18} /> {g.home_abbr}
              </span>
            </div>

            {g.finished ? (
              <div style={{ fontWeight: 700, textAlign: 'center' }}>
                {g.away_score}-{g.home_score}
              </div>
            ) : (
              resultFor === g.id && mode === 'active' && isAdmin ? (
                <ScoreEditor
                  away={{ abbr: g.away_abbr }} home={{ abbr: g.home_abbr }}
                  initialAwayScore={g.away_score} initialHomeScore={g.home_score}
                  saving={busy}
                  onSave={(a, h) => doSetResult(g, a, h)}
                  onCancel={() => setResultFor(null)}
                />
              ) : (
                mode === 'active' && isAdmin && (
                  <button className={styles.btn} onClick={() => setResultFor(g.id)}>
                    {busy ? '…' : 'Resultado'}
                  </button>
                )
              )
            )}
          </div>
        ))}
        {games.length === 0 && <div className={styles.empty}>Aún no hay juegos en esta semana.</div>}
      </div>

      {/* Agregar juego manual (solo admin) */}
      {isAdmin && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Agregar juego a la semana {week}</div>
          <div style={{ fontSize: '.8rem', color: 'var(--text2)', marginBottom: '.5rem' }}>
            {games.length}/{MAX_GAMES_PER_WEEK} juegos — {atMax ? 'máximo alcanzado' : `agrega entre ${MIN_GAMES_PER_WEEK} y ${MAX_GAMES_PER_WEEK} juegos`}
          </div>
          <div className={styles.row} style={{ marginBottom: '.5rem' }}>
            <select className={styles.select} value={away} onChange={e => setAway(e.target.value)}>
              <option value="">Visitante</option>
              {TEAM_OPTIONS.filter(t => t.abbr !== home).map(t => <option key={t.abbr} value={t.abbr}>{t.abbr}</option>)}
            </select>
            <span>@</span>
            <select className={styles.select} value={home} onChange={e => setHome(e.target.value)}>
              <option value="">Local</option>
              {TEAM_OPTIONS.filter(t => t.abbr !== away).map(t => <option key={t.abbr} value={t.abbr}>{t.abbr}</option>)}
            </select>
          </div>
          <div className={styles.row} style={{ marginBottom: '.5rem' }}>
            <input type="date" className={styles.input} value={date} onChange={e => setDate(e.target.value)} />
            <input type="time" className={styles.input} value={time} onChange={e => setTime(e.target.value)} />
          </div>
          <button className={styles.btnPrimary} onClick={submitGame} disabled={busy || atMax}>Agregar (+)</button>
        </div>
      )}

      {/* Navegación de semanas */}
      {isAdmin && mode === 'setup' && (
        <div className={styles.row} style={{ justifyContent: 'flex-end' }}>
          {canAdvance && (
            <button
              className={isLastWeek ? styles.btnPrimary : styles.btn}
              disabled={busy}
              onClick={isLastWeek ? onFinishSchedule : onNextWeek}
            >
              {isLastWeek ? 'Finalizar calendario →' : `Siguiente semana (${week + 1}) →`}
            </button>
          )}
          {!canAdvance && (
            <span style={{ fontSize: '.8rem', color: 'var(--text2)' }}>
              Agrega al menos {MIN_GAMES_PER_WEEK} juego a esta semana para continuar.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
