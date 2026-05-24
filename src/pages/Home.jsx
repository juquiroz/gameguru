import { useState, useEffect } from 'react'
import { SPORTS, NFL_TEAMS, NFL_WEEKS } from '../data/nflData'
import { leaguesApi, leagueGamesApi } from '../supabase'
import TeamLogo from '../components/TeamLogo'
import styles from './Home.module.css'

const WEEKLY_GAMES = NFL_WEEKS[1]

function NewUserHome({ onCreateNew, onJoinClick }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <div className={styles.heroBrand}>GameGuru</div>
        <p className={styles.heroSub}>
          Tu pool de pronósticos deportivos. Crea una liga, invita a tus amigos y
          demuestra quién sabe más de la NFL.
        </p>
      </div>

      <div className={styles.features}>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🏆</span>
          <span className={styles.featureTitle}>Crea tu liga</span>
          <span className={styles.featureDesc}>Armá tu pool personalizado en segundos.</span>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>📨</span>
          <span className={styles.featureTitle}>Invita amigos</span>
          <span className={styles.featureDesc}>Compartí el código y que se unan al instante.</span>
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🏅</span>
          <span className={styles.featureTitle}>Gana el pool</span>
          <span className={styles.featureDesc}>Más aciertos = más gloria (y bragging rights).</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={onCreateNew}>
          ➕ Crear mi primera liga
        </button>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onJoinClick}>
          🔗 Unirme a una liga
        </button>
      </div>

      <div className={styles.preview}>
        <div className={styles.previewTitle}>📅 Partidos de la Semana 1</div>
        <div className={styles.gameList}>
          {WEEKLY_GAMES.games.slice(0, 4).map(g => (
            <div key={g.id} className={styles.gameCard}>
              <span className={styles.gameTeam}>
                <TeamLogo abbr={g.aA} size={18} />
                {g.away}
              </span>
              <span className={styles.gameVs}>@</span>
              <span className={styles.gameTeam}>
                <TeamLogo abbr={g.hA} size={18} />
                {g.home}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LeaguesOverview({ myLeagues, user, onEnterLeague, onRefreshLeagues, onCreateNew, onJoinClick }) {
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
          const isAdmin = lg.role === 'admin' || lg.admin_id === user?.id

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

function LeagueDashboard({ user, league, onNavigate }) {
  const weekNum = 1
  const week = NFL_WEEKS[weekNum]
  const [leagueGames, setLeagueGames] = useState(null)
  const [loadingGames, setLoadingGames] = useState(false)
  const isAdmin = league.admin_id === user?.id || league.role === 'admin'

  useEffect(() => {
    if (!league) return
    setLoadingGames(true)
    leagueGamesApi.getForLeague(league.id).then(({ data, error }) => {
      if (!error && data?.length) setLeagueGames(data)
      else setLeagueGames(null)
      setLoadingGames(false)
    })
  }, [league])

  const hasCustomGames = leagueGames && leagueGames.length > 0
  const totalGames = leagueGames?.length || week?.games?.length || 0
  const finishedGames = leagueGames?.filter(g => g.finished)?.length || 0
  const pendingResults = leagueGames?.filter(g => !g.finished)?.length || 0

  return (
    <div className={styles.wrap}>
      <div className={styles.heroTight}>
        <div className={styles.leagueHeader}>
          <div>
            <div className={styles.leagueTitle}>
              {league.name}
              {league.simulation && (
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase',
                  background: 'rgba(245,166,35,.15)', color: 'var(--accent)',
                  border: '1px solid rgba(245,166,35,.3)', borderRadius: '4px',
                  padding: '2px 7px', marginLeft: '.5rem', verticalAlign: 'middle',
                }}>🧪 Simulación</span>
              )}
            </div>
            <div className={styles.leagueMeta}>
              {SPORTS.find(s => s.id === league.sport)?.icon} {league.sport} · Temporada 2026
            </div>
          </div>
        </div>
      </div>

      {/* Código de invitación */}
      <div className={styles.inviteBox}>
        <div className={styles.inviteLabel}>Código de invitación</div>
        <div className={styles.inviteCode}>{league.code}</div>
        <button
          className={styles.inviteCopy}
          onClick={() => {
            const link = `${window.location.origin}/gameguru/?join=${league.code}`
            navigator.clipboard.writeText(link)
            alert('Enlace copiado al portapapeles')
          }}
        >📋 Copiar enlace</button>
      </div>

      {/* Games summary */}
      <div className={styles.alertCard}>
        <span className={styles.alertIcon}>🏈</span>
        <div className={styles.alertBody}>
          <div className={styles.alertTitle}>
            <strong>Semana {weekNum}</strong> — {hasCustomGames ? 'Juegos de simulación' : (week?.label || 'por comenzar')}
          </div>
          <div className={styles.alertSub}>
            {loadingGames ? 'Cargando...' : `${totalGames} partidos${finishedGames > 0 ? ` · ${finishedGames} finalizados` : ''}${pendingResults > 0 ? ` · ${pendingResults} pendientes` : ''}`}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className={styles.quickActions}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={() => onNavigate('picks')}>
          🏈 Hacer Picks
        </button>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onNavigate('league')}>
          ⚙️ Administrar Liga
        </button>
      </div>

      {isAdmin && hasCustomGames && pendingResults > 0 && (
        <div className={styles.quickActions}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => onNavigate('league')}>
            🏆 Ingresar resultados ({pendingResults} pendientes)
          </button>
        </div>
      )}

      {/* Empty state - no picks yet */}
      <div className={styles.emptySection}>
        <div className={styles.emptyIcon}>📭</div>
        <div className={styles.emptyTitle}>Aún no hay actividad</div>
        <div className={styles.emptyDesc}>
          Cuando los miembros comiencen a enviar sus picks, aquí aparecerán las
          posiciones y estadísticas de la liga.
        </div>
      </div>
    </div>
  )
}

export default function Home({ user, myLeagues, currentLeague, loadingLeagues, onCreateNew, onJoinClick, onEnterLeague, onRefreshLeagues, onNavigate }) {
  if (loadingLeagues) {
    return (
      <div className={styles.wrap}>
        <div className={styles.loading}>Cargando...</div>
      </div>
    )
  }

  if (currentLeague) {
    return <LeagueDashboard user={user} league={currentLeague} onNavigate={onNavigate} />
  }

  if (myLeagues.length > 0) {
    return (
      <LeaguesOverview
        myLeagues={myLeagues}
        user={user}
        onEnterLeague={onEnterLeague}
        onRefreshLeagues={onRefreshLeagues}
        onCreateNew={onCreateNew}
        onJoinClick={onJoinClick}
      />
    )
  }

  return <NewUserHome onCreateNew={onCreateNew} onJoinClick={onJoinClick} />
}
