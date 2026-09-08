import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../../i18n/context'
import { buildLeaderboard } from '../../game-week/simulationView'
import LeaderboardTable from '../../../components/LeaderboardTable'
import { gamesOfWeek } from '../autoSchedule'
import styles from '../training-camp.module.css'

// ════════════════════════════════════════════════════════════════════
// TrainingCampStandings — tabla de posiciones read-only del campamento v2
//
// Usa el MISMO diseño que la liga de preseason/season (Leaderboard + tabla):
// tabs por semana + pestaña "📊 General" (acumulado de TODOS los juegos
// finalizados), medallas 🥇🥈🥉 para las 3 primeras posiciones, acentos
// "X/Y aciertos" y resaltado del ganador (is-winner) cuando la semana
// terminó. Nicknames reales de los participantes (sin anonimato).
//
// Consume el MISMO `tc` (useTrainingCamp) que monta LeagueStandings para
// no duplicar el hook en la página.
// Sin juegos resueltos todavía → nota silenciosa (nada de CTA gigante).
// ════════════════════════════════════════════════════════════════════

export default function TrainingCampStandings({ tc, currentUserId }) {
  const { t } = useLanguage()
  const { loading, session, auto, totalWeeks, currentWeek, games, membersByUser, allPicks } = tc

  const [viewWeek, setViewWeek] = useState(1)

  // Sigue la semana activa (auto) como la página del campamento.
  useEffect(() => { if (auto) setViewWeek(currentWeek) }, [auto, currentWeek])

  const weekNumbers = useMemo(() => {
    const fromGames = [...new Set(games.map(g => Number(g.week)))]
      .filter(n => !Number.isNaN(n))
      .sort((a, b) => a - b)
    return fromGames.length > 0
      ? fromGames
      : Array.from({ length: totalWeeks }, (_, i) => i + 1)
  }, [games, totalWeeks])

  const baseParticipants = useMemo(
    () => Object.entries(membersByUser || {}).map(([uid, m], i) => ({
      id: uid,
      username: m.nickname || `Jugador ${i + 1}`,
    })),
    [membersByUser]
  )

  const confirmedPicks = useMemo(
    () => (allPicks || []).filter(p => p.submitted_at),
    [allPicks]
  )

  // Vista General: suma todas las semanas finalizadas (acumulado global).
  const allFinishedGames = useMemo(() => games.filter(g => g.finished), [games])

  const buildRows = (wkGames) => buildLeaderboard({
    participants: baseParticipants,
    picks: confirmedPicks,
    games: wkGames,
  })

  // Rows según la tab activa. 'all' = acumulado global.
  const [rows, isGeneral, weekFinished] = useMemo(() => {
    if (viewWeek === 'all') {
      if (allFinishedGames.length === 0) return [[], true, false]
      const allDone = games.length > 0 && allFinishedGames.length === games.length
      return [buildRows(allFinishedGames), true, allDone]
    }
    const wk = gamesOfWeek(games, Number(viewWeek) || 1)
    const wkFinished = wk.filter(g => g.finished)
    if (wkFinished.length === 0) return [[], false, wk.length === 0]
    return [buildRows(wkFinished), false, wkFinished.length === wk.length]
  }, [viewWeek, games, allFinishedGames, baseParticipants, confirmedPicks])

  if (loading && !session) {
    return <div className="empty-state"><div className="big">⏳</div>{t('app.loading')}</div>
  }

  if (!session) {
    return (
      <div className="empty-state">
        <div className="big">🎓</div>
        {t('leaderboard.practiceEmpty')}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="big">🏟️</div>
        {auto
          ? 'La tabla aparecerá cuando se resuelvan los primeros juegos del campamento.'
          : 'Todavía no hay resultados para esta semana.'}
      </div>
    )
  }

  return (
    <div>
      <div className="week-tabs" style={{ marginBottom: '1rem' }}>
        <button
          className={`week-tab ${isGeneral ? 'active' : ''}`}
          onClick={() => setViewWeek('all')}
        >
          📊 General
        </button>
        {weekNumbers.map(w => (
          <button
            key={w}
            className={`week-tab ${viewWeek === w ? 'active' : ''}`}
            onClick={() => setViewWeek(w)}
          >
            Semana {w}
          </button>
        ))}
      </div>

      <div className="msg success" style={{ marginBottom: '1rem', fontSize: '.8rem' }}>
        📊 {isGeneral
          ? 'Acumulado general de todas las semanas.'
          : weekFinished
            ? 'Semana completa — datos finales basados en los resultados de todos los partidos.'
            : 'Resultados parciales — se muestran los aciertos de los partidos ya finalizados.'
        }
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {isGeneral ? 'Tabla general' : `Tabla de la semana ${viewWeek}`}
        </div>
        <LeaderboardTable rows={rows} currentUserId={currentUserId} showWinner={weekFinished} />
      </div>
    </div>
  )
}