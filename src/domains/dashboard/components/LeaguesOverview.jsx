import { SPORTS } from '../../../data/nflData'
import { leaguesApi } from '../../../supabase'
import { canManageLeague } from '../../platform'
import styles from '../../../pages/Home.module.css'

export default function LeaguesOverview({ myLeagues, user, onEnterLeague, onRefreshLeagues, onCreateNew, onJoinClick }) {
  const handleDelete = async (e, league) => {
    e.stopPropagation()
    if (!window.confirm(`¿Eliminar la liga "${league.name}"? Esta acción no se puede deshacer.`)) return
    if (!window.confirm('¿Estás seguro? Se borrarán todos los picks y datos asociados.')) return
    try {
      const { error } = await leaguesApi.delete(league.id)
      if (error) { alert('Error: ' + error.message); return }
    } catch (ex) {
      console.error('Home handleDelete excepción:', ex)
      alert('Error inesperado: ' + (ex?.message || 'desconocido'))
      return
    }
    onRefreshLeagues()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <div className={styles.heroBrandTight}>🏆 Mis Ligas</div>
      </div>

      <div className={styles.leagueGrid}>
        {myLeagues.map(lg => {
          const sportIcon = SPORTS.find(s => s.id === lg.sport)?.icon || '🏆'
          const isAdmin = canManageLeague(lg, user)

          return (
            <div
              key={lg.id}
              className={styles.leagueCard}
              role="button"
              tabIndex={0}
              onClick={() => onEnterLeague(lg)}
              onKeyDown={e => e.key === 'Enter' && onEnterLeague(lg)}
            >
              <div className={styles.leagueCardTop}>
                <span className={styles.leagueCardIcon}>{sportIcon}</span>
                <div className={styles.leagueCardInfo}>
                  <div className={styles.leagueCardName}>{lg.name}</div>
                  <div className={styles.leagueCardMeta}>
                    {lg.sport} · {lg.code}
                  </div>
                </div>
                {lg.simulation && <span className={styles.adminBadge} style={{ background: 'rgba(245,166,35,.15)', color: 'var(--accent)' }}>🧪 Sim</span>}
                {isAdmin && <span className={styles.adminBadge}>Admin</span>}
                {isAdmin && (
                  <button
                    className={styles.deleteBtn}
                    onClick={e => handleDelete(e, lg)}
                    title="Eliminar liga"
                  >✕</button>
                )}
                <span className={styles.arrow}>›</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.actions}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={onCreateNew}>
          ➕ Crear liga
        </button>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onJoinClick}>
          🔗 Unirse
        </button>
      </div>
    </div>
  )
}
