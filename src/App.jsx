import { useState, useEffect } from 'react'
import { useAuth }   from './hooks/useAuth'
import { useLeague } from './hooks/useLeague'
import { useSuperAdmin } from './hooks/useSuperAdmin'
import { LangProvider, useLanguage } from './i18n/context'

import Auth        from './pages/Auth'
import Home        from './pages/Home'
import Picks       from './pages/Picks'
import Leaderboard from './pages/Leaderboard'
import PublicPicks from './pages/PublicPicks'
import LeaguePage  from './pages/LeaguePage'
import SuperAdmin  from './pages/SuperAdmin'
import TrainingCamp from './pages/TrainingCamp'
import Topbar      from './components/Topbar'
import BottomNav   from './components/BottomNav'
import CreateSimulationModal from './components/CreateSimulationModal'
import ExperienceWizard from './domains/experience/components/ExperienceWizard'
import TrainingCampSetupModal from './domains/training/components/TrainingCampSetupModal'

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  )
}

function AppInner() {
  const [activePage, setActivePage] = useState('dashboard')
  const [showWizard, setShowWizard] = useState(false)
  const [wizardInit, setWizardInit] = useState(null)
  const [showJoin,   setShowJoin]   = useState(false)
  const [showSimulation, setShowSimulation] = useState(false)
  const [showTrainingCamp, setShowTrainingCamp] = useState(false)
  const [lobbyVersion, setLobbyVersion] = useState(0)
  const { t } = useLanguage()

  const PAGE_KEYS = {
    dashboard: 'topbar.dashboard',
    picks: 'topbar.picks',
    board: 'topbar.board',
    publicpicks: 'Picks Públicos',
    league: 'topbar.league',
    training: 'training.name',
    superadmin: 'superadmin.title',
  }

  const { user, loading, signIn, signUp, signOut } = useAuth()
  const { isSuperAdmin, checking: adminChecking } = useSuperAdmin(user)

  const {
    myLeagues,
    currentLeague,
    loadingLeagues,
    fetchMyLeagues,
    createLeague,
    createSimulationLeague,
    createTrainingCamp,
    configureTrainingCamp,
    joinByCode,
    enterLeague,
    leaveCurrentLeague,
  } = useLeague(user)

  // Sync URL with active page
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && hash !== activePage) {
      setActivePage(hash)
    }
  }, [])

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

  const pageProps = { user, onNavigate: handleNavigate, onChangeLeague: handleChangeLeague }

  const renderPage = () => {
    if (activePage === 'superadmin' && isSuperAdmin) return <SuperAdmin />

    const home = (
      <Home
        user={user}
        myLeagues={myLeagues}
        currentLeague={currentLeague}
        loadingLeagues={loadingLeagues}
        onNavigate={handleNavigate}
        onCreateNew={() => openWizard()}
        onJoinClick={() => setShowJoin(true)}
        onEnterLeague={(lg) => { enterLeague(lg); handleNavigate('dashboard') }}
        onRefreshLeagues={fetchMyLeagues}
        onCreateTrainingCamp={() => openWizard('practice')}
      />
    )

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
    if (activePage === 'board') return <Leaderboard {...p} />
    if (activePage === 'publicpicks') return <PublicPicks {...p} />
    if (activePage === 'league') return <LeaguePage {...p} />
    if (activePage === 'training') return <TrainingCamp key={lobbyVersion} {...p} onConfigure={openConfigTrainingCamp} />
    return home
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar
        user={user}
        league={currentLeague}
        activePage={activePage}
        onNavigate={handleNavigate}
        onChangeLeague={handleChangeLeague}
        onLogout={signOut}
        isSuperAdmin={isSuperAdmin}
        onCreateNew={() => openWizard()}
        onCreateSimulation={() => setShowSimulation(true)}
        onCreateTrainingCamp={() => openWizard('practice')}
      />

      <main style={{ flex: 1, paddingBottom: '64px' }}>
        {renderPage()}
      </main>

      <BottomNav
        activePage={activePage}
        onNavigate={handleNavigate}
        isSuperAdmin={isSuperAdmin}
        isPractice={!!currentLeague && (currentLeague.league_mode === 'practice' || currentLeague.simulation)}
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
            handleNavigate(experience === 'practice' ? 'training' : 'dashboard')
          }}
        />
      )}

      {showJoin && <JoinLeagueModal
        onClose={() => setShowJoin(false)}
        onJoin={joinByCode}
        onEnter={(lg) => { enterLeague(lg); handleNavigate('dashboard'); setShowJoin(false) }}
      />}

      {showSimulation && (
        <CreateSimulationModal
          onClose={() => setShowSimulation(false)}
          onCreateSimulation={createSimulationLeague}
          onEnterLeague={(lg) => { enterLeague(lg); handleNavigate('dashboard'); setShowSimulation(false) }}
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
    if (error) { setMsg({ type: 'error', text: error.message }); return }
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
