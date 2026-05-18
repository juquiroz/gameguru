import { useState } from 'react'
import LeaderboardTable from '../components/LeaderboardTable'
import { NFL_WEEKS } from '../data/nflData'

// Mock data — replace with real Supabase query per league
const MOCK_ROWS = [
  { userId: 'me', username: null,       correct: 7, total: 8 },
  { userId: 'u2', username: 'carlos.m', correct: 6, total: 8 },
  { userId: 'u3', username: 'juan.p',   correct: 6, total: 8 },
  { userId: 'u4', username: 'andrea.v', correct: 5, total: 8 },
  { userId: 'u5', username: 'rob.c',    correct: 4, total: 8 },
]

export default function Leaderboard({ user }) {
  const [activeWeek, setActiveWeek] = useState(1)
  const weekFinished = NFL_WEEKS[activeWeek]?.finished

  const rows = MOCK_ROWS.map((r, i) =>
    i === 0 ? { ...r, username: user?.email?.split('@')[0] || 'Tú', userId: user?.id || 'me' }
            : r
  )

  return (
    <div className="page">
      <div className="page-title">Tabla de Posiciones</div>
      <div className="page-sub">El que más aciertos logre gana la semana</div>

      <div className="week-tabs">
        {Object.entries(NFL_WEEKS).map(([wk, wd]) => (
          <button
            key={wk}
            className={`week-tab ${activeWeek == wk ? 'active' : ''}`}
            onClick={() => setActiveWeek(Number(wk))}
          >
            {wd.label}
            {wd.finished && <span className="fin-tag">FINAL</span>}
          </button>
        ))}
      </div>

      {!weekFinished ? (
        <div className="empty-state">
          <div className="big">🔒</div>
          La Semana {activeWeek} aún no ha finalizado.
          <br />
          <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
            Los resultados estarán disponibles cuando terminen los partidos.
          </span>
        </div>
      ) : (
        <LeaderboardTable rows={rows} currentUserId={user?.id || 'me'} />
      )}
    </div>
  )
}
