import { useState } from 'react'
import { SPORTS, NFL_TEAMS, NFL_WEEKS } from '../data/nflData'
import { leaguesApi } from '../supabase'
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
    const { error } = await leaguesApi.delete(league.id)
    if (error) { alert('Error: ' + error.message); return }
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

function LeagueDashboard({ user, league }) {
  const weekNum = 1
  const week = NFL_WEEKS[weekNum]

  const mockRows = [
    { userId: 'me', username: user?.email?.split('@')[0] || 'Tú', correct: 7, total: 8 },
    { userId: 'u2', username: 'carlos.m', correct: 6, total: 8 },
    { userId: 'u3', username: 'juan.p', correct: 6, total: 8 },
    { userId: 'u4', username: 'andrea.v', correct: 5, total: 8 },
    { userId: 'u5', username: 'rob.c', correct: 4, total: 8 },
  ]

  const myRow = mockRows[0]
  const pct = Math.round((myRow.correct / myRow.total) * 100)

  return (
    <div className={styles.wrap}>
      <div className={styles.heroTight}>
        <div className={styles.leagueHeader}>
          <div>
            <div className={styles.leagueTitle}>{league.name}</div>
            <div className={styles.leagueMeta}>
              {SPORTS.find(s => s.id === league.sport)?.icon} {league.sport} · Temporada 2026
            </div>
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Mi Posición</div>
          <div className={styles.statVal} style={{ color: 'var(--accent)' }}>#1</div>
          <div className={styles.statSub}>de {mockRows.length} jugadores</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Aciertos Sem {weekNum}</div>
          <div className={styles.statVal} style={{ color: 'var(--green)' }}>{myRow.correct}</div>
          <div className={styles.statSub}>de {myRow.total} partidos</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Efectividad</div>
          <div className={styles.statVal}>{pct}%</div>
          <div className={styles.statSub}>Semana {weekNum}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Semana Activa</div>
          <div className={styles.statVal} style={{ color: 'var(--accent)' }}>{weekNum}</div>
          <div className={styles.statSub}>{week?.games?.length || 0} partidos</div>
        </div>
      </div>

      <div className={styles.alertCard}>
        <span className={styles.alertIcon}>🏈</span>
        <div className={styles.alertBody}>
          <div className={styles.alertTitle}>
            <strong>Semana {weekNum}</strong> está activa
          </div>
          <div className={styles.alertSub}>
            {week?.games?.length || 0} partidos · Deadline: {week?.deadline || '—'}
          </div>
        </div>
      </div>

      <div className={styles.sectionTitle}>📊 Top Jugadores · Semana {weekNum}</div>
      {mockRows.map((r, i) => (
        <div
          key={r.userId}
          className={`${styles.leaderRow} ${r.userId === 'me' ? styles.leaderMe : ''}`}
        >
          <span className={styles.leaderRank}>
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
          </span>
          <span className={styles.leaderName}>{r.username}</span>
          <span className={styles.leaderScore}>
            {r.correct}/{r.total}
            <span className={styles.leaderPct}>
              {' '}({Math.round((r.correct / r.total) * 100)}%)
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Home({ user, myLeagues, currentLeague, loadingLeagues, onCreateNew, onJoinClick, onEnterLeague, onRefreshLeagues }) {
  if (loadingLeagues) {
    return (
      <div className={styles.wrap}>
        <div className={styles.loading}>Cargando...</div>
      </div>
    )
  }

  if (currentLeague) {
    return <LeagueDashboard user={user} league={currentLeague} />
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
