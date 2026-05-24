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

  const deadlineMode = league?.deadline_mode || 'weekly'

  // Load league games from Supabase
  const loadLeagueGames = useCallback(async () => {
    if (!league) return
    setLoadingGames(true)
    const { data, error } = await leagueGamesApi.getForLeague(league.id)
    if (error) {
      console.warn('Error al cargar league_games:', error)
      setLeagueGames(null)
    } else if (data?.length) {
      setLeagueGames(data)
    } else {
      setLeagueGames(null)
    }
    setLoadingGames(false)
  }, [league])

  useEffect(() => { loadLeagueGames() }, [loadLeagueGames])

  // Determine which game source to use
  const useDynamic = leagueGames && leagueGames.length > 0

  // Normalize game so GameCard works with both DB fields and NFL_WEEKS format
  const normGame = (g) => ({
    ...g,
    id:    g.game_id    || g.id,
    time:  g.game_time  || g.time,
    aA:    g.away_abbr  || g.aA,
    hA:    g.home_abbr  || g.hA,
    away:  g.away_team  || g.away,
    home:  g.home_team  || g.home,
  })

  // Compute per-game deadline (1h before game_time)
  const gameDeadline = (g) => {
    const when = g.game_time || g.time
    if (!when) return null
    const d = new Date(when)
    return isNaN(d) ? null : new Date(d.getTime() - 60 * 60 * 1000)
  }

  const isGameLocked = (g) => {
    if (g.finished) return true
    if (deadlineMode === 'weekly') return submitted || weekData?.finished
    // game_by_game: each game locks 1h before its own kickoff
    const dl = gameDeadline(g)
    return dl ? new Date() >= dl : false
  }

  // Build week data from dynamic games or use NFL_WEEKS
  const getWeekData = (week) => {
    if (useDynamic) {
      const active = leagueGames.filter(g => g.active !== false)
      const games = active.filter(g => g.week === week).map(normGame).sort((a, b) => {
        const ta = a.game_time || a.time || ''
        const tb = b.game_time || b.time || ''
        if (ta < tb) return -1
        if (ta > tb) return 1
        return 0
      })
      if (games.length === 0) return null
      const allFinished = games.every(g => g.finished)
      const results = {}
      games.forEach(g => { if (g.result) results[g.id] = g.result })
      return {
        label: `Semana ${week}`,
        games,
        results: Object.keys(results).length > 0 ? results : null,
        finished: allFinished,
      }
    }
    return NFL_WEEKS[week] || null
  }

  const weekData = getWeekData(activeWeek)

  // Available weeks
  const weeks = useDynamic
    ? [...new Set(leagueGames.filter(g => g.active !== false).map(g => g.week))].sort((a, b) => a - b)
    : Object.keys(NFL_WEEKS).map(Number)

  // In game_by_game mode, count only unlocked games
  const lockedGames = weekData?.games?.filter(g => isGameLocked(g)) || []
  const unlockedGames = weekData?.games?.filter(g => !isGameLocked(g)) || []
  const picksInUnlocked = unlockedGames.filter(g => picks[g.id])
  const totalUnlocked = unlockedGames.length
  const pickedUnlocked = picksInUnlocked.length
  const totalGames = weekData?.games?.length || 0
  const pickedCount = weekData?.games?.filter(g => picks[g.id]).length || 0

  const isLocked     = weekData?.finished || (deadlineMode === 'weekly' && submitted)
  const isAllLocked  = deadlineMode === 'game_by_game' && unlockedGames.length === 0

  const correctCount = weekData?.results
    ? Object.entries(picks).filter(([gid, pick]) => weekData.results[gid] === pick).length
    : 0

  const handleSubmit = async () => {
    const required = deadlineMode === 'weekly' ? totalUnlocked : totalUnlocked
    const { error } = await submitPicks(required, deadlineMode === 'game_by_game')
    if (error) alert(error.message)
  }

  return (
    <div className="page">
      <div className="page-title">Mis Picks</div>
      <div className="page-sub">Selecciona el ganador de cada partido antes del kickoff</div>

      {!loadingGames && !useDynamic && (
        <div className="msg warning" style={{ marginBottom: '1rem', fontSize: '.78rem' }}>
          ⚠️ No se encontraron juegos en esta liga. {league?.admin_id === user?.id
            ? 'Ve a Mi Liga &gt; Gestión de Partidos para importarlos.'
            : 'El admin de la liga debe importar los juegos.'}
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
          {/* Mode badge */}
          {deadlineMode === 'game_by_game' && !isAllLocked && (
            <div className="msg info" style={{ marginBottom: '1rem', fontSize: '.78rem' }}>
              ⏱️ Modo juego por juego — cada partido se bloquea 1h antes de su inicio
            </div>
          )}
          {deadlineMode === 'weekly' && !submitted && !weekData.finished && (
            <div className="msg warning" style={{ marginBottom: '1rem', fontSize: '.78rem' }}>
              📅 Modo semanal — todos los picks se bloquean 1h antes del primer partido
            </div>
          )}

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
                locked={isGameLocked(game)}
              />
            ))}
          </div>

          {/* Submit bar */}
          {!weekData.finished && !isAllLocked && (
            <div className={styles.submitBar}>
              <div>
                <div className={styles.pickCount}>
                  {deadlineMode === 'game_by_game' ? (
                    <><strong>{pickedUnlocked}</strong> / {totalUnlocked} partidos disponibles seleccionados</>
                  ) : (
                    <><strong>{pickedCount}</strong> / {totalGames} partidos seleccionados</>
                  )}
                </div>
                {submitted && (
                  <div className={styles.submitOk}>✓ Picks guardados correctamente</div>
                )}
              </div>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={
                  deadlineMode === 'weekly'
                    ? (pickedCount < totalGames || submitted || saving)
                    : (pickedUnlocked < totalUnlocked || saving)
                }
              >
                {saving ? 'Guardando...' : submitted ? '✓ Enviado' : 'Guardar Picks'}
              </button>
            </div>
          )}

          {weekData.finished && (
            <div className="lock-notice">🔒 Esta semana ya finalizó — los picks están bloqueados</div>
          )}
          {deadlineMode === 'game_by_game' && isAllLocked && !weekData.finished && (
            <div className="lock-notice">🔒 Todos los partidos de esta semana han comenzado</div>
          )}
        </>
      )}
    </div>
  )
}
