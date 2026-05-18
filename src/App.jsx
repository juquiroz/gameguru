import { useState, useEffect } from 'react'
import { useAuth }   from './hooks/useAuth'
import { useLeague } from './hooks/useLeague'
import { useSuperAdmin } from './hooks/useSuperAdmin'

import Auth        from './pages/Auth'
import Lobby       from './pages/Lobby'
import Dashboard   from './pages/Dashboard'
import Picks       from './pages/Picks'
import Leaderboard from './pages/Leaderboard'
import LeaguePage  from './pages/LeaguePage'
import SuperAdmin  from './pages/SuperAdmin'
import Topbar      from './components/Topbar'
import BottomNav   from './components/BottomNav'

const PAGE_TITLES = {
  dashboard:  'Dashboard',
  picks:      'Mis Picks',
  board:      'Tabla de Posiciones',
  league:     'Mi Liga',
  superadmin: 'Admin Global',
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')

  const { user, loading, signIn, signUp, signOut } = useAuth()
  const { isSuperAdmin, checking: adminChecking } = useSuperAdmin(user)

  const {
    myLeagues,
    currentLeague,
    loadingLeagues,
    createLeague,
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
    document.title = `${PAGE_TITLES[page] || 'GameGuru'} · GameGuru`
  }

  const handleChangeLeague = () => {
    leaveCurrentLeague()
    handleNavigate('dashboard')
  }

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
          Cargando...
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth onAuth={{ signIn, signUp }} />
  }

  if (!currentLeague) {
    return (
      <Lobby
        user={user}
        myLeagues={myLeagues}
        loadingLeagues={loadingLeagues}
        onCreateLeague={createLeague}
        onJoinLeague={joinByCode}
        onEnterLeague={(lg) => { enterLeague(lg); handleNavigate('dashboard') }}
      />
    )
  }

  const pageProps = { user, league: currentLeague, onNavigate: handleNavigate }

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
      />

      <main style={{ flex: 1, paddingBottom: '64px' }}>
        {activePage === 'superadmin' && isSuperAdmin ? (
          <SuperAdmin />
        ) : activePage === 'dashboard' ? (
          <Dashboard {...pageProps} />
        ) : activePage === 'picks' ? (
          <Picks {...pageProps} />
        ) : activePage === 'board' ? (
          <Leaderboard {...pageProps} />
        ) : activePage === 'league' ? (
          <LeaguePage {...pageProps} />
        ) : (
          <Dashboard {...pageProps} />
        )}
      </main>

      <BottomNav activePage={activePage} onNavigate={handleNavigate} isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
