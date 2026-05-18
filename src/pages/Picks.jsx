import { useState } from 'react'
import GameCard from '../components/GameCard'
import { NFL_WEEKS } from '../data/nflData'
import { usePicks } from '../hooks/usePicks'
import styles from './Picks.module.css'

export default function Picks({ user, league }) {
  const [activeWeek, setActiveWeek] = useState(2)
  const weekData = NFL_WEEKS[activeWeek]

  const { picks, submitted, saving, selectPick, submitPicks } = usePicks(user, league, activeWeek)

  const pickedCount = Object.keys(picks).length
  const totalGames  = weekData.games.length
  const isLocked    = weekData.finished || submitted

  // Count correct picks when week is finished
  const correctCount = weekData.results
    ? Object.entries(picks).filter(([gid, pick]) => weekData.results[gid] === pick).length
    : 0

  const handleSubmit = async () => {
    const { error } = await submitPicks(totalGames)
    if (error) alert(error.message)
  }

  return (
    <div className="page">
      <div className="page-title">Mis Picks</div>
      <div className="page-sub">Selecciona el ganador de cada partido antes del kickoff</div>

      {/* Week tabs */}
      <div className="week-tabs">
        {Object.entries(NFL_WEEKS).map(([wk, wd]) => (
          <button
            key={wk}
            className={`week-tab ${activeWeek == wk ? 'active' : ''}`}
            onClick={() => setActiveWeek(Number(wk))}
          >
            {wd.label}
            {wd.finished && <span className="fin-tag">FINAL</span>}
          </button>
        ))}
      </div>

      {/* Result banner for finished weeks */}
      {weekData.finished && (
        <div className="result-banner">
          <span className="rb-icon">🏆</span>
          <div>
            <div className="rb-label">Semana Finalizada</div>
            <div className="rb-score">
              Acertaste <strong>{correctCount} de {Object.keys(weekData.results).length}</strong> partidos
            </div>
          </div>
        </div>
      )}

      {/* Games grid */}
      <div className={styles.grid}>
        {weekData.games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            pick={picks[game.id]}
            onPick={selectPick}
            results={weekData.results}
            locked={isLocked}
          />
        ))}
      </div>

      {/* Submit bar */}
      {!weekData.finished && (
        <div className={styles.submitBar}>
          <div>
            <div className={styles.pickCount}>
              <strong>{pickedCount}</strong> / {totalGames} partidos seleccionados
            </div>
            {submitted && (
              <div className={styles.submitOk}>✓ Picks guardados correctamente</div>
            )}
          </div>
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={pickedCount < totalGames || submitted || saving}
          >
            {saving ? 'Guardando...' : submitted ? '✓ Enviado' : 'Enviar Picks'}
          </button>
        </div>
      )}

      {weekData.finished && (
        <div className="lock-notice">🔒 Esta semana ya finalizó — los picks están bloqueados</div>
      )}
    </div>
  )
}
