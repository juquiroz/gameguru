import { useState, useEffect } from 'react'
import { useAuth }   from './hooks/useAuth'
import { useLeague } from './hooks/useLeague'
import { useSuperAdmin } from './hooks/useSuperAdmin'
import { LangProvider, useLanguage } from './i18n/context'

import Auth        from './pages/Auth'
import Home        from './pages/Home'
import Picks       from './pages/Picks'
import LeagueStandings from './pages/LeagueStandings'
import PublicPicks from './pages/PublicPicks'
import LeaguePage  from './pages/LeaguePage'
import SuperAdmin  from './pages/SuperAdmin'
import PlatformOverview from './pages/PlatformOverview'
import PlatformLeagues from './pages/PlatformLeagues'
import PlatformLeagueDetail from './pages/PlatformLeagueDetail'
import PlatformUsers from './pages/PlatformUsers'
import PlatformUserDetail from './pages/PlatformUserDetail'
import PlatformDenied from './components/PlatformDenied'
import TrainingCamp from './pages/TrainingCamp'
import Topbar      from './components/Topbar'
import BottomNav   from './components/BottomNav'
import CreateSimulationModal from './components/CreateSimulationModal'
import ExperienceWizard from './domains/experience/components/ExperienceWizard'
import TrainingCampSetupModal from './domains/training/components/TrainingCampSetupModal'

import { LeagueProvider, useLeagueContext } from './league/context/LeagueContext'
import { LeagueRoute } from './league/LeagueRoute'
import { resolveForView, navigate, LEGACY_REDIRECTABLE } from './router/routes'

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  )
}

// AppInner: auth + estado de liga (useLeague). Monta LeagueProvider sobre
// AppShell. La carga/auth no dependen del contexto de liga.
function AppInner() {
  const [showWizard, setShowWizard] = useState(false)
  const [wizardInit, setWizardInit] = useState(null)
  const [showJoin,   setShowJoin]   = useState(false)
  const [showSimulation, setShowSimulation] = useState(false)
  const [showTrainingCamp, setShowTrainingCamp] = useState(false)
  const [lobbyVersion, setLobbyVersion] = useState(0)
  const { t } = useLanguage()

  const { user, loading, signIn, signUp, signOut } = useAuth()
  const { isSuperAdmin, checking: adminChecking } = useSuperAdmin(user)
  const leaguesState = useLeague(user)

  if (loading || adminChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
        background: 'var(--bg)',
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '2.5rem',
          letterSpacing: '.08em',
          background: 'linear-gradient(135deg, #F5A623, #FF4B4B)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          GameGuru
        </div>
        <div style={{ color: 'var(--text3)', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '.1em' }}>
          {t('app.loading')}
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth onAuth={{ signIn, signUp }} />
  }

  return (
    <LeagueProvider user={user} leaguesState={leaguesState}>
      <AppShell
        user={user}
        isSuperAdmin={isSuperAdmin}
        signOut={signOut}
        lobbyVersion={lobbyVersion}
        setLobbyVersion={setLobbyVersion}
        showWizard={showWizard}
        setShowWizard={setShowWizard}
        wizardInit={wizardInit}
        setWizardInit={setWizardInit}
        showJoin={showJoin}
        setShowJoin={setShowJoin}
        showSimulation={showSimulation}
        setShowSimulation={setShowSimulation}
        showTrainingCamp={showTrainingCamp}
        setShowTrainingCamp={setShowTrainingCamp}
      />
    </LeagueProvider>
  )
}

function AppShell({
  user,
  isSuperAdmin,
  signOut,
  lobbyVersion,
  setLobbyVersion,
  showWizard,
  setShowWizard,
  wizardInit,
  setWizardInit,
  showJoin,
  setShowJoin,
  showSimulation,
  setShowSimulation,
  showTrainingCamp,
  setShowTrainingCamp,
}) {
  const [activePage, setActivePage] = useState('dashboard')
  const { t } = useLanguage()

  // Contexto de liga resuelto por la URL (PLAN-LEAGUE-CONTEXT).
  const {
    route,
    activeLeagueId,
    myLeagues,
    loadingLeagues,
    currentLeague,
    league: routeLeague,
    fetchMyLeagues,
    createLeague,
    createSimulationLeague,
    createTrainingCamp,
    configureTrainingCamp,
    joinByCode,
    enterLeague,
    leaveCurrentLeague,
    setActiveLeague,
  } = useLeagueContext()

  // PLAN-LEAGUE-CONTEXT-01.1: la liga de contexto es la resuelta por la URL
  // (fuente de verdad); currentLeague es solo el fallback del flujo legacy.
  const effectiveLeague = routeLeague || currentLeague

  const PAGE_KEYS = {
    dashboard: 'topbar.dashboard',
    picks: 'topbar.picks',
    board: 'topbar.board',
    publicpicks: 'Picks Públicos',
    league: 'topbar.league',
    training: 'training.name',
    superadmin: 'superadmin.title',
    platform: 'Consola de Plataforma',
    platformLeagues: 'Ligas de Plataforma',
    platformLeague: 'Detalle de Liga',
    platformUsers: 'Usuarios de Plataforma',
    platformUser: 'Detalle de Usuario',
  }

  // Sync URL with active page (flujo legacy: #picks, #board, ...)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && hash !== activePage) {
      setActivePage(hash)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redirects legacy (#picks/#board/#league/#publicpicks) hacia
  // #/league/:id/:view cuando hay contexto resoluble. La URL manda;
  // activeLeagueId es sugerencia. `training` se excluye hasta Fase 6 (el
  // lobby del TC no está migrado a contexto de ruta). 2+ ligas sin contexto →
  // hub (selector de liga llega en BUILD-02).
  useEffect(() => {
    if (!route || route.type !== 'legacy') return
    if (!(route.page in LEGACY_REDIRECTABLE)) return
    const resolved = resolveForView({ route, myLeagues, activeLeagueId })
    if (resolved.type === 'league' && resolved.leagueId) {
      navigate(resolved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route && route.hash, myLeagues && myLeagues.length])

  const handleNavigate = (page) => {
    setActivePage(page)
    window.location.hash = page
    const pageTitle = t(PAGE_KEYS[page] || 'app.name')
    document.title = `${pageTitle} · ${t('app.name')}`
  }

  const handleChangeLeague = () => {
    leaveCurrentLeague()
    handleNavigate('dashboard')
  }

  const openWizard = (initialExperience = null) => { setWizardInit(initialExperience); setShowWizard(true) }
  const openConfigTrainingCamp = () => { setShowTrainingCamp(true) }

  // PLAN-LEAGUE-CONTEXT-01.1 §5: al cambiar de liga se conserva la vista activa.
  // Prioridad: el `page` de la ruta actual (URL = fuente de verdad, funciona
  // también en entradas directas #/league/:id/picks). Fallback a `activePage`
  // (legacy #picks/#board/...). Training solo se conserva si la liga destino
  // es practice.
  const viewForActivePage = (page, lg) => {
    if (page === 'picks') return 'picks'
    if (page === 'board') return 'standings'
    if (page === 'publicpicks') return 'publicpicks'
    const practice = !!(lg && (lg.league_mode === 'practice' || lg.simulation))
    if (page === 'training' && practice) return 'training'
    return 'league'
  }
  const preserveLeagueView = (lg) => {
    if (route && route.type === 'league' && route.page) {
      const practice = !!(lg && (lg.league_mode === 'practice' || lg.simulation))
      if (route.page === 'training' && !practice) return 'league'
      return route.page
    }
    return viewForActivePage(activePage, lg)
  }

  const renderLeagueView = (league) => {
    const p = { user, league, onNavigate: handleNavigate, onChangeLeague: handleChangeLeague }
    const page = route && route.page
    if (page === 'picks') return <Picks {...p} />
    // PLAN-LEAGUE-CONTEXT-01.1 §6: standings despacha por tipo de liga
    // (practice → jornada del Training Camp; season → Leaderboard legacy).
    if (page === 'standings') return <LeagueStandings {...p} />
    if (page === 'publicpicks') return <PublicPicks {...p} />
    if (page === 'training') return <TrainingCamp key={lobbyVersion} {...p} onConfigure={openConfigTrainingCamp} />
    return <LeaguePage {...p} />
  }

  const renderPage = () => {
    const home = (
      <Home
        user={user}
        myLeagues={myLeagues}
        currentLeague={currentLeague}
        loadingLeagues={loadingLeagues}
        onNavigate={handleNavigate}
        onCreateNew={() => openWizard()}
        onJoinClick={() => setShowJoin(true)}
         onEnterLeague={(lg) => {
           enterLeague(lg)
           setActiveLeague(lg.id, 'league')
         }}
        onRefreshLeagues={fetchMyLeagues}
        onCreateTrainingCamp={() => openWizard('practice')}
      />
    )

    // BUILD-SUP-000/002/003: rutas de plataforma con deny explícito (nada de
    // drops silenciosos). Gate por isSuperAdmin (claim JWT, fallback legacy).
    // League Admin / usuario normal → PlatformDenied. platform_admin queda
    // dormante (0 usuarios): no se amplía el gate.
    if (route && (
      route.type === 'superadmin' ||
      route.type === 'platform' ||
      route.type === 'platformLeagues' ||
      route.type === 'platformLeague' ||
      route.type === 'platformUsers' ||
      route.type === 'platformUser'
    )) {
      if (!isSuperAdmin) return <PlatformDenied onNavigate={handleNavigate} />
      if (route.type === 'superadmin') return <SuperAdmin />
      if (route.type === 'platform') return <PlatformOverview />
      if (route.type === 'platformLeague') return <PlatformLeagueDetail leagueId={route.leagueId} />
      if (route.type === 'platformUser') return <PlatformUserDetail userId={route.userId} />
      if (route.type === 'platformUsers') return <PlatformUsers />
      return <PlatformLeagues />
    }

    // Hub: el dashboard muestra TODAS las ligas (fuente de verdad = ruta).
    if (route && route.type === 'dashboard') return home

    // Ruta de liga por URL (PLAN-LEAGUE-CONTEXT, Fases 1-3):
    // #/league/:leagueId[/picks|standings|publicpicks|training]. LeagueRoute
    // valida membership; key={leagueId} da remount limpio al cambiar de liga.
    if (route && route.type === 'league' && route.leagueId) {
      return (
        <LeagueRoute key={route.leagueId}>
          {({ league }) => renderLeagueView(league)}
        </LeagueRoute>
      )
    }

    if (activePage === 'dashboard') return home

    if (!currentLeague) {
      return (
        <div className="page">
          <div className="page-title">{t(PAGE_KEYS[activePage] || 'app.name')}</div>
          <div className="empty-state">
            <div className="big">🏟️</div>
            {t('topbar.needLeague')}
          </div>
        </div>
      )
    }

    const p = { user, league: currentLeague, onNavigate: handleNavigate, onChangeLeague: handleChangeLeague }
    if (activePage === 'picks') return <Picks {...p} />
    if (activePage === 'board') return <LeagueStandings {...p} />
    if (activePage === 'publicpicks') return <PublicPicks {...p} />
    if (activePage === 'league') return <LeaguePage {...p} />
    if (activePage === 'training') return <TrainingCamp key={lobbyVersion} {...p} onConfigure={openConfigTrainingCamp} />
    return home
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar
        user={user}
        league={effectiveLeague}
        myLeagues={myLeagues}
        activePage={activePage}
        onNavigate={handleNavigate}
        onChangeLeague={handleChangeLeague}
        onSelectLeague={(lg) => {
          enterLeague(lg)
          setActiveLeague(lg.id, preserveLeagueView(lg))
        }}
        onLogout={signOut}
        isSuperAdmin={isSuperAdmin}
        onCreateNew={() => openWizard()}
        onCreateSimulation={() => setShowSimulation(true)}
        onCreateTrainingCamp={() => openWizard('practice')}
        route={route}
      />

      <main style={{ flex: 1, paddingBottom: '64px' }}>
        {renderPage()}
      </main>

      <BottomNav
        activePage={activePage}
        onNavigate={handleNavigate}
        isSuperAdmin={isSuperAdmin}
        isPractice={!!effectiveLeague && (effectiveLeague.league_mode === 'practice' || effectiveLeague.simulation)}
      />

      {showWizard && (
        <ExperienceWizard
          initialExperience={wizardInit}
          onClose={() => setShowWizard(false)}
          onCreateLeague={createLeague}
          onCreateTrainingCamp={(cfg) => createTrainingCamp(cfg.name, cfg)}
          onEnterLeague={(lg, experience) => {
            setShowWizard(false)
            enterLeague(lg)
            // PLAN-LEAGUE-CONTEXT-01.1: la entrada establece la URL (fuente de
            // verdad). Practice → lobby del Training Camp; season → home de la liga.
            setActiveLeague(lg.id, experience === 'practice' ? 'training' : 'league')
          }}
        />
      )}

      {showJoin && <JoinLeagueModal
        onClose={() => setShowJoin(false)}
        onJoin={joinByCode}
        onEnter={(lg) => { enterLeague(lg); setActiveLeague(lg.id); setShowJoin(false) }}
      />}

      {showSimulation && (
        <CreateSimulationModal
          onClose={() => setShowSimulation(false)}
          onCreateSimulation={createSimulationLeague}
          onEnterLeague={(lg) => { enterLeague(lg); setActiveLeague(lg.id); setShowSimulation(false) }}
        />
      )}

      {showTrainingCamp && (
        <TrainingCampSetupModal
          mode="config"
          initialName={currentLeague?.name}
          onClose={() => setShowTrainingCamp(false)}
          onCreate={(cfg) => configureTrainingCamp(currentLeague, cfg)}
          onDone={() => {
            setShowTrainingCamp(false)
            setLobbyVersion(v => v + 1)
          }}
        />
      )}
    </div>
  )
}

function JoinLeagueModal({ onClose, onJoin, onEnter }) {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleJoin = async () => {
    if (code.length !== 6) return setMsg({ type: 'error', text: 'El código debe tener 6 caracteres.' })
    setJoining(true)
    setMsg(null)
    const { data, error, alreadyMember } = await onJoin(code)
    setJoining(false)
    if (error) {
      // BUILD-TC-005.4 — el servicio rechaza con `error.message` la liga cuyo
      // roster ya cerró (canJoinLeague): "Esta liga ya comenzó y no acepta
      // nuevos jugadores." También deja `error.code === 'roster_closed'` para
      // manejo programático. El modal es español, igual que el resto.
      setMsg({ type: 'error', text: error.message })
      return
    }
    if (alreadyMember) {
      setMsg({ type: 'info', text: 'Ya eres miembro. Entrando...' })
    } else {
      setMsg({ type: 'success', text: `✅ ¡Te uniste a ${data.name}!` })
    }
    setTimeout(() => { if (data) onEnter(data) }, 1200)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--r-xl)',
        padding: '1.75rem 1.5rem',
        width: '100%', maxWidth: '400px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', letterSpacing: '.06em' }}>
            🔗 Unirse a una Liga
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text3)',
              fontSize: '1.2rem', cursor: 'pointer', padding: '4px',
            }}
          >✕</button>
        </div>

        <p style={{ fontSize: '.85rem', color: 'var(--text2)', marginBottom: '1rem' }}>
          Ingresá el código de invitación de 6 letras.
        </p>

        <input
          type="text"
          placeholder="Código de 6 letras"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          autoFocus
          style={{
            width: '100%', padding: '.8rem 1rem',
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            borderRadius: 'var(--r-sm)', color: 'var(--text)',
            fontSize: '1rem', outline: 'none', textTransform: 'uppercase',
            letterSpacing: '.12em', marginBottom: '1rem',
            boxSizing: 'border-box',
          }}
        />

        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={handleJoin}
          disabled={joining}
        >
          {joining ? '...' : 'Unirme'}
        </button>

        {msg && (
          <div className={`msg ${msg.type}`} style={{ marginTop: '0.75rem' }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}
