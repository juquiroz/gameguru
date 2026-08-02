export const calcStandings = (picks, games, profileMap) => {
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
