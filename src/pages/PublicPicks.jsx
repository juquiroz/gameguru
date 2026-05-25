import { useState, useEffect, useCallback } from 'react'
import { leagueGamesApi, picksApi, profilesApi } from '../supabase'
import { leaguesApi } from '../supabase'
import TeamLogo from '../components/TeamLogo'

const TOTAL_WEEKS = 18

function getWeekDeadline(weekGames) {
  const times = weekGames
    .map(g => g.game_time || g.time)
    .filter(Boolean)
    .map(t => new Date(t))
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b)
  if (times.length === 0) return null
  return new Date(times[0].getTime() - 60 * 60 * 1000)
}

function isGameLocked(game, weekGames) {
  if (game.finished) return true
  const deadline = getWeekDeadline(weekGames)
  return deadline ? new Date() >= deadline : false
}

export default function PublicPicks({ user, league }) {
  const [activeWeek, setActiveWeek] = useState(1)
  const [games, setGames] = useState([])
  const [picks, setPicks] = useState([])
  const [members, setMembers] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [loading, setLoading] = useState(true)

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
    if (membersRes.data) {
      setMembers(membersRes.data)
      const userIds = [...new Set(membersRes.data.map(m => m.user_id))]
      const { data: profiles } = await profilesApi.getMany(userIds)
      const map = {}
      if (profiles) profiles.forEach(p => { map[p.id] = p.username || p.id.slice(0, 8) })
      setProfileMap(map)
    }
    setLoading(false)
  }, [league])

  useEffect(() => { loadData() }, [loadData])

  const weekGames = games
    .filter(g => g.active !== false && g.week === activeWeek)
    .sort((a, b) => {
      const ta = a.game_time || ''
      const tb = b.game_time || ''
      return ta < tb ? -1 : ta > tb ? 1 : 0
    })

  const lockedGames = weekGames.filter(g => isGameLocked(g, weekGames))
  const weeksWithLocked = weekList.filter(w => {
    const wGames = games.filter(g => g.active !== false && g.week === w)
    return wGames.length > 0 && wGames.some(g => isGameLocked(g, wGames))
  })

  const weeksWithGames = [...new Set(games.filter(g => g.active !== false).map(g => g.week))].sort((a, b) => a - b)
  const weekList = league?.simulation ? weeksWithGames : Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1)

  const gamesById = {}
  weekGames.forEach(g => { gamesById[g.id] = g })

  const weekPicks = picks.filter(p => p.week === activeWeek)

  const buildRow = (memberId) => {
    return lockedGames.map(g => {
      const pick = weekPicks.find(p => p.user_id === memberId && p.game_id === g.game_id)
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

  return (
    <div className="page">
      <div className="page-title">👁️ Picks Públicos</div>
      <div className="page-sub">Picks de todos los miembros para juegos bloqueados</div>

      {loading ? (
        <div className="empty-state"><div className="big">⏳</div></div>
      ) : members.length === 0 ? (
        <div className="empty-state"><div className="big">👥</div>Aún no hay miembros en esta liga.</div>
      ) : (
        <>
          {/* Week tabs */}
          <div className="week-tabs" style={{ marginBottom: '1rem' }}>
            {weekList.map(w => {
              const locked = weeksWithLocked.includes(w)
              return (
                <button
                  key={w}
                  className={`week-tab ${activeWeek === w ? 'active' : ''}`}
                  onClick={() => setActiveWeek(w)}
                  style={locked ? {} : { opacity: 0.5 }}
                >
                  Semana {w}
                  {locked && <span className="fin-tag" style={{ fontSize: '.6rem' }}>🔓</span>}
                </button>
              )
            })}
          </div>

          {lockedGames.length === 0 ? (
            <div className="empty-state">
              <div className="big">🔒</div>
              No hay juegos bloqueados en esta semana aún.<br />
              <span style={{ fontSize: '.82rem', color: 'var(--text3)' }}>
                Todos los juegos de la semana se vuelven visibles 1h antes del primer partido.
              </span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: '.78rem', fontFamily: "'Barlow Condensed', sans-serif",
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>Miembro</th>
                    {lockedGames.map(g => (
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
                  {members.map(m => {
                    const username = profileMap[m.user_id] || m.user_id.slice(0, 8)
                    const row = buildRow(m.user_id)
                    return (
                      <tr key={m.user_id} style={{ borderBottom: '1px solid var(--bg3)' }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{username}</td>
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
