export default function LeaderboardTable({ rows, currentUserId, showWinner }) {
  if (!rows?.length) return (
    <div className="empty-state">
      <div className="big">📊</div>
      No hay datos aún para esta semana.
    </div>
  )

  const rankMedal = (i) => {
    if (i === 0) return { icon: '🥇', cls: 'gold'   }
    if (i === 1) return { icon: '🥈', cls: 'silver' }
    if (i === 2) return { icon: '🥉', cls: 'bronze' }
    return { icon: `#${i + 1}`, cls: '' }
  }

  const maxCorrect = rows.reduce((max, r) => Math.max(max, r.correct), 0)

  return (
    <div className="lb-table">
      <div className="lb-head">
        <div>#</div>
        <div>Jugador</div>
      </div>

      {rows.map((row, i) => {
        const { icon, cls } = rankMedal(i)
        const isMe = row.userId === currentUserId
        const isWinner = showWinner && row.correct === maxCorrect && maxCorrect > 0
        const initials = (row.username || '??').slice(0, 2).toUpperCase()

        return (
          <div key={row.userId} className={`lb-row ${isMe ? 'is-me' : ''} ${isWinner ? 'is-winner' : ''}`}>
            <div className={`lb-rank ${cls}`}>{icon}</div>
            <div className="lb-user">
              <div className="lb-avatar">{initials}</div>
              <div>
                <div className="lb-uname">
                  <span className="lb-name">{row.username || 'Jugador'}</span>
                  <span className="lb-score-inline">{row.correct}/{row.total} aciertos</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {isWinner && <span className="lb-badge lb-badge-winner">🏆 GANADOR</span>}
                  {isMe && <span className="lb-badge">Tú</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
