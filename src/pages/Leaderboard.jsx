import { useState, useEffect, useCallback } from 'react'
import { leagueGamesApi, picksApi, leaguesApi } from '../supabase'
import LeaderboardTable from '../components/LeaderboardTable'

export default function Leaderboard({ user, league }) {
  const [activeWeek, setActiveWeek] = useState(1)
  const [weeks, setWeeks] = useState([])
  const [rows, setRows] = useState([])
  const [members, setMembers] = useState([])
  const [weekFinished, setWeekFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  const loadStandings = useCallback(async () => {
    if (!league) return
    setLoading(true)
    setMsg(null)

    // Get league members (always)
    const { data: memberData } = await leaguesApi.getMembers(league.id)
    setMembers(memberData?.map(m => ({
      userId: m.user_id,
      username: m.profiles?.username || m.user_id.slice(0, 8),
      role: m.role,
    })) || [])

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

    // Build week list
    const uniqueWeeks = [...new Set(games.map(g => g.week))].sort((a, b) => a - b)
    setWeeks(uniqueWeeks)

    const week = activeWeek
    const weekGames = games.filter(g => g.week === week)
    const finished = weekGames.every(g => g.finished)
    setWeekFinished(finished)

    if (!finished) {
      setRows([])
      setLoading(false)
      return
    }

    // Get picks and calculate standings
    const { data: picks, error: pErr } = await picksApi.getLeaderboard(league.id, week)
    if (pErr) { setMsg('Error al cargar picks'); setRows([]); setLoading(false); return }

    if (!picks?.length) {
      setRows([])
      setLoading(false)
      return
    }

    // Build result map: game_id → winner abbreviation
    const results = {}
    weekGames.forEach(g => { if (g.result) results[g.game_id] = g.result })

    // Group picks by user and count correct
    const userMap = {}
    picks.forEach(p => {
      const uid = p.user_id
      if (!userMap[uid]) {
        userMap[uid] = {
          userId: uid,
          username: p.profiles?.username || uid.slice(0, 8),
          correct: 0,
          total: 0,
        }
      }
      if (results[p.game_id]) {
        userMap[uid].total++
        if (p.pick === results[p.game_id]) userMap[uid].correct++
      }
    })

    const sorted = Object.values(userMap).sort((a, b) => b.correct - a.correct || a.total - b.total)
    setRows(sorted)
    setLoading(false)
  }, [league, activeWeek])

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

          {!weekFinished ? (
            <>
              <div className="empty-state" style={{ marginBottom: '1rem' }}>
                <div className="big">🔒</div>
                La Semana {activeWeek} aún no ha finalizado.
                <br />
                <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
                  Los resultados estarán disponibles cuando terminen los partidos.
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
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="big">📭</div>
              No hay picks registrados para la Semana {activeWeek}.
              <br />
              <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
                Los miembros deben enviar sus picks para que aparezcan aquí.
              </span>
            </div>
          ) : (
            <>
              <div className="msg success" style={{ marginBottom: '1rem', fontSize: '.8rem' }}>
                📊 Datos en tiempo real basados en los picks de los miembros y resultados de partidos.
              </div>
              <LeaderboardTable rows={rows} currentUserId={user?.id} />
            </>
          )}
        </>
      )}
    </div>
  )
}
