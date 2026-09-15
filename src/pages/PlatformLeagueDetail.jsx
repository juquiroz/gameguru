import { useState, useEffect, useCallback } from 'react'
import { platformApi } from '../supabase'
import {
  buildOwnerMap,
  ownerName,
  computeLeagueMetrics,
  computeLeagueHealth,
  buildStandingsForLeague,
  summarizePicks,
  formatInTimezone,
  computeTodayGames,
  HEALTH_STATUS,
} from '../domains/platform'
import { LEAGUE_MODES } from '../domains/league/models/modes'
import { navigate, platformLeaguesRoute } from '../router/routes'
import styles from './PlatformLeagueDetail.module.css'

// BUILD-SUP-002 — Detalle global de liga (read-only, sin exigir membresía).
const HEALTH_LABEL = {
  [HEALTH_STATUS.ERROR]: 'Con errores',
  [HEALTH_STATUS.WARNING]: 'Con advertencias',
  [HEALTH_STATUS.HEALTHY]: 'Saludable',
}

const HEALTH_CLASS = {
  [HEALTH_STATUS.ERROR]: styles.error,
  [HEALTH_STATUS.WARNING]: styles.warning,
  [HEALTH_STATUS.HEALTHY]: styles.healthy,
}

export default function PlatformLeagueDetail({ leagueId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await platformApi.leagueDetail(leagueId)
    if (error) setError(error)
    else setRows(data)
  }, [leagueId])

  useEffect(() => { load() }, [load])

  if (error) {
    return (
      <div className="page">
        <div className="page-title">Detalle de Liga</div>
        <div className="msg error">Unable to load league.</div>
        <button className="btn-ghost" onClick={() => navigate(platformLeaguesRoute())}>← Volver a Ligas</button>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="page">
        <div className="page-title">Detalle de Liga</div>
        <div className="empty-state"><div className="big">⏳</div>Cargando liga...</div>
      </div>
    )
  }

  const { league, members, games, picks, gameWeeks, trainingSessions, profiles } = rows
  const ownerMap = buildOwnerMap(profiles)
  const timezone = league.timezone
  const mode = LEAGUE_MODES[league.league_mode]
  const metrics = computeLeagueMetrics(league, { leagueMembers: members, leagueGames: games, picks, now: new Date() })
  const health = computeLeagueHealth(league, { leagueGames: games, gameWeeks, trainingSessions })
  const standings = buildStandingsForLeague({ members, profiles, picks, games })
  const picksSummary = summarizePicks(picks, profiles)
  const today = computeTodayGames({ leagueGames: games, leagues: [league], now: new Date() })

  const healthLabel = HEALTH_LABEL[health.status] || health.status

  const GameRow = ({ g }) => (
    <tr>
      <td>{g.week}</td>
      <td>{g.away_abbr} @ {g.home_abbr}</td>
      <td>{formatInTimezone(g.game_time, timezone)}</td>
      <td>
        {g.home_score != null && g.away_score != null ? `${g.home_score}–${g.away_score}` : '—'}
      </td>
      <td>{g.result || '—'}</td>
      <td>{g.finished ? 'Sí' : 'No'}</td>
    </tr>
  )

  return (
    <div className="page">
      <div className={styles.header}>
        <div>
          <div className="page-title">{league.name}</div>
          <div className="page-sub">
            {mode ? `${mode.icon} ${mode.label}` : league.league_mode} · {league.sport} {league.season} · {league.code}
          </div>
        </div>
        <div className={styles.headerActions}>
          <span className={`${styles.health} ${HEALTH_CLASS[health.status]}`}>{healthLabel}</span>
          <button className="btn-ghost" onClick={() => navigate(platformLeaguesRoute())}>← Ligas</button>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.stat}><span className={styles.statVal}>{metrics.members}</span><span className={styles.statLabel}>Miembros</span></div>
        <div className={styles.stat}><span className={styles.statVal}>{metrics.games}</span><span className={styles.statLabel}>Juegos</span></div>
        <div className={styles.stat}><span className={styles.statVal}>{metrics.picks}</span><span className={styles.statLabel}>Picks</span></div>
        <div className={styles.stat}><span className={styles.statVal}>{metrics.todayGames}</span><span className={styles.statLabel}>Partidos hoy</span></div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>📋 Overview</div>
          <div className={styles.kv}><span>Nombre</span><b>{league.name}</b></div>
          <div className={styles.kv}><span>Deporte</span><b>{league.sport}</b></div>
          <div className={styles.kv}><span>Temporada</span><b>{league.season}</b></div>
          <div className={styles.kv}><span>Modo</span><b>{mode ? mode.label : league.league_mode}</b></div>
          <div className={styles.kv}><span>Simulación</span><b>{league.simulation ? 'Sí' : 'No'}</b></div>
          <div className={styles.kv}><span>Deadline</span><b>{league.deadline_mode}</b></div>
          <div className={styles.kv}><span>Creada</span><b>{formatInTimezone(league.created_at, timezone)}</b></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>👤 Owner / Admin</div>
          <div className={styles.kv}><span>Username</span><b>{ownerName(ownerMap, league.admin_id)}</b></div>
          <div className={styles.kv}><span>admin_id</span><b className={styles.mono}>{league.admin_id}</b></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>🕐 Timezone</div>
          <div className={styles.kv}><span>Timezone</span><b>{timezone}</b></div>
          <div className={styles.kv}><span>Ahora (local liga)</span><b>{formatInTimezone(new Date(), timezone)}</b></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>🩺 Health ({health.status})</div>
          {health.errors.length === 0 && health.warnings.length === 0 ? (
            <div className={styles.cardEmpty}>Sin incidencias.</div>
          ) : (
            <>
              {health.errors.map((e, i) => (
                <div key={`e${i}`} className={`${styles.issue} ${styles.issueError}`}>{e.message}</div>
              ))}
              {health.warnings.map((w, i) => (
                <div key={`w${i}`} className={`${styles.issue} ${styles.issueWarning}`}>{w.message}</div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>📅 Partidos de hoy ({today.total})</div>
        {Object.values(today.byLeague).length === 0 ? (
          <div className={styles.cardEmpty}>Sin partidos hoy.</div>
        ) : (
          Object.values(today.byLeague).map((l) => (
            <div key={l.leagueId} className={styles.row}>
              <span className={styles.rowName}>{l.timezone}</span>
              <span className={styles.rowCount}>{l.count}</span>
            </div>
          ))
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>👥 Miembros ({members.length})</div>
        {members.length === 0 ? (
          <div className={styles.cardEmpty}>Sin miembros.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Username</th><th>Role</th><th>Joined</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td>{ownerMap[m.user_id] || 'Unknown'}</td>
                    <td>{m.role || 'member'}</td>
                    <td>{formatInTimezone(m.joined_at, timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>🎮 Juegos ({games.length})</div>
        {games.length === 0 ? (
          <div className={styles.cardEmpty}>Sin juegos.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Week</th><th>Matchup</th><th>Game time ({timezone})</th><th>Score</th><th>Result</th><th>Finished</th></tr>
              </thead>
              <tbody>{games.map((g) => <GameRow key={g.id} g={g} />)}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>🏆 Standings</div>
        {standings.length === 0 ? (
          <div className={styles.cardEmpty}>Sin participantes.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>#</th><th>Jugador</th><th>Correctos</th><th>Total</th><th>Puntos</th></tr></thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.userId}>
                    <td>{i + 1}</td>
                    <td>{s.username}</td>
                    <td>{s.correct}</td>
                    <td>{s.total}</td>
                    <td>{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>🎯 Picks — resumen ({picksSummary.total})</div>
        {picksSummary.perUser.length === 0 ? (
          <div className={styles.cardEmpty}>Sin picks.</div>
        ) : (
          picksSummary.perUser.map((u) => (
            <div key={u.username} className={styles.row}>
              <span className={styles.rowName}>{u.username}</span>
              <span className={styles.rowCount}>{u.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
