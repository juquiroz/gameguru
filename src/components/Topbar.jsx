import { useLanguage } from '../i18n/context'
import LanguageSwitch from './LanguageSwitch'
import styles from './Topbar.module.css'

export default function Topbar({ user, league, onChangeLeague, onLogout, activePage, onNavigate, isSuperAdmin, onCreateNew, onCreateSimulation }) {
  const { t } = useLanguage()

  const navItems = [
    { id: 'dashboard',   label: t('topbar.dashboard') },
    { id: 'picks',       label: t('topbar.picks') },
    { id: 'board',       label: t('topbar.board') },
    { id: 'league',      label: t('topbar.league') },
  ]

  return (
    <header className={styles.topbar}>
      <button
        className={styles.brand}
        onClick={() => { if (league) onNavigate('dashboard') }}
        title={t('topbar.home')}
      >{t('topbar.brand')}</button>

      {league && (
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
      )}

      <div className={styles.right}>
        {league && (
          <>
            <span className={styles.leagueName}>{league.name}</span>
            <button className={styles.changeBtn} onClick={onChangeLeague}>{t('topbar.myLeagues')}</button>
          </>
        )}
        <button className={styles.createBtn} onClick={onCreateNew}>{t('topbar.create')}</button>
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
