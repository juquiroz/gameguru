import LeaderboardTable from '../components/LeaderboardTable'
import { NFL_WEEKS } from '../data/nflData'

// Mock leaderboard — replace with real Supabase query when ready
const MOCK_ROWS = [
  { userId: 'me',  username: null,         correct: 7, total: 8 },
  { userId: 'u2',  username: 'carlos.m',   correct: 6, total: 8 },
  { userId: 'u3',  username: 'juan.p',     correct: 6, total: 8 },
  { userId: 'u4',  username: 'andrea.v',   correct: 5, total: 8 },
  { userId: 'u5',  username: 'rob.c',      correct: 4, total: 8 },
]

export default function Dashboard({ user, league, onNavigate }) {
  const activeWeekNum = 2
  const activeWeek    = NFL_WEEKS[activeWeekNum]

  // Find current user in mock rows
  const meRow  = MOCK_ROWS[0]
  const myRank = 1
  const pct    = Math.round((meRow.correct / meRow.total) * 100)

  // Inject real user email into mock
  const rows = MOCK_ROWS.map((r, i) =>
    i === 0 ? { ...r, username: user?.email?.split('@')[0] || 'Tú', userId: user?.id || 'me' }
            : r
  )

  return (
    <div className="page">
      <div className="page-title">Dashboard</div>
      <div className="page-sub">
        {league?.name} · {league?.sport} · Temporada 2025
      </div>

      {/* Active week alert */}
      <div className="alert-card">
        <span className="alert-icon">🏈</span>
        <div className="alert-body">
          <div className="alert-title">
            <strong>Semana {activeWeekNum}</strong> está activa
          </div>
          <div className="alert-sub">
            {activeWeek.games.length} partidos · Deadline: Dom 14 Sep 5:00 PM
          </div>
        </div>
        <button className="btn-cta" onClick={() => onNavigate('picks')}>
          Hacer Picks →
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="s-label">Mi Posición</div>
          <div className="s-val" style={{ color: 'var(--accent)' }}>#{myRank}</div>
          <div className="s-sub">de {rows.length} jugadores</div>
        </div>
        <div className="stat-card">
          <div className="s-label">Aciertos Sem 1</div>
          <div className="s-val" style={{ color: 'var(--green)' }}>{meRow.correct}</div>
          <div className="s-sub">de {meRow.total} partidos</div>
        </div>
        <div className="stat-card">
          <div className="s-label">Efectividad</div>
          <div className="s-val">{pct}%</div>
          <div className="s-sub">Semana 1</div>
        </div>
        <div className="stat-card">
          <div className="s-label">Semana Activa</div>
          <div className="s-val" style={{ color: 'var(--accent)' }}>{activeWeekNum}</div>
          <div className="s-sub">{activeWeek.games.length} partidos</div>
        </div>
      </div>

      {/* Mini leaderboard */}
      <div className="sec-title">Top Jugadores · Semana 1</div>
      <LeaderboardTable rows={rows} currentUserId={user?.id || 'me'} />
    </div>
  )
}
