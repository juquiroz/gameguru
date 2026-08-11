import { leaguesApi } from '../../../supabase'
import { useLanguage } from '../../../i18n/context'
import { useDashboardData } from '../hooks/useDashboardData'
import { getLeagueMode } from '../../league/models/modes'
import { canJoinLeague } from '../../league'
import { useLeagueEvent } from '../../training/hooks/useLeagueEvent'
import DashboardHeader from './DashboardHeader'
import HeroCard from './HeroCard'
import HowItWorks from './HowItWorks'
import PendingActionCard from './PendingActionCard'
import CountdownCard from './CountdownCard'
import GamesCarousel from './GamesCarousel'
import LeaguesSummary from './LeaguesSummary'
import QuickStats from './QuickStats'
import MiniLeaderboard from './MiniLeaderboard'
import UpcomingGamesList from './UpcomingGamesList'
import CopyReminder from './CopyReminder'
import homeStyles from '../../../pages/Home.module.css'
import styles from '../dashboard.module.css'

export default function HomeDashboard({ user, myLeagues, currentLeague, onNavigate, onEnterLeague, onCreateNew, onJoinClick, onRefreshLeagues, onCreateTrainingCamp }) {
  const { t } = useLanguage()
  const state = useDashboardData({ user, myLeagues, currentLeague })

  const {
    profile,
    contextLeague,
    hasCurrentLeague,
    currentWeek,
    lastLockedWeek,
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
    hasWeekGames,
    loadingGames,
    leagueGames,
    participation,
    isContextAdmin,
    showPendingAction,
    showLeaderboard,
    showCountdown,
  } = state

  // BUILD-TC-005.4 — Evento más reciente de la liga activa (lectura ligera,
  // sin orquestación) para el CTA MAKE YOUR PICKS y el estado del roster.
  const event = useLeagueEvent(hasCurrentLeague ? currentLeague?.id : null)
  const rosterOpen = !event || canJoinLeague(event)
  const picksOpen = !!event && event.event_type === 'game_week' && event.state === 'picks_open'

  const isAdmin = !!currentLeague && (currentLeague.admin_id === user?.id || currentLeague.role === 'admin')
  const pendingResults = leagueGames ? leagueGames.filter(g => !g.finished).length : 0

  const copyInviteLink = () => {
    if (!currentLeague) return
    const link = `${window.location.origin}/gameguru/?join=${currentLeague.code}`
    navigator.clipboard.writeText(link)
    alert(t('dashboard.copied'))
  }

  const handleDeleteLeague = async (e, lg) => {
    e.stopPropagation()
    if (!window.confirm(t('league.deleteConfirm', { name: lg.name }))) return
    if (!window.confirm(t('league.deleteConfirm2'))) return
    try {
      const { error } = await leaguesApi.delete(lg.id)
      if (error) { alert(`${t('common.error')}: ${error.message}`); return }
    } catch (ex) {
      console.error('HomeDashboard delete excepción:', ex)
      alert(`${t('common.error')}: ${ex?.message || 'desconocido'}`)
      return
    }
    onRefreshLeagues()
  }

  if (loadingGames && contextLeague && !leagueGames) {
    return (
      <div className={homeStyles.wrap}>
        <div className={homeStyles.loading}>{t('app.loading')}</div>
      </div>
    )
  }

  // ── Estado 1 — usuario sin ligas ──────────────────────────────────────
  if (!hasCurrentLeague && !contextLeague) {
    return (
      <div className={homeStyles.wrap}>
        <DashboardHeader
          profile={profile}
          currentWeek={currentWeek}
          leagueCount={0}
          user={user}
          badge={<span className={styles.weekBadge}>{t('home.season')}</span>}
          sub={<span>{t('dashboard.welcomeSub')}</span>}
        />
        <HeroCard onCreateNew={onCreateNew} onJoinClick={onJoinClick} />
        <GamesCarousel
          title={t('dashboard.weekGames', { week: currentWeek ?? 1 })}
          games={weekGames.slice(0, 8)}
          locked={locked}
        />
        <HowItWorks />
        <UpcomingGamesList games={upcomingGames} />
        <button className="btn-primary" style={{ width: '100%', maxWidth: 520 }} onClick={onCreateNew}>
          {t('dashboard.startNow')}
        </button>
        <button className="btn-primary" style={{ width: '100%', maxWidth: 520, background: 'var(--mode-tc, #3B82F6)', borderColor: 'var(--mode-tc, #3B82F6)' }} onClick={onCreateTrainingCamp}>
          {t('training.ctaWelcome')}
        </button>
      </div>
    )
  }

  // ── Estados 2 y 3 — con ligas ──────────────────────────────────────────
  const carouselGames = dayGames.length ? dayGames : weekGames.slice(0, 8)
  const carouselTitle = dayGames.length
    ? t('dashboard.gamesToday')
    : t('dashboard.weekGames', { week: currentWeek ?? 1 })

  return (
    <div className={homeStyles.wrap}>
      <DashboardHeader
        profile={profile}
        currentWeek={currentWeek}
        leagueCount={myLeagues?.length || 0}
        user={user}
      />

      {hasCurrentLeague && getLeagueMode(currentLeague) === 'practice' && (
        picksOpen ? (
          <button
            className={styles.picksCta}
            onClick={() => onNavigate('training')}
          >
            <span className={styles.picksCtaIcon}>🏈</span>
            <span className={styles.picksCtaLabel}>{t('training.makePicksCta')}</span>
            <span className={styles.lobbyBannerArrow}>→</span>
          </button>
        ) : (
          <button
            className={styles.lobbyBanner}
            onClick={() => onNavigate('training')}
          >
            <span className={styles.lobbyBannerIcon}>🎓</span>
            <span>{t('training.lobbyBanner')}</span>
            <span className={styles.lobbyBannerArrow}>→</span>
          </button>
        )
      )}

      {isContextAdmin && participation && (
        <div className={styles.participationBar}>
          {t('dashboard.adminParticipation', {
            n: participation.submitted,
            total: participation.total,
            missing: Math.max(0, participation.total - participation.submitted),
          })}
        </div>
      )}

      {!hasCurrentLeague && (
        <LeaguesSummary
          myLeagues={myLeagues}
          currentLeague={currentLeague}
          memberCounts={memberCounts}
          user={user}
          onEnterLeague={onEnterLeague}
          onDeleteLeague={handleDeleteLeague}
        />
      )}

      {showPendingAction && hasWeekGames && (
        <PendingActionCard pendingCount={pendingCount} locked={locked} onNavigate={onNavigate} />
      )}

      {showCountdown && <CountdownCard deadline={deadline} locked={locked} />}

      <GamesCarousel title={carouselTitle} games={carouselGames} locked={locked} />

      {hasCurrentLeague && (
        <LeaguesSummary
          myLeagues={myLeagues}
          currentLeague={currentLeague}
          memberCounts={memberCounts}
          user={user}
          onEnterLeague={onEnterLeague}
          onDeleteLeague={handleDeleteLeague}
        />
      )}

      <QuickStats position={position} correctCount={correctCount} pendingCount={pendingCount} streak={streak} />

      {showLeaderboard && (
        <MiniLeaderboard standings={standings} currentUserId={user?.id} onNavigate={onNavigate} week={lastLockedWeek} />
      )}

      <UpcomingGamesList games={upcomingGames} />

      {isAdmin && (
        <>
          {rosterOpen ? (
            <div className={homeStyles.inviteBox}>
              <div className={homeStyles.inviteLabel}>{t('dashboard.inviteLabel')}</div>
              <div className={homeStyles.inviteCode}>{currentLeague.code}</div>
              <button className={homeStyles.inviteCopy} onClick={copyInviteLink}>
                {t('dashboard.copyLink')}
              </button>
            </div>
          ) : (
            <div className={styles.rosterClosed}>
              <span className={styles.rosterClosedIcon}>🔒</span>
              <div className={styles.rosterClosedText}>
                <div className={styles.rosterClosedTitle}>{t('training.rosterClosedTitle')}</div>
                <div className={styles.rosterClosedDesc}>{t('training.rosterClosedDesc')}</div>
              </div>
            </div>
          )}

          <div className={homeStyles.quickActions}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onNavigate('league')}>
              {t('dashboard.adminManage')}
            </button>
            {pendingResults > 0 && (
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onNavigate('league')}>
                {t('dashboard.enterResults', { n: pendingResults })}
              </button>
            )}
            {!locked && currentWeek != null && (
              <CopyReminder league={currentLeague} week={currentWeek} deadline={deadline} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
