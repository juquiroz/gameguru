import { useState, useEffect, useCallback, useRef } from 'react'
import { leagueGamesApi, picksApi } from '../supabase'
import { leaguesApi } from '../supabase'
import { getCurrentWeek } from '../utils/dates'
import TeamLogo from '../components/TeamLogo'
import { useLeagueIdentity } from '../domains/league/hooks/useLeagueIdentity'

const TOTAL_WEEKS = 18

export default function PublicPicks({ user, league }) {
  // BUILD-017-D: el default es la semana EN JUEGO, no la última. La versión
  // anterior arrancaba en TOTAL_WEEKS (18) y solo cambiaba si 18 no existía
  // en las semanas importadas → con las 18 semanas cargadas se quedaba fija en
  // la última (todas las celdas en "–").
  const [activeWeek, setActiveWeek] = useState(1)
  const [games, setGames] = useState([])
  const [picks, setPicks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const syncedRef = useRef(false)
  const memberUserIds = members.map(m => m.user_id)
  const { displayMap } = useLeagueIdentity(league, memberUserIds)

  const loadData = useCallback(async () => {
    if (!league) return
    setLoading(true)
    const [gamesRes, picksRes, membersRes] = await Promise.all([
      leagueGamesApi.getForLeague(league.id),
      picksApi.getAllForLeague(league.id),
      leaguesApi.getMembers(league.id),
    ])
    if (gamesRes.data) setGames(gamesRes.data)
    if (picksRes.data) setPicks(picksRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    setLoading(false)
  }, [league])

  useEffect(() => { loadData() }, [loadData])

  // Sync activeWeek a la semana en juego, una sola vez al cargar (después el
  // usuario puede navegar pestañas libremente).
  useEffect(() => {
    if (games.length === 0 || syncedRef.current) return
    const weeks = [...new Set(games.filter(g => g.active !== false).map(g => g.week))].sort((a, b) => a - b)
    if (weeks.length === 0) return
    syncedRef.current = true
    const current = getCurrentWeek(games)
    setActiveWeek(current != null && weeks.includes(current) ? current : weeks[0])
  }, [games])

  const weekGames = games
    .filter(g => g.active !== false && g.week === activeWeek)
    .sort((a, b) => {
      const ta = a.game_time || ''
      const tb = b.game_time || ''
      return ta < tb ? -1 : ta > tb ? 1 : 0
    })

  const weeksWithGames = [...new Set(games.filter(g => g.active !== false).map(g => g.week))].sort((a, b) => a - b)
  const weekList = weeksWithGames.length > 0 ? weeksWithGames : Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1)

  const gamesById = {}
  weekGames.forEach(g => { gamesById[g.id] = g })

  const weekPicks = picks.filter(p => p.week === activeWeek)

  const buildRow = (memberId) => {
    return weekGames.map(g => {
      // BUILD-017-C: el pick se guarda con el game_id del calendario maestro,
      // salvo partidos manuales (game_id NULL) que se guardan con el UUID
      // league_games.id. Se aceptan ambas claves.
      const pick = weekPicks.find(p =>
        p.user_id === memberId &&
        (p.game_id === g.game_id || (g.id != null && p.game_id === g.id))
      )
      const result = g.finished && g.result
      const correct = result && pick && pick.pick === g.result
      const wrong = result && pick && pick.pick !== g.result
      return {
        pick: pick?.pick || null,
        correct,
        wrong,
        result: result || null,
      }
    })
  }

  const correctCount = (memberId) => {
    const row = buildRow(memberId)
    return row.filter(c => c.correct).length
  }

  const sortedMembers = [...members].sort((a, b) => correctCount(b.user_id) - correctCount(a.user_id))

  return (
    <div className="page">
      <div className="page-title">👁️ Picks Públicos</div>
      <div className="page-sub">
        Todos los picks de la semana {activeWeek} realizados por los participantes
      </div>

      {loading ? (
        <div className="empty-state"><div className="big">⏳</div></div>
      ) : members.length === 0 ? (
        <div className="empty-state"><div className="big">👥</div>Aún no hay miembros en esta liga.</div>
      ) : (
        <>
          {/* Week tabs */}
          <div className="week-tabs" style={{ marginBottom: '1rem' }}>
            {weekList.map(w => (
              <button
                key={w}
                className={`week-tab ${activeWeek === w ? 'active' : ''}`}
                onClick={() => setActiveWeek(w)}
              >
                Semana {w}
              </button>
            ))}
          </div>

          {weekGames.length === 0 ? (
            <div className="empty-state">
              <div className="big">📭</div>
              No hay partidos para la Semana {activeWeek}.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: '.78rem', fontFamily: "'Barlow Condensed', sans-serif",
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ ...thStyle, position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg)' }}>Miembro</th>
                    {weekGames.map(g => (
                      <th key={g.id} style={{ ...thStyle, textAlign: 'center', minWidth: '80px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                          <TeamLogo abbr={g.away_abbr} size={16} />
                          <span style={{ fontSize: '.72rem' }}>{g.away_abbr}</span>
                          <span style={{ color: 'var(--text3)', fontSize: '.65rem' }}>@</span>
                          <TeamLogo abbr={g.home_abbr} size={16} />
                          <span style={{ fontSize: '.72rem' }}>{g.home_abbr}</span>
                        </div>
                        {g.finished && g.result && (
                          <div style={{ fontSize: '.65rem', color: 'var(--text2)', marginTop: '2px' }}>
                            {g.away_score}–{g.home_score}
                          </div>
                        )}
                      </th>
                    ))}
                    <th style={{ ...thStyle, textAlign: 'center' }}>Aciertos</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map(m => {
                    const username = displayMap[m.user_id] || m.user_id.slice(0, 8)
                    const row = buildRow(m.user_id)
                    return (
                      <tr key={m.user_id} style={{ borderBottom: '1px solid var(--bg3)' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1 }}>{username}</td>
                        {row.map((cell, i) => (
                          <td key={i} style={{
                            ...tdStyle, textAlign: 'center',
                            color: cell.correct ? 'var(--green)' : cell.wrong ? 'var(--red)' : 'var(--text2)',
                          }}>
                            {cell.pick ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                background: cell.correct ? 'rgba(34,197,94,.1)' : cell.wrong ? 'rgba(239,68,68,.07)' : 'var(--bg3)',
                                padding: '2px 6px', borderRadius: '4px',
                              }}>
                                <TeamLogo abbr={cell.pick} size={14} />
                                {cell.pick}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text3)' }}>–</span>
                            )}
                          </td>
                        ))}
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>
                          {correctCount(m.user_id)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const thStyle = {
  padding: '0.5rem 0.4rem',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--text2)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: 'var(--bg)',
}

const tdStyle = {
  padding: '0.4rem',
  whiteSpace: 'nowrap',
}
