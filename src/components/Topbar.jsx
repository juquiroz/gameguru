import styles from './Topbar.module.css'

export default function Topbar({ user, league, onChangeLeague, onLogout, activePage, onNavigate, isSuperAdmin }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'picks',     label: 'Mis Picks' },
    { id: 'board',     label: 'Tabla'     },
    { id: 'league',    label: 'Mi Liga'   },
  ]

  return (
    <header className={styles.topbar}>
      <span className={styles.brand}>GameGuru</span>

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
            ⚙️ Admin
          </button>
        )}
      </nav>

      <div className={styles.right}>
        {league && (
          <>
            <span className={styles.leagueName}>{league.name}</span>
            <button className={styles.changeBtn} onClick={onChangeLeague}>Cambiar</button>
          </>
        )}
        <span className={styles.userName}>{user?.email?.split('@')[0]}</span>
        <button className={styles.logoutBtn} onClick={onLogout}>Salir</button>
      </div>
    </header>
  )
}
