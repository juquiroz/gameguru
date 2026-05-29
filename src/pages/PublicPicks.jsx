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
  const [activeWeek, setActiveWeek] = useState(TOTAL_WEEKS)
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

  // Sync activeWeek when dynamic games load
  useEffect(() => {
    if (games.length > 0 && league?.simulation) {
      const weeks = [...new Set(games.filter(g => g.active !== false).map(g => g.week))].sort((a, b) => a - b)
      if (weeks.length > 0 && !weeks.includes(activeWeek)) {
        setActiveWeek(Math.max(...weeks))
      }
    }
  }, [games, league?.simulation])

  const weekGames = games
    .filter(g => g.active !== false && g.week === activeWeek)
    .sort((a, b) => {
      const ta = a.game_time || ''
      const tb = b.game_time || ''
      return ta < tb ? -1 : ta > tb ? 1 : 0
    })

  const weeksWithGames = [...new Set(games.filter(g => g.active !== false).map(g => g.week))].sort((a, b) => a - b)
  const weekList = league?.simulation ? weeksWithGames : Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1)

  const lockedGames = weekGames.filter(g => isGameLocked(g, weekGames))
  const weeksWithLocked = weekList.filter(w => {
    const wGames = games.filter(g => g.active !== false && g.week === w)
    return wGames.length > 0 && wGames.some(g => isGameLocked(g, wGames))
  })

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

  const sortedMembers = [...members].sort((a, b) => correctCount(b.user_id) - correctCount(a.user_id))

  const exportWeekHTML = (week) => {
    const weekGames = games.filter(g => g.active !== false && g.week === week && g.finished && g.result)
    if (!weekGames.length) return
    const weekPicks = picks.filter(p => p.week === week)

    const teamLogo = (abbr) => {
      const emojis = { KC: '🏈', BAL: '🦅', DAL: '⭐', PHI: '🦅', SF: '🔴', SEA: '🌊', BUF: '🐃', NYJ: '✈️', MIA: '🐬', NE: '⚓', GB: '🧀', CHI: '🐻', LAR: '🐏', DET: '🦁', CIN: '🐯', PIT: '🔨', MIN: '⚔️', NYG: '🏈', TB: '🏴‍☠️', ATL: '🦅', CAR: '🐈', NO: '⚜️', ARI: '🏜️', LAC: '⚡', LV: '☠️', DEN: '🐴', HOU: '🤠', IND: '🐎', JAX: '🐆', TEN: '⚡', CLE: '🐶', WAS: '🦅' }
      return emojis[abbr] || '🏈'
    }

    const trStyle = 'border-bottom:1px solid rgba(255,255,255,.07)'
    const thStyle2 = `padding:.6rem .5rem;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#8B9ABB;font-weight:600;white-space:nowrap;${trStyle}`
    const tdStyle2 = `padding:.5rem .4rem;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:.82rem;white-space:nowrap;${trStyle}`

    let memberRows = ''
    for (const member of members) {
      const username = profileMap[member.user_id] || member.user_id.slice(0, 8)
      let correctTotal = 0
      let gameCells = ''
      for (const game of weekGames) {
        const pick = weekPicks.find(p => p.user_id === member.user_id && p.game_id === game.game_id)
        const pickAbbr = pick?.pick || ''
        const isCorrect = game.result && pickAbbr === game.result
        if (isCorrect) correctTotal++
        const bg = isCorrect ? 'rgba(34,197,94,.1)' : (pickAbbr ? 'rgba(239,68,68,.07)' : 'var(--bg3)')
        const color = isCorrect ? '#22C55E' : (pickAbbr ? '#EF4444' : '#4A5A7A')
        const txt = pickAbbr || '–'
        gameCells += `<td style="${tdStyle2};color:${color}"><span style="display:inline-flex;align-items:center;gap:3px;background:${bg};padding:2px 8px;border-radius:4px">${teamLogo(pickAbbr)} ${txt}</span></td>`
      }
      const isAdmin = member.role === 'admin'
      memberRows += `<tr style="${trStyle}">
        <td style="${tdStyle2};text-align:left;font-weight:600">${username}${isAdmin ? ' <span style="font-size:.65rem;color:#F5A623;opacity:.7">👑</span>' : ''}</td>
        ${gameCells}
        <td style="${tdStyle2};font-weight:700;color:#F5A623;font-size:.95rem">${correctTotal}/${weekGames.length}</td>
      </tr>`
    }

    let gameHeaders = ''
    for (const game of weekGames) {
      const score = game.away_score != null ? `${game.away_score}–${game.home_score}` : ''
      gameHeaders += `<th style="${thStyle2};min-width:88px">
        <div style="display:flex;align-items:center;gap:4px;justify-content:center;margin-bottom:2px">
          ${teamLogo(game.away_abbr)} <span style="font-size:.78rem">${game.away_abbr}</span>
          <span style="color:#4A5A7A;font-size:.7rem">@</span>
          ${teamLogo(game.home_abbr)} <span style="font-size:.78rem">${game.home_abbr}</span>
        </div>
        ${score ? `<div style="font-size:.7rem;color:#8B9ABB">${score}</div>` : ''}
        <div style="font-size:.62rem;margin-top:2px;color:${game.result === game.home_abbr || game.result === game.away_abbr ? '#22C55E' : '#4A5A7A'}">✓ ${game.result || ''}</div>
      </th>`
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auditoría Semana ${week} · ${league?.name || ''}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#070B14;color:#F0F4FF;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;padding:2rem 1.5rem}
h1{font-size:1.6rem;margin-bottom:.2rem;letter-spacing:.02em}
.sub{color:#8B9ABB;font-size:.88rem;margin-bottom:1.5rem}
.meta{color:#4A5A7A;font-size:.78rem;margin-bottom:1.5rem;display:flex;gap:1rem;flex-wrap:wrap}
.meta span{background:#0D1525;padding:.35rem .75rem;border-radius:6px;border:1px solid rgba(255,255,255,.07)}
table{width:100%;border-collapse:collapse;background:#0D1525;border-radius:12px;overflow:hidden}
th{background:#131E32}
td:first-child{position:sticky;left:0;background:#0D1525}
@media print{body{padding:0.5in}table{break-inside:avoid}}
</style>
</head>
<body>
  <h1>📋 Auditoría · Semana ${week}</h1>
  <div class="sub">${league?.name || ''} · ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  <div class="meta">
    <span>👥 ${members.length} miembros</span>
    <span>🏈 ${weekGames.length} partidos</span>
    <span>🔒 Semana finalizada</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="${thStyle2};text-align:left;min-width:140px">Miembro</th>
        ${gameHeaders}
        <th style="${thStyle2}">Aciertos</th>
      </tr>
    </thead>
    <tbody>
      ${memberRows}
    </tbody>
  </table>
  <div style="margin-top:1.5rem;font-size:.72rem;color:#4A5A7A;text-align:center;letter-spacing:.04em">
    GameGuru · Generado automáticamente · ${new Date().toISOString().split('T')[0]}
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria-semana${week}-${(league?.name || 'liga').replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html`
    a.click()
    URL.revokeObjectURL(url)
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
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.5rem' }}>
                <button
                  className="btn-ghost"
                  onClick={() => exportWeekHTML(activeWeek)}
                  style={{ borderColor: 'rgba(34,197,94,.3)', color: 'var(--green)', fontSize: '.72rem' }}
                >
                  📥 Exportar Semana {activeWeek}
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: '.78rem', fontFamily: "'Barlow Condensed', sans-serif",
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ ...thStyle, position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg)' }}>Miembro</th>
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
                  {sortedMembers.map(m => {
                    const username = profileMap[m.user_id] || m.user_id.slice(0, 8)
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
            </>
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
