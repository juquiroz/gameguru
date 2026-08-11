import { useLanguage } from '../i18n/context'
import { useTrainingSession } from '../domains/training/hooks/useTrainingSession'
import { EVENT_TYPES } from '../domains/event'
import { GameWeekProvider, GameWeekLeaderboard } from '../domains/game-week'
import Leaderboard from './Leaderboard'
import LeagueIdentity from '../components/LeagueIdentity'

// ════════════════════════════════════════════════════════════════════
// LeagueStandings — tabla de posiciones por tipo de liga (PLAN-01.1 §6)
//
// Despacho por league_mode (Routing de standings):
//   Season/Regular  → Leaderboard legacy (semanas del calendario + general)
//   Practice/TC     → GameWeekLeaderboard de la jornada del Training Camp;
//                     sin jornada → empty-state con CTA al lobby.
// La identidad de liga se muestra SIEMPRE (no solo en el Topbar).
// ════════════════════════════════════════════════════════════════════

export default function LeagueStandings({ user, league, onNavigate, onChangeLeague }) {
  const { t } = useLanguage()

  // Hook incondicional (regla de hooks): null-safe con leagueId indefinido.
  const tc = useTrainingSession({ leagueId: league?.id, userId: user?.id, league })
  const { event, eventType, participants, loading } = tc

  const isPractice = !!(league && (league.league_mode === 'practice' || league.simulation))

  if (!isPractice) {
    return <Leaderboard user={user} league={league} onNavigate={onNavigate} onChangeLeague={onChangeLeague} />
  }

  const title = (
    <>
      <div className="page-title">{t('leaderboard.title')}</div>
      <div className="page-sub">{t('leaderboard.subtitle')}</div>
      <LeagueIdentity league={league} sessionNo={event?.session_no} />
    </>
  )

  if (loading) {
    return (
      <div className="page">
        {title}
        <div className="empty-state"><div className="big">⏳</div>{t('app.loading')}</div>
      </div>
    )
  }

  if (eventType !== EVENT_TYPES.GAME_WEEK) {
    return (
      <div className="page">
        {title}
        <div className="empty-state">
          <div className="big">🎓</div>
          {t('leaderboard.practiceEmpty')}
          <br />
          <button
            className="btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={() => onNavigate('training')}
          >
            {t('leaderboard.practiceGoLobby')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <GameWeekProvider event={event} league={league} user={user} participants={participants} onTransition={tc.applyPatch}>
      <div className="page">
        {title}
        <GameWeekLeaderboard />
      </div>
    </GameWeekProvider>
  )
}
