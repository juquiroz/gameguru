import { useState, useEffect, useCallback } from 'react'
import { platformApi } from '../supabase'
import {
  computeOverviewMetrics,
  computeHealthSummary,
  computeTodayGames,
  computeUserOverview,
  HEALTH_STATUS,
} from '../domains/platform'
import { navigate, platformLeaguesRoute, platformUsersRoute } from '../router/routes'
import styles from './PlatformOverview.module.css'

// BUILD-SUP-001 — Consola de plataforma (read-only).
// La UI NO define métricas: todas las agregaciones viven en el dominio
// (src/domains/platform/models/overview.js) y son puras/testables.
export default function PlatformOverview() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    const { data, error } = await platformApi.overview()
    if (error) setError(error)
    else setRows(data)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (error) {
    return (
      <div className="page">
        <div className="page-title">Consola de Plataforma</div>
        <div className="msg error">Error al cargar el Overview: {error.message}</div>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="page">
        <div className="empty-state"><div className="big">⏳</div>Cargando Overview...</div>
      </div>
    )
  }

  const metrics = computeOverviewMetrics({ ...rows, now: new Date() })
  const health = computeHealthSummary(rows)
  const today = computeTodayGames({ leagueGames: rows.leagueGames, leagues: rows.leagues, now: new Date() })
  const users = computeUserOverview(rows)

  const healthLabel =
    health.status === HEALTH_STATUS.ERROR ? 'Con errores' :
    health.status === HEALTH_STATUS.WARNING ? 'Con advertencias' : 'Saludable'
  const healthClass =
    health.status === HEALTH_STATUS.ERROR ? styles.error :
    health.status === HEALTH_STATUS.WARNING ? styles.warning : styles.healthy

  const stat = (label, value) => (
    <div className={styles.stat}>
      <span className={styles.statVal}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )

  const breakdown = (obj) =>
    Object.entries(obj).map(([k, v]) => (
      <span key={k} className={styles.chip}>{k}: {v}</span>
    ))

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <div className="page-title">Consola de Plataforma</div>
          <div className="page-sub">Overview del sistema (solo lectura)</div>
        </div>
        <div className={styles.headerActions}>
          <span className={`${styles.health} ${healthClass}`}>{healthLabel}</span>
          <button className="btn-secondary" onClick={load} disabled={refreshing}>
            {refreshing ? 'Cargando...' : '⟳ Actualizar'}
          </button>
          <button className="btn-secondary" onClick={() => navigate(platformLeaguesRoute())}>
            Ligas →
          </button>
          <button className="btn-secondary" onClick={() => navigate(platformUsersRoute())}>
            Usuarios →
          </button>
        </div>
      </div>

      <div className={styles.statsBar}>
        {stat('Ligas', metrics.totalLeagues)}
        {stat('Ligas activas', metrics.activeLeagues)}
        {stat('Usuarios', metrics.totalUsers)}
        {stat('Usuarios activos', metrics.activeUsers)}
        {stat('Partidos hoy', metrics.todayGames)}
        {stat('Partidos maestros', metrics.totalMasterGames)}
      </div>

      <div className={styles.breakdowns}>
        <div className={styles.breakdown}>
          <div className={styles.breakdownTitle}>Ligas por deporte</div>
          <div className={styles.chips}>{breakdown(metrics.leaguesBySport)}</div>
        </div>
        <div className={styles.breakdown}>
          <div className={styles.breakdownTitle}>Ligas por temporada</div>
          <div className={styles.chips}>{breakdown(metrics.leaguesBySeason)}</div>
        </div>
        <div className={styles.breakdown}>
          <div className={styles.breakdownTitle}>Ligas por modo</div>
          <div className={styles.chips}>{breakdown(metrics.leaguesByMode)}</div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>📅 Partidos de hoy ({today.total})</div>
          {Object.values(today.byLeague).length === 0 ? (
            <div className={styles.cardEmpty}>Sin partidos hoy.</div>
          ) : (
            Object.values(today.byLeague).map((l) => (
              <div key={l.leagueId} className={styles.row}>
                <span className={styles.rowName}>{l.name}</span>
                <span className={styles.rowMeta}>{l.timezone}</span>
                <span className={styles.rowCount}>{l.count}</span>
              </div>
            ))
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>🩺 Salud ({health.status})</div>
          {health.errors.length === 0 && health.warnings.length === 0 ? (
            <div className={styles.cardEmpty}>Sin incidencias.</div>
          ) : (
            <>
              {health.errors.map((e, i) => (
                <div key={`e${i}`} className={`${styles.issue} ${styles.issueError}`}>
                  {e.name ? `${e.name}: ` : ''}{e.message}
                  {typeof e.count === 'number' ? ` (${e.count})` : ''}
                </div>
              ))}
              {health.warnings.map((w, i) => (
                <div key={`w${i}`} className={`${styles.issue} ${styles.issueWarning}`}>
                  {w.name ? `${w.name}: ` : ''}{w.message}
                  {typeof w.count === 'number' ? ` (${w.count})` : ''}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>👥 Usuarios ({users.total})</div>
        <div className={styles.chips}>
          <span className={styles.chip}>En ligas: {users.withLeagues}</span>
          <span className={styles.chip}>Sin ligas: {users.withoutLeagues}</span>
          <span className={styles.chip}>Con picks: {users.withPicks}</span>
          <span className={styles.chip}>Superadmins: {users.superAdmins}</span>
        </div>
        <div style={{ marginTop: '0.6rem' }}>
          <button className="btn-ghost" onClick={() => navigate(platformUsersRoute())}>
            Gestionar Usuarios →
          </button>
        </div>
      </div>
    </div>
  )
}
