import styles from './BottomNav.module.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Inicio',  icon: '🏠' },
  { id: 'picks',     label: 'Picks',   icon: '🏈' },
  { id: 'board',     label: 'Tabla',   icon: '🏆' },
  { id: 'league',    label: 'Liga',    icon: '⚙️' },
]

export default function BottomNav({ activePage, onNavigate }) {
  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`${styles.btn} ${activePage === item.id ? styles.active : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className={styles.icon}>{item.icon}</span>
          <span className={styles.label}>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
