import { useState, useEffect, useCallback } from 'react'
import GameCard from '../components/GameCard'
import LeagueIdentity from '../components/LeagueIdentity'
import { NFL_WEEKS } from '../data/nflData'
import { leagueGamesApi, picksApi, leaguesApi, profilesApi } from '../supabase'
import { isWeekLocked, isGameLocked } from '../utils/dates'
import { getLeagueTimezone } from '../domains/league'
import { canManageLeague } from '../domains/platform'
import { usePicks } from '../hooks/usePicks'
import styles from './Picks.module.css'

export default function Picks({ user, league, onNavigate }) {
  const [activeWeek, setActiveWeek] = useState(() => {
    const w = Object.keys(NFL_WEEKS).map(Number)
    return w.length > 0 ? Math.max(...w) : 2
  })
  const [leagueGames, setLeagueGames] = useState(null)
  const [loadingGames, setLoadingGames] = useState(false)

  const { picks, submitted, saving, selectPick, submitPicks } = usePicks(user, league, activeWeek)

  // Load league games from Supabase
  const loadLeagueGames = useCallback(async () => {
    if (!league) return
    setLoadingGames(true)
    const { data, error } = await leagueGamesApi.getForLeague(league.id)
    if (error) {
      console.warn('Error al cargar league_games:', error)
      setLeagueGames(null)
    } else if (data?.length) {
      setLeagueGames(data)
    } else {
      setLeagueGames(null)
    }
    setLoadingGames(false)
  }, [league])

  useEffect(() => { loadLeagueGames() }, [loadLeagueGames])

  // Determine which game source to use
  const useDynamic = leagueGames && leagueGames.length > 0

  // Normalize game so GameCard works with both DB fields and NFL_WEEKS format
  const normGame = (g) => ({
    ...g,
    id:    g.game_id    || g.id,
    time:  g.game_time  || g.time,
    aA:    g.away_abbr  || g.aA,
    hA:    g.home_abbr  || g.hA,
    away:  g.away_team  || g.away,
    home:  g.home_team  || g.home,
  })

  // Build week data from dynamic games or use NFL_WEEKS
  const getWeekData = (week) => {
    if (useDynamic) {
      const active = leagueGames.filter(g => g.active !== false)
      const games = active.filter(g => g.week === week).map(normGame).sort((a, b) => {
        const ta = a.game_time || a.time || ''
        const tb = b.game_time || b.time || ''
        if (ta < tb) return -1
        if (ta > tb) return 1
        return 0
      })
      if (games.length === 0) return null
      const allFinished = games.every(g => g.finished)
      const results = {}
      games.forEach(g => { if (g.result) results[g.id] = g.result })
      return {
        label: `Semana ${week}`,
        games,
        results: Object.keys(results).length > 0 ? results : null,
        finished: allFinished,
      }
    }
    return NFL_WEEKS[week] || null
  }

  const weekData = getWeekData(activeWeek)

  const weekLocked = isWeekLocked(weekData?.games)

  // Available weeks
  const weeks = useDynamic
    ? [...new Set(leagueGames.filter(g => g.active !== false).map(g => g.week))].sort((a, b) => a - b)
    : Object.keys(NFL_WEEKS).map(Number)

  // When dynamic games load, sync to latest available week
  useEffect(() => {
    if (useDynamic && weeks.length > 0) {
      setActiveWeek(prev => {
        if (!weeks.includes(prev)) return Math.max(...weeks)
        return prev
      })
    }
  }, [loadingGames])

  const totalGames = weekData?.games?.length || 0
  const pickedCount = weekData?.games?.filter(g => picks[g.id]).length || 0

  const correctCount = weekData?.results
    ? Object.entries(picks).filter(([gid, pick]) => weekData.results[gid] === pick).length
    : 0

  const handleSubmit = async () => {
    const { error } = await submitPicks(totalGames)
    if (error) alert(error.message)
  }

  const exportLeagueAudit = async () => {
    const games = weekData?.games || []
    const results = weekData?.results || {}
    if (!games.length || !league) return

    const [membersRes, picksRes] = await Promise.all([
      leaguesApi.getMembers(league.id),
      picksApi.getLeaderboard(league.id, activeWeek),
    ])

    const memberList = membersRes.data || []
    const weekPicks = picksRes.data || []

    const userIds = [...new Set(memberList.map(m => m.user_id))]
    const { data: profiles } = await profilesApi.getMany(userIds)
    const profileMap = {}
    if (profiles) profiles.forEach(p => { profileMap[p.id] = p.username || p.id.slice(0, 8) })

    const teamEmoji = (abbr) => {
      const map = { KC: '🏈', BAL: '🦅', DAL: '⭐', PHI: '🦅', SF: '🔴', SEA: '🌊', BUF: '🐃', NYJ: '✈️', MIA: '🐬', NE: '⚓', GB: '🧀', CHI: '🐻', LAR: '🐏', DET: '🦁', CIN: '🐯', PIT: '🔨', MIN: '⚔️', NYG: '🏈', TB: '🏴‍☠️', ATL: '🦅', CAR: '🐈', NO: '⚜️', ARI: '🏜️', LAC: '⚡', LV: '☠️', DEN: '🐴', HOU: '🤠', IND: '🐎', JAX: '🐆', TEN: '⚡', CLE: '🐶', WAS: '🦅' }
      return map[abbr] || '🏈'
    }

    const trStyle = 'border-bottom:1px solid rgba(255,255,255,.07)'
    const thS = `padding:.55rem .4rem;text-align:center;font-size:.65rem;letter-spacing:.06em;text-transform:uppercase;color:#8B9ABB;font-weight:600;white-space:nowrap;${trStyle}`
    const tdS = `padding:.5rem .35rem;text-align:center;font-size:.78rem;white-space:nowrap;${trStyle}`

    let headerCells = ''
    for (const g of games) {
      const score = g.away_score != null ? `${g.away_score}–${g.home_score}` : ''
      headerCells += `<th style="${thS};min-width:80px">
        <div style="display:flex;align-items:center;gap:2px;justify-content:center">${teamEmoji(g.aA)} <span>${g.aA}</span>
        <span style="color:#4A5A7A">@</span> ${teamEmoji(g.hA)} <span>${g.hA}</span></div>
        ${score ? `<div style="font-size:.62rem;color:#8B9ABB">${score}</div>` : ''}
        <div style="font-size:.6rem;color:${results[g.id] ? '#22C55E' : '#4A5A7A'}">✓ ${results[g.id] || ''}</div>
      </th>`
    }

    const scores = memberList.map(member => {
      let correct = 0
      const cells = games.map(g => {
        const pick = weekPicks.find(p => p.user_id === member.user_id && p.game_id === (g.game_id || g.id))
        const pickAbbr = pick?.pick || ''
        const result = results[g.id]
        const isCorrect = result && pickAbbr === result
        if (isCorrect) correct++
        const bg = isCorrect ? 'rgba(34,197,94,.1)' : (pickAbbr && result ? 'rgba(239,68,68,.07)' : 'rgba(19,30,50,.4)')
        const color = isCorrect ? '#22C55E' : (pickAbbr && result ? '#EF4444' : '#4A5A7A')
        return `<td style="${tdS};color:${color}"><span style="display:inline-flex;align-items:center;gap:2px;background:${bg};padding:1px 6px;border-radius:3px">${pickAbbr ? `${teamEmoji(pickAbbr)} ${pickAbbr}` : '—'}</span></td>`
      })
      return { member, cells: cells.join(''), correct }
    })

    const weekFinished = games.every(g => g.finished || results[g.id])
    const maxCorrect = weekFinished ? Math.max(...scores.map(s => s.correct)) : -1

    let memberRows = ''
    for (const s of scores) {
      const username = profileMap[s.member.user_id] || s.member.user_id.slice(0, 8)
      const isWinner = weekFinished && s.correct === maxCorrect && maxCorrect > 0
      const isAdmin = s.member.role === 'admin'
      const rowStyle = isWinner ? `border-bottom:1px solid rgba(255,215,0,.3);background:linear-gradient(90deg,rgba(255,215,0,.06),transparent)` : trStyle
      const nameStyle = isWinner ? `color:#FFD700;font-weight:700` : `font-weight:600`
      memberRows += `<tr style="${rowStyle}"><td style="${tdS};text-align:left;${nameStyle};position:sticky;left:0;background:${isWinner ? '#0D1525' : '#0D1525'}">${username}${isAdmin ? ' 👑' : ''}${isWinner ? ' 🏆' : ''}</td>${s.cells}<td style="${tdS};font-weight:700;color:#F5A623;font-size:.88rem">${s.correct}/${games.length}</td></tr>`
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auditoría Semana ${activeWeek} · ${league?.name || ''}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#070B14;color:#F0F4FF;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;padding:2rem 1.5rem}
h1{font-size:1.5rem;margin-bottom:.15rem}
.sub{color:#8B9ABB;font-size:.85rem;margin-bottom:1.5rem}
.meta{color:#4A5A7A;font-size:.78rem;margin-bottom:1.5rem;display:flex;gap:.75rem;flex-wrap:wrap}
.meta span{background:#0D1525;padding:.35rem .75rem;border-radius:6px;border:1px solid rgba(255,255,255,.07)}
table{width:100%;border-collapse:collapse;background:#0D1525;border-radius:12px;overflow:hidden}
th{background:#131E32}
td:first-child{position:sticky;left:0;background:#0D1525}
@media print{body{padding:0.5in}table{break-inside:avoid}}
</style>
</head>
<body>
  <h1>📋 Auditoría · Semana ${activeWeek}</h1>
  <div class="sub">${league?.name || ''} · ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  <div class="meta">
    <span>👥 ${memberList.length} miembros</span>
    <span>🏈 ${games.length} partidos</span>
    <span>${weekFinished ? '🔒 Semana finalizada' : '🔓 Semana en curso'}</span>
  </div>
  <table>
    <thead><tr>
      <th style="${thS};text-align:left;min-width:130px">Miembro</th>
      ${headerCells}
      <th style="${thS}">Aciertos</th>
    </tr></thead>
    <tbody>${memberRows}</tbody>
  </table>
  <div style="margin-top:1.5rem;font-size:.72rem;color:#4A5A7A;text-align:center">
    GameGuru · Generado automáticamente · ${new Date().toISOString().split('T')[0]}
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria-semana${activeWeek}-${(league?.name || 'liga').replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <div className="page-title">Mis Picks</div>
      <div className="page-sub">Selecciona el ganador de cada partido antes del kickoff</div>

      {/* PLAN-01.1: identidad de la liga siempre visible (no solo el Topbar) */}
      <LeagueIdentity league={league} week={activeWeek} />

      {!loadingGames && !useDynamic && !weekData && (
        <div className="msg warning" style={{ marginBottom: '1rem', fontSize: '.78rem' }}>
          ⚠️ No se encontraron juegos en esta liga. {canManageLeague(league, user)
            ? 'Ve a Mi Liga &gt; Gestión de Partidos para importarlos.'
            : 'El admin de la liga debe importar los juegos.'}
        </div>
      )}

      {/* Week tabs */}
      <div className="week-tabs">
        {weeks.map(w => {
          const wd = getWeekData(w)
          return (
            <button
              key={w}
              className={`week-tab ${activeWeek === w ? 'active' : ''}`}
              onClick={() => setActiveWeek(w)}
            >
              {wd?.label || `Semana ${w}`}
              {wd?.finished && <span className="fin-tag">FINAL</span>}
            </button>
          )
        })}
      </div>

      {loadingGames ? (
        <div className="empty-state"><div className="big">⏳</div>Cargando partidos...</div>
      ) : !weekData ? (
        <div className="empty-state">
          <div className="big">📭</div>
          No hay partidos para la Semana {activeWeek}.
          {canManageLeague(league, user) && (
            <><br /><span style={{ fontSize: '.82rem', color: 'var(--text3)' }}>
              Ve a Mi Liga &gt; Gestión de Partidos para importar juegos.
            </span></>
          )}
        </div>
      ) : (
        <>
          {!weekLocked && (
            <div className="msg warning" style={{ marginBottom: '1rem', fontSize: '.78rem' }}>
              📅 Todos los picks se bloquean 5 min antes del primer partido
            </div>
          )}

          {/* Result banner for finished weeks */}
          {weekData.finished && (
            <div className="result-banner">
              <span className="rb-icon">🏆</span>
              <div>
                <div className="rb-label">Semana Finalizada</div>
                <div className="rb-score">
                  Acertaste <strong>{correctCount} de {Object.keys(weekData.results).length}</strong> partidos
                </div>
              </div>
            </div>
          )}

          {/* Week state actions — visible without scrolling, before the games list */}
          {weekLocked && (
            <div className={styles.weekActions}>
              <button
                className="btn-secondary"
                onClick={exportLeagueAudit}
              >
                📥 Exportar auditoría
              </button>
              <button
                className="btn-secondary"
                onClick={() => onNavigate('publicpicks')}
              >
                👁️ Ver Picks Públicos
              </button>
            </div>
          )}

          {/* Games grid */}
          <div className={styles.grid}>
            {weekData.games.map(game => (
              <GameCard
                key={game.id}
                game={game}
                pick={picks[game.id]}
                onPick={selectPick}
                results={weekData.results}
                locked={isGameLocked(game, weekData?.games)}
                timeZone={getLeagueTimezone(league)}
              />
            ))}
          </div>

          {/* Submit bar — visible until the week's deadline passes */}
          {!weekLocked && (
            <div className={styles.submitBar}>
              <div>
                <div className={styles.pickCount}>
                  <strong>{pickedCount}</strong> / {totalGames} partidos seleccionados
                </div>
                {submitted && (
                  <div className={styles.submitOk}>✓ Picks guardados correctamente</div>
                )}
              </div>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={pickedCount < totalGames || saving}
              >
                {saving ? 'Guardando...' : 'Guardar Picks'}
              </button>
            </div>
          )}

          {weekLocked && !weekData.finished && (
            <div className="lock-notice">🔒 Hora límite alcanzada — los picks están bloqueados</div>
          )}
          {weekData.finished && (
            <div className="lock-notice">🔒 Esta semana ya finalizó — los picks están bloqueados</div>
          )}
        </>
      )}
    </div>
  )
}
