import { SPORTS } from '../../../data/nflData'
import { useLanguage } from '../../../i18n/context'
import { useDashboardData } from '../hooks/useDashboardData'
import { getLeagueTimezone } from '../../league'
import { canManageLeague } from '../../platform'
import DashboardHeader from './DashboardHeader'
import PendingActionCard from './PendingActionCard'
import CountdownCard from './CountdownCard'
import GamesCarousel from './GamesCarousel'
import LeaguesSummary from './LeaguesSummary'
import QuickStats from './QuickStats'
import MiniLeaderboard from './MiniLeaderboard'
import UpcomingGamesList from './UpcomingGamesList'
import homeStyles from '../../../pages/Home.module.css'
import styles from '../dashboard.module.css'

export default function LeagueDashboard({ user, league, myLeagues, onNavigate, onEnterLeague }) {
  const { t } = useLanguage()
  const data = useDashboardData({ user, myLeagues, currentLeague: league })
  const { loadingGames, leagueGames } = data
  const isAdmin = canManageLeague(league, user)
  const leagueTz = getLeagueTimezone(league)

  const copyInviteLink = () => {
    const link = `${window.location.origin}/?join=${league.code}`
    navigator.clipboard.writeText(link)
    alert(t('dashboard.copied'))
  }

  if (loadingGames) {
    return (
      <div className={homeStyles.wrap}>
        <div className={homeStyles.loading}>{t('app.loading')}</div>
      </div>
    )
  }

  if (!leagueGames?.length) {
    return (
      <div className={homeStyles.wrap}>
        <div className={homeStyles.heroTight}>
          <div className={homeStyles.leagueHeader}>
            <div>
              <div className={homeStyles.leagueTitle}>
                {league.name}
                {league.simulation && (
                  <span className={homeStyles.simTag}>🧪 {t('dashboard.sim')}</span>
                )}
              </div>
              <div className={homeStyles.leagueMeta}>
                {SPORTS.find(s => s.id === league.sport)?.icon} {league.sport} · {t('home.season')}
              </div>
            </div>
          </div>
        </div>

        <div className={homeStyles.inviteBox}>
          <div className={homeStyles.inviteLabel}>{t('dashboard.inviteLabel')}</div>
          <div className={homeStyles.inviteCode}>{league.code}</div>
          <button className={homeStyles.inviteCopy} onClick={copyInviteLink}>
            {t('dashboard.copyLink')}
          </button>
        </div>

        <div className={homeStyles.emptySection}>
          <div className={homeStyles.emptyIcon}>📭</div>
          <div className={homeStyles.emptyTitle}>{t('dashboard.emptyTitle')}</div>
          <div className={homeStyles.emptyDesc}>{t('dashboard.emptyDesc')}</div>
        </div>

        {isAdmin && (
          <div className={homeStyles.quickActions}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onNavigate('league')}>
              {t('dashboard.adminManage')}
            </button>
          </div>
        )}
      </div>
    )
  }

  const {
    profile,
    currentWeek,
    deadline,
    locked,
    standings,
    streak,
    memberCounts,
    position,
    correctCount,
    pendingCount,
    dayGames,
    upcomingGames,
    weekGames,
  } = data

  const carouselGames = dayGames.length ? dayGames : weekGames.slice(0, 8)
  const carouselTitle = dayGames.length
    ? t('dashboard.gamesToday')
    : t('dashboard.weekGames', { week: currentWeek })
  const pendingResults = leagueGames.filter(g => !g.finished).length

  return (
    <div className={homeStyles.wrap}>
      <DashboardHeader
        profile={profile}
        currentWeek={currentWeek}
        leagueCount={myLeagues?.length || 0}
        user={user}
      />

      <PendingActionCard pendingCount={pendingCount} locked={locked} onNavigate={onNavigate} />
      <CountdownCard deadline={deadline} locked={locked} timeZone={leagueTz} />
      <GamesCarousel title={carouselTitle} games={carouselGames} locked={locked} timeZone={leagueTz} />

      <LeaguesSummary
        myLeagues={myLeagues}
        currentLeague={league}
        memberCounts={memberCounts}
        onEnterLeague={onEnterLeague}
      />

      <QuickStats
        position={position}
        correctCount={correctCount}
        pendingCount={pendingCount}
        streak={streak}
      />

      <MiniLeaderboard standings={standings} currentUserId={user?.id} onNavigate={onNavigate} />
      <UpcomingGamesList games={upcomingGames} timeZone={leagueTz} />

      {isAdmin && (
        <>
          <div className={homeStyles.inviteBox}>
            <div className={homeStyles.inviteLabel}>{t('dashboard.inviteLabel')}</div>
            <div className={homeStyles.inviteCode}>{league.code}</div>
            <button className={homeStyles.inviteCopy} onClick={copyInviteLink}>
              {t('dashboard.copyLink')}
            </button>
          </div>

          <div className={homeStyles.quickActions}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onNavigate('league')}>
              {t('dashboard.adminManage')}
            </button>
            {pendingResults > 0 && (
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onNavigate('league')}>
                {t('dashboard.enterResults', { n: pendingResults })}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
