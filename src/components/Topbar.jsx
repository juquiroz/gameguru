import { useLanguage } from '../i18n/context'
import LanguageSwitch from './LanguageSwitch'
import styles from './Topbar.module.css'

export default function Topbar({ user, league, myLeagues, onChangeLeague, onSelectLeague, onLogout, activePage, onNavigate, isSuperAdmin, onCreateNew, onCreateSimulation, onCreateTrainingCamp }) {
  const { t } = useLanguage()
  const isPractice = league && (league.league_mode === 'practice' || league.simulation)

  const navItems = [
    { id: 'dashboard',   label: t('topbar.dashboard') },
    { id: 'picks',       label: t('topbar.picks') },
    { id: 'board',       label: t('topbar.board') },
    { id: 'league',      label: t('topbar.league') },
    ...(isPractice ? [{ id: 'training', label: '🎓 Training Camp' }] : []),
  ]

  // PLAN-LEAGUE-CONTEXT-01.1 §5: LeagueSelector mínimo. Cambia de liga
  // preservando la vista activa (el callback decide el `page` del URL).
  const handleLeagueChange = (e) => {
    const id = e.target.value
    if (!id) return
    const lg = (myLeagues || []).find(l => l && l.id === id)
    if (lg) onSelectLeague(lg)
  }

  return (
    <header className={styles.topbar}>
      <button
        className={styles.brand}
        onClick={() => { if (league) onNavigate('dashboard') }}
        title={t('topbar.home')}
      >{t('topbar.brand')}</button>

      <nav className={styles.desktopNav}>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`${styles.navBtn} ${activePage === item.id ? styles.active : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
        {isSuperAdmin && (
          <button
            className={`${styles.navBtn} ${styles.adminNav} ${activePage === 'superadmin' ? styles.active : ''}`}
            onClick={() => onNavigate('superadmin')}
          >
            ⚙️ {t('topbar.admin')}
          </button>
        )}
      </nav>

      <div className={styles.right}>
        {league && (
          <>
            <select
              className={styles.leagueSelect}
              value={league.id}
              onChange={handleLeagueChange}
              title={t('topbar.switchLeague')}
            >
              {(myLeagues || []).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <button className={styles.changeBtn} onClick={onChangeLeague}>{t('topbar.myLeagues')}</button>
          </>
        )}
        <button className={styles.createBtn} onClick={onCreateNew}>{t('topbar.create')}</button>
        <button
          className={styles.createBtn}
          onClick={() => isPractice ? onNavigate('training') : onCreateTrainingCamp()}
          style={{ borderColor: 'var(--mode-tc, #3B82F6)', color: 'var(--mode-tc, #3B82F6)' }}
        >
          {t('training.cta')}
        </button>
        {isSuperAdmin && (
          <button className={styles.createBtn} onClick={onCreateSimulation} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            🧪 Simular
          </button>
        )}
        <LanguageSwitch />
        <span className={styles.userName}>{user?.email?.split('@')[0]}</span>
        <button className={styles.logoutBtn} onClick={onLogout}>{t('topbar.logout')}</button>
      </div>
    </header>
  )
}
