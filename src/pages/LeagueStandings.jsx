import { useLanguage } from '../i18n/context'
import { useTrainingSession } from '../domains/training/hooks/useTrainingSession'
import { EVENT_TYPES } from '../domains/event'
import { useTrainingCamp } from '../domains/training-camp/hooks/useTrainingCamp'
import TrainingCampStandings from '../domains/training-camp/components/TrainingCampStandings'
import { GameWeekProvider, GameWeekLeaderboard } from '../domains/game-week'
import Leaderboard from './Leaderboard'
import LeagueIdentity from '../components/LeagueIdentity'

// ════════════════════════════════════════════════════════════════════
// LeagueStandings — tabla de posiciones por tipo de liga (PLAN-01.1 §6)
//
// Despacho por league_mode (Routing de standings):
//   Season/Regular     → Leaderboard legacy (semanas del calendario + general)
//   Practice con camp v2 → TrainingCampStandings (tabla real por semana, igual
//                          que la página del campamento; anónima hasta revelar)
//   Practice legacy    → GameWeekLeaderboard de la jornada del Training Camp;
//                        sin jornada → nota silenciosa (sin CTA gigante).
// La identidad de liga se muestra SIEMPRE (no solo en el Topbar).
//
// El hook legacy (useTrainingSession) solo se monta para ligas practice SIN
// campamento v2: en un camp v2 su efecto de spawn (finished → Fixture
// Generation → Game Week) dispararía el pipeline legacy y contaminaría la
// experiencia v2.
// ════════════════════════════════════════════════════════════════════

export default function LeagueStandings({ user, league, onNavigate, onChangeLeague }) {
  const isPractice = !!(league && (league.league_mode === 'practice' || league.simulation))

  if (!isPractice) {
    return <Leaderboard user={user} league={league} onNavigate={onNavigate} onChangeLeague={onChangeLeague} />
  }

  return <PracticeStandingsBody user={user} league={league} onNavigate={onNavigate} />
}

function PracticeStandingsBody({ user, league, onNavigate }) {
  const { t } = useLanguage()

  const camp = useTrainingCamp({ leagueId: league?.id, userId: user?.id, league })

  const title = (
    <>
      <div className="page-title">{t('leaderboard.title')}</div>
      <div className="page-sub">{t('leaderboard.subtitle')}</div>
      <LeagueIdentity league={league} sessionNo={camp.session?.session_no} />
    </>
  )

  if (camp.session?.id) {
    return (
      <div className="page">
        {title}
        <TrainingCampStandings tc={camp} currentUserId={user?.id} />
      </div>
    )
  }

  return <LegacyPracticeStandings user={user} league={league} onNavigate={onNavigate} title={title} t={t} />
}

// Ruta legacy (pre-v2): la liga practice vive en el pipeline Training Camp →
// Fixture Generation → Game Week. Como hay jornada → GameWeekLeaderboard;
// si todavía no → nota silenciosa con enlace discreto al lobby.
function LegacyPracticeStandings({ user, league, onNavigate, title, t }) {
  const tc = useTrainingSession({ leagueId: league?.id, userId: user?.id, league })
  const { event, eventType, participants, loading } = tc

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
            className="btn-ghost"
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
    <div className="page">
      {title}
      <GameWeekProvider event={event} league={league} user={user} participants={participants} onTransition={tc.applyPatch}>
        <GameWeekLeaderboard />
      </GameWeekProvider>
    </div>
  )
}