import { useState, useEffect, useCallback } from 'react'
import { platformApi } from '../supabase'
import {
  computeUserMetrics,
  computeUserHealth,
  buildLeagueParticipation,
  computeLastActivity,
  normalizePlatformRole,
} from '../domains/platform'
import { LEAGUE_MODES } from '../domains/league/models/modes'
import { navigate, platformUsersRoute, platformLeagueRoute } from '../router/routes'
import styles from './PlatformUserDetail.module.css'

// BUILD-SUP-003 — Detalle global de usuario (read-only, sin exigir membresía).
// email / auth status quedan FUERA del MVP (auth.users no es leíble desde el
// navegador). Todo lo mostrado es derivado de datos públicos reales.
const ROLE_LABEL = {
  user: 'Usuario',
  platform_admin: 'Admin de plataforma',
  platform_superadmin: 'Superadmin',
}

const fmt = (v) =>
  v ? new Date(v).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export default function PlatformUserDetail({ userId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await platformApi.userDetail(userId)
    if (error) setError(error)
    else setRows(data)
  }, [userId])

  useEffect(() => { load() }, [load])

  if (error) {
    return (
      <div className="page">
        <div className="page-title">Detalle de Usuario</div>
        <div className="msg error">Unable to load user.</div>
        <button className="btn-ghost" onClick={() => navigate(platformUsersRoute())}>← Volver a Usuarios</button>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="page">
        <div className="page-title">Detalle de Usuario</div>
        <div className="empty-state"><div className="big">⏳</div>Cargando usuario...</div>
      </div>
    )
  }

  const { profile, ownedLeagues, memberships, picks } = rows
  const participation = buildLeagueParticipation(memberships)
  const metrics = computeUserMetrics(profile, { ownedLeagues, memberships, picks })
  const health = computeUserHealth(profile, { ownedLeagues, memberships })
  const lastActivity = computeLastActivity({ picks, ownedLeagues, memberships })
  const role = normalizePlatformRole(profile.platform_role)

  const modeOf = (p) => {
    const mode = LEAGUE_MODES[p.mode]
    return mode ? `${mode.icon} ${mode.label}` : p.mode || '—'
  }

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <div className="page-title">{profile.username || 'Usuario sin username'}</div>
          <div className="page-sub">
            {ROLE_LABEL[role]} · registrado {fmt(profile.created_at)}
          </div>
        </div>
        <div className={styles.headerActions}>
          <span className={metrics.active ? styles.activeBadge : styles.idleBadge}>
            {metrics.active ? 'Activo' : 'Inactivo'}
          </span>
          <button className="btn-ghost" onClick={() => navigate(platformUsersRoute())}>← Usuarios</button>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.stat}><span className={styles.statVal}>{metrics.leagues}</span><span className={styles.statLabel}>Ligas</span></div>
        <div className={styles.stat}><span className={styles.statVal}>{metrics.administers}</span><span className={styles.statLabel}>Administra</span></div>
        <div className={styles.stat}><span className={styles.statVal}>{metrics.picks}</span><span className={styles.statLabel}>Picks</span></div>
        <div className={styles.stat}><span className={styles.statVal}>{metrics.active ? 'Sí' : 'No'}</span><span className={styles.statLabel}>Activo</span></div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>📋 Overview</div>
          <div className={styles.kv}><span>Username</span><b>{profile.username || '—'}</b></div>
          <div className={styles.kv}><span>user_id</span><b className={styles.mono}>{profile.id}</b></div>
          <div className={styles.kv}><span>Registrado</span><b>{fmt(profile.created_at)}</b></div>
          <div className={styles.kv}><span>Última actividad</span><b>{lastActivity ? fmt(lastActivity) : '—'}</b></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>🛡️ Platform Role</div>
          <div className={styles.kv}><span>platform_role</span><b>{ROLE_LABEL[role] || role}</b></div>
          <div className={styles.kv}><span>is_superadmin (legacy)</span><b>{profile.is_superadmin ? 'Sí' : 'No'}</b></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>⚡ Actividad (derivada)</div>
          <div className={styles.kv}><span>Picks</span><b>{metrics.picks}</b></div>
          <div className={styles.kv}><span>Último pick</span><b>{fmt(picks.length ? lastPickOf(picks) : null)}</b></div>
          <div className={styles.kv}><span>Membresías</span><b>{memberships.length}</b></div>
          <div className={styles.kv}><span>Ligas que administra</span><b>{ownedLeagues.length}</b></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>🩺 Health</div>
          {health.warnings.length === 0 ? (
            <div className={styles.cardEmpty}>Sin incidencias.</div>
          ) : (
            health.warnings.map((w, i) => (
              <div key={`w${i}`} className={`${styles.issue} ${styles.issueWarning}`}>
                {w.leagueIds ? `${w.message} (${w.leagueIds.join(', ')})` : w.message}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>👥 Participación en ligas ({participation.length})</div>
        {participation.length === 0 ? (
          <div className={styles.cardEmpty}>Sin participaciones.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Liga</th><th>Modo</th><th>Rol</th><th>Joined</th></tr></thead>
              <tbody>
                {participation.map((p) => (
                  <tr
                    key={p.leagueId}
                    className={styles.row}
                    onClick={() => navigate(platformLeagueRoute(p.leagueId))}
                  >
                    <td className={styles.leagueCell}>{p.name || p.leagueId}</td>
                    <td>{modeOf(p)}</td>
                    <td>{p.role || 'member'}</td>
                    <td>{fmt(p.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Último timestamp de la actividad de picks (submitted_at > created_at).
function lastPickOf(picks) {
  return picks.reduce((max, p) => {
    const t = p.submitted_at || p.created_at
    return t && (!max || new Date(t) > max) ? new Date(t) : max
  }, null)
}
