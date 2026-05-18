import { useState, useEffect, useCallback } from 'react'
import GameCard from '../components/GameCard'
import { NFL_WEEKS } from '../data/nflData'
import { leagueGamesApi } from '../supabase'
import { usePicks } from '../hooks/usePicks'
import styles from './Picks.module.css'

export default function Picks({ user, league }) {
  const [activeWeek, setActiveWeek] = useState(2)
  const [leagueGames, setLeagueGames] = useState(null)
  const [loadingGames, setLoadingGames] = useState(false)

  const { picks, submitted, saving, selectPick, submitPicks } = usePicks(user, league, activeWeek)

  // Load league games from Supabase
  const loadLeagueGames = useCallback(async () => {
    if (!league) return
    setLoadingGames(true)
    const { data, error } = await leagueGamesApi.getForLeague(league.id)
    if (!error && data?.length) {
      setLeagueGames(data)
    } else {
      setLeagueGames(null)
    }
    setLoadingGames(false)
  }, [league])

  useEffect(() => { loadLeagueGames() }, [loadLeagueGames])

  // Determine which game source to use
  const useDynamic = leagueGames && leagueGames.length > 0

  // Normalize game so GameCard uses game_id for lookups/picks
  const normGame = (g) => ({ ...g, id: g.game_id || g.id })

  // Build week data from dynamic games or use NFL_WEEKS
  const getWeekData = (week) => {
    if (useDynamic) {
      const games = leagueGames.filter(g => g.week === week).map(normGame)
      if (games.length === 0) return null
      const allFinished = games.every(g => g.finished)
      const results = {}
      games.forEach(g => { if (g.result) results[g.id] = g.result })
      return {
        label: `Semana ${week}`,
        games,
        results: allFinished ? results : null,
        finished: allFinished,
      }
    }
    return NFL_WEEKS[week] || null
  }

  const weekData = getWeekData(activeWeek)

  // Available weeks
  const weeks = useDynamic
    ? [...new Set(leagueGames.map(g => g.week))].sort((a, b) => a - b)
    : Object.keys(NFL_WEEKS).map(Number)

  const pickedCount  = Object.keys(picks).length
  const totalGames   = weekData?.games?.length || 0
  const isLocked     = weekData?.finished || submitted

  const correctCount = weekData?.results
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

      {useDynamic && (
        <div className="msg info" style={{ marginBottom: '1rem', fontSize: '.78rem' }}>
          📋 Usando calendario personalizado de la liga
        </div>
      )}

      {/* Week tabs */}
      <div className="week-tabs">
        {weeks.map(w => {
          const wd = getWeekData(w)
          return (
            <button
              key={w}
              className={`week-tab ${activeWeek === w ? 'active' : ''}`}
              onClick={() => setActiveWeek(w)}
            >
              {wd?.label || `Semana ${w}`}
              {wd?.finished && <span className="fin-tag">FINAL</span>}
            </button>
          )
        })}
      </div>

      {loadingGames ? (
        <div className="empty-state"><div className="big">⏳</div>Cargando partidos...</div>
      ) : !weekData ? (
        <div className="empty-state">
          <div className="big">📭</div>
          No hay partidos para la Semana {activeWeek}.
          {league && (league.admin_id === user?.id || league.role === 'admin') && (
            <><br /><span style={{ fontSize: '.82rem', color: 'var(--text3)' }}>
              Ve a Mi Liga &gt; Gestión de Partidos para importar juegos.
            </span></>
          )}
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
