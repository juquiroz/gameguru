import { useState, useEffect, useCallback } from 'react'
import { leagueGamesApi, picksApi, leaguesApi, profilesApi } from '../supabase'
import LeaderboardTable from '../components/LeaderboardTable'

const getWeekDeadline = (games) => {
  if (!games?.length) return null
  const times = games
    .map(g => g.game_time || g.time)
    .filter(Boolean)
    .map(t => new Date(t))
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b)
  if (times.length === 0) return null
  return new Date(times[0].getTime() - 60 * 60 * 1000)
}

const isWeekLocked = (games) => {
  if (!games?.length) return false
  if (games.every(g => g.finished)) return true
  const deadline = getWeekDeadline(games)
  return deadline ? new Date() >= deadline : false
}

export default function Leaderboard({ user, league, onNavigate }) {
  const [activeWeek, setActiveWeek] = useState(1)
  const [weeks, setWeeks] = useState([])
  const [rows, setRows] = useState([])
  const [members, setMembers] = useState([])
  const [weekFinished, setWeekFinished] = useState(false)
  const [lockedWeeks, setLockedWeeks] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const isGeneral = activeWeek === 'all'

  const loadProfiles = useCallback(async (userIds) => {
    if (!userIds.length) return {}
    const { data } = await profilesApi.getMany(userIds)
    const map = {}
    if (data) data.forEach(p => { map[p.id] = p.username })
    return map
  }, [])

  const calcStandings = (picks, games, profileMap) => {
    const results = {}
    games.forEach(g => { if (g.result) results[g.game_id] = g.result })

    const userMap = {}
    picks.forEach(p => {
      const uid = p.user_id
      if (!userMap[uid]) {
        userMap[uid] = {
          userId: uid,
          username: profileMap[uid] || uid.slice(0, 8),
          correct: 0,
          total: 0,
        }
      }
      if (results[p.game_id]) {
        userMap[uid].total++
        if (p.pick === results[p.game_id]) userMap[uid].correct++
      }
    })

    return Object.values(userMap).sort((a, b) => b.correct - a.correct || a.total - b.total)
  }

  const loadStandings = useCallback(async () => {
    if (!league) return
    setLoading(true)
    setMsg(null)

    // Get league members (always)
    const { data: memberData } = await leaguesApi.getMembers(league.id)
    if (memberData) {
      const userIds = [...new Set(memberData.map(m => m.user_id))]
      const profileMap = await loadProfiles(userIds)
      setMembers(memberData.map(m => ({
        userId: m.user_id,
        username: profileMap[m.user_id] || m.user_id.slice(0, 8),
        role: m.role,
      })))
    } else {
      setMembers([])
    }

    // Get games for this league
    const { data: games, error: gErr } = await leagueGamesApi.getForLeague(league.id)
    if (gErr) { setMsg('Error al cargar juegos'); setLoading(false); return }

    if (!games?.length) {
      setWeeks([])
      setRows([])
      setWeekFinished(false)
      setLoading(false)
      return
    }

    console.log('[Leaderboard] games:', games.map(g => ({ id: g.game_id, week: g.week, finished: g.finished, result: g.result })))

    // Build week list
    const uniqueWeeks = [...new Set(games.map(g => g.week))].sort((a, b) => a - b)
    setWeeks(uniqueWeeks)

    // Compute which weeks have locked games
    const locked = uniqueWeeks.filter(w => {
      const weekGames = games.filter(g => g.week === w)
      return isWeekLocked(weekGames)
    })
    setLockedWeeks(locked)

    if (isGeneral) {
      // General view: accumulate across all finished weeks
      const finishedWeeks = uniqueWeeks.filter(w =>
        games.filter(g => g.week === w).every(g => g.finished)
      )
      if (!finishedWeeks.length) {
        setWeekFinished(false)
        setRows([])
        setLoading(false)
        return
      }

      const { data: allPicks, error: pErr } = await picksApi.getAllForLeague(league.id)
      if (pErr) { setMsg('Error al cargar picks'); setRows([]); setLoading(false); return }

      if (!allPicks?.length) {
        setRows([])
        setLoading(false)
        return
      }

      const finishedGames = games.filter(g => g.finished && g.result)
      const pickUserIds = [...new Set(allPicks.map(p => p.user_id))]
      const profileMap = await loadProfiles(pickUserIds)
      const sorted = calcStandings(allPicks, finishedGames, profileMap)
      setRows(sorted)
      setWeekFinished(true)
      setLoading(false)
      return
    }

    // Per-week view: calculate with whatever games have results
    const week = Number(activeWeek)
    const weekGames = games.filter(g => g.week === week)
    const finished = weekGames.every(g => g.finished)
    setWeekFinished(finished)

    const { data: picks, error: pErr } = await picksApi.getLeaderboard(league.id, week)
    if (pErr) { setMsg('Error al cargar picks'); setRows([]); setLoading(false); return }

    const scoredGames = weekGames.filter(g => g.finished && g.result)
    if (!picks?.length || !scoredGames.length) {
      setRows([])
      setLoading(false)
      return
    }

    const pickUserIds = [...new Set(picks.map(p => p.user_id))]
    const profileMap = await loadProfiles(pickUserIds)
    const sorted = calcStandings(picks, scoredGames, profileMap)
    setRows(sorted)
    setLoading(false)
  }, [league, activeWeek, loadProfiles])

  useEffect(() => { loadStandings() }, [loadStandings])

  if (!league) {
    return (
      <div className="page">
        <div className="page-title">Tabla de Posiciones</div>
        <div className="page-sub">Selecciona una liga para ver las posiciones.</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-title">Tabla de Posiciones</div>
      <div className="page-sub">El que más aciertos logre gana la semana</div>

      {loading ? (
        <div className="empty-state"><div className="big">⏳</div>Cargando...</div>
      ) : weeks.length === 0 ? (
        <div className="empty-state">
          <div className="big">📭</div>
          Esta liga aún no tiene partidos importados.
          {league?.admin_id === user?.id && (
            <><br /><span style={{ fontSize: '.82rem', color: 'var(--text3)' }}>
              Ve a Mi Liga &gt; Gestión de Partidos para importarlos.
            </span></>
          )}
        </div>
      ) : (
        <>
          <div className="week-tabs">
            <button
              className={`week-tab ${isGeneral ? 'active' : ''}`}
              onClick={() => setActiveWeek('all')}
            >
              📊 General
            </button>
            {weeks.map(w => (
              <button
                key={w}
                className={`week-tab ${activeWeek === w ? 'active' : ''}`}
                onClick={() => setActiveWeek(w)}
              >
                Semana {w}
              </button>
            ))}
          </div>

          {msg && (
            <div className="msg error" style={{ marginBottom: '1rem' }}>{msg}</div>
          )}

          {rows.length > 0 ? (
            <>
              <div className="msg success" style={{ marginBottom: '1rem', fontSize: '.8rem' }}>
                📊 {isGeneral
                  ? 'Acumulado general de todas las semanas.'
                  : weekFinished
                    ? 'Semana completa — datos finales basados en los resultados de todos los partidos.'
                    : 'Resultados parciales — se muestran los aciertos de los partidos ya finalizados.'
                }
              </div>
              <LeaderboardTable rows={rows} currentUserId={user?.id} />
            </>
          ) : !weekFinished && !isGeneral ? (
            <>
              <div className="empty-state" style={{ marginBottom: '1rem' }}>
                <div className="big">🔒</div>
                {`La Semana ${activeWeek} aún no tiene resultados.`}
                <br />
                <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
                  Los resultados aparecerán cuando al menos un partido tenga resultado ingresado.
                </span>
              </div>
              {members.length > 0 && (
                <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r-xl)', padding: '1.25rem' }}>
                  <div className="sec-title" style={{ marginBottom: '.75rem' }}>👥 Miembros ({members.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {members.map(m => (
                      <div key={m.userId} style={{
                        display: 'flex', alignItems: 'center', gap: '.65rem',
                        padding: '.6rem .8rem', background: 'var(--bg3)',
                        borderRadius: 'var(--r-sm)',
                      }}>
                        <span style={{
                          width: '30px', height: '30px', borderRadius: '50%',
                          background: 'var(--surface2)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: '.78rem', fontWeight: 600, color: 'var(--text2)',
                          flexShrink: 0,
                        }}>
                          {m.username.charAt(0).toUpperCase()}
                        </span>
                        <span style={{ flex: 1, fontSize: '.85rem', fontWeight: 500 }}>{m.username}</span>
                        {m.role === 'admin' && (
                          <span style={{
                            fontSize: '.65rem', letterSpacing: '.1em', textTransform: 'uppercase',
                            background: 'rgba(245,166,35,.15)', color: 'var(--accent)',
                            border: '1px solid rgba(245,166,35,.3)', borderRadius: '4px',
                            padding: '2px 7px',
                          }}>Admin</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="big">📭</div>
              {isGeneral
                ? 'No hay semanas con resultados aún.'
                : `No hay picks registrados para la Semana ${activeWeek}.`
              }
              <br />
              <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
                {isGeneral
                  ? 'Los resultados aparecerán cuando al menos una semana tenga partidos finalizados.'
                  : 'Los miembros deben enviar sus picks para que aparezcan aquí.'
                }
              </span>
            </div>
          )}

          {(isGeneral ? lockedWeeks.length > 0 : lockedWeeks.includes(activeWeek)) && (
            <button
              className="btn-secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => onNavigate('publicpicks')}
            >
              👁️ Ver Picks Públicos
            </button>
          )}
        </>
      )}
    </div>
  )
}
