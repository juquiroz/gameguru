import { useState, useEffect, useCallback, useRef } from 'react'
import { leagueGamesApi, picksApi, leaguesApi } from '../supabase'
import { getCurrentWeek } from '../utils/dates'
import { calcStandings, calcStreaks } from '../utils/standings'
import LeaderboardTable from '../components/LeaderboardTable'
import LeagueIdentity from '../components/LeagueIdentity'
import PublicPicksMatrix from '../components/PublicPicksMatrix'
import { canManageLeague } from '../domains/platform'
import { useLeagueIdentity } from '../domains/league/hooks/useLeagueIdentity'

export default function Leaderboard({ user, league, onNavigate }) {
  // Default por fechas: antes de arrancar la temporada muestra la semana 1;
  // al cargar los juegos reales se sincroniza a la semana en juego.
  const [activeWeek, setActiveWeek] = useState(1)
  const [weeks, setWeeks] = useState([])
  const [allGames, setAllGames] = useState([])
  const [rows, setRows] = useState([])
  const [members, setMembers] = useState([])
  const [memberUserIds, setMemberUserIds] = useState([])
  const [weekFinished, setWeekFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  // BUILD-017-B: joined_at por usuario (juegos pre-cerrados → fallidos).
  const joinedAtRef = useRef({})
  // BUILD-017-E: matriz de picks de todos, expandible en la misma página
  // (antes navegaba a otra ruta). Si el usuario aprieta "Ver Picks Públicos"
  // desde la página de Picks, se llega acá con la matriz ya abierta.
  const [showPicks, setShowPicks] = useState(() => !!sessionStorage.getItem('gg.showPicks'))
  // BUILD-017-F: racha (juegos acertados seguidos) por usuario, global sobre
  // todos los partidos finalizados de la liga.
  const [streaks, setStreaks] = useState({})
  const isGeneral = activeWeek === 'all'
  const { displayMap } = useLeagueIdentity(league, memberUserIds)

  // Sync activeWeek to the week being played (por fechas) when data loads
  const syncedRef = useRef(false)
  useEffect(() => {
    if (weeks.length === 0 || allGames.length === 0 || syncedRef.current) return
    syncedRef.current = true
    const current = getCurrentWeek(allGames)
    setActiveWeek(current || weeks[0])
  }, [weeks, allGames])

  // BUILD-017-E: consumir el flag que deja la página de Picks al redirigir a
  // la Tabla para que la matriz aparezca abierta solo ese viaje.
  useEffect(() => {
    sessionStorage.removeItem('gg.showPicks')
  }, [])

  const loadStandings = useCallback(async () => {
    if (!league) return
    setLoading(true)
    setMsg(null)

    // Get league members (always)
    const { data: memberData } = await leaguesApi.getMembers(league.id)
    if (memberData) {
      const userIds = [...new Set(memberData.map(m => m.user_id))]
      setMemberUserIds(userIds)
      setMembers(memberData.map(m => ({
        userId: m.user_id,
        username: displayMap[m.user_id] || m.user_id.slice(0, 8),
        role: m.role,
      })))
      // BUILD-017-B: joined_at por usuario para que los juegos ya cerrados al
      // unirse cuenten como fallidos en los standings.
      joinedAtRef.current = {}
      memberData.forEach(m => {
        if (m.joined_at) joinedAtRef.current[m.user_id] = new Date(m.joined_at).getTime()
      })
    } else {
      setMemberUserIds([])
      setMembers([])
      joinedAtRef.current = {}
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
    setAllGames(games)

    if (isGeneral) {
      // General view: accumulate across all finished weeks
      const finishedWeeks = uniqueWeeks.filter(w =>
        games.filter(g => g.week === w).every(g => g.finished)
      )
      const allWeeksFinished = uniqueWeeks.length > 0 && finishedWeeks.length === uniqueWeeks.length

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

      const pickUserIds = [...new Set(allPicks.map(p => p.user_id))]
      setMemberUserIds(prev => [...new Set([...prev, ...pickUserIds])])
      // BUILD-017-G: se pasan TODOS los juegos (no solo los con resultado)
      // para que los fallidos de quien entró tarde cuenten aunque el juego ya
      // haya pasado y todavía no tenga resultado cargado.
      const sorted = calcStandings(allPicks, games, displayMap, { joinedAt: joinedAtRef.current })
      setRows(sorted)
      // BUILD-017-F: racha global sobre todos los juegos finalizados.
      setStreaks(calcStreaks(allPicks, games, sorted.map(r => r.userId)))
      setWeekFinished(allWeeksFinished)
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
      setStreaks({})
      setLoading(false)
      return
    }

    const pickUserIds = [...new Set(picks.map(p => p.user_id))]
    setMemberUserIds(prev => [...new Set([...prev, ...pickUserIds])])
    // BUILD-017-G: se pasan todos los partidos de la semana (no solo los con
    // resultado) para que los pre-cerrados sin resultado cuenten como fallido.
    const sorted = calcStandings(picks, weekGames, displayMap, { joinedAt: joinedAtRef.current })
    setRows(sorted)
    // BUILD-017-F: la racha es global (todos los partidos finalizados de la
    // liga), aunque la vista sea de una semana puntual.
    const { data: allPicks } = await picksApi.getAllForLeague(league.id)
    setStreaks(allPicks ? calcStreaks(allPicks, games, sorted.map(r => r.userId)) : {})
    setLoading(false)
  }, [league, activeWeek, displayMap])

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

      {/* PLAN-01.1: identidad de la liga siempre visible (no solo el Topbar) */}
      <LeagueIdentity league={league} />

      {loading ? (
        <div className="empty-state"><div className="big">⏳</div>Cargando...</div>
      ) : weeks.length === 0 ? (
        <div className="empty-state">
          <div className="big">📭</div>
          Esta liga aún no tiene partidos importados.
          {canManageLeague(league, user) && (
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
              <LeaderboardTable rows={rows} currentUserId={user?.id} showWinner={weekFinished} streaks={streaks} />
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

          {/* BUILD-017-E: ver los picks de todos acá mismo, al lado de los
              jugadores, sin ir a otra ruta. Llega abierta si el clic provino
              de "Ver Picks Públicos" en la página de Picks. */}
          <button
            className={showPicks ? 'btn-primary' : 'btn-secondary'}
            style={{ width: '100%', marginTop: '1rem' }}
            onClick={() => setShowPicks(v => {
              const next = !v
              if (!next) sessionStorage.removeItem('gg.showPicks')
              return next
            })}
          >
            👁️ {showPicks ? 'Ocultar Picks Públicos' : 'Ver Picks Públicos'}
          </button>

          {showPicks && (
            <div style={{ marginTop: '1rem' }}>
              <PublicPicksMatrix league={league} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
