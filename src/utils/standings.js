// BUILD-017-B — juegos cerrados antes de unirse cuentan como fallidos.
// Un participante que entra con la liga ya comenzada rinde cuentas por los
// juegos que ya estaban cerrados al momento de unirse: cuentan en su
// denominador (total) como fallo, aunque nunca haya podido elegirlos. Un
// juego cuenta como "cerrado al unirse" cuando su deadline propio (kickoff
// − 5 min, igual que isGameLocked) ya había pasado en joined_at del miembro.
// Los juegos que el miembro SÍ pudo elegir pero no eligió siguen sin contar
// (no se penaliza el olvido): la regla aplica solo a los pre-cerrados.
// Para activarla hay que pasar `{ joinedAt: { [userId]: epochMs } }`; sin él
// el comportamiento es exactamente el histórico (solo cuentan los picks).
const GAME_LOCK_GRACE_MS = 5 * 60 * 1000

// BUILD-017-C — matching de claves robusto: un pick se guarda con el `game_id`
// del calendario maestro cuando el partido se importó desde master, pero con el
// UUID de `league_games.id` cuando el partido se cargó manualmente (game_id
// NULL). Se aceptan ambas claves para no perder picks en vistas públicas ni en
// los standings.
const resolveResult = (gameId, byMaster, byUuid) =>
  (gameId != null && (byMaster[gameId] || byUuid[gameId])) || null

export const calcStandings = (picks, games, profileMap, opts = {}) => {
  const joinedAt = opts.joinedAt || {}

  const resultByMaster = {}
  const resultByUuid = {}
  games.forEach(g => {
    if (!g.result) return
    if (g.game_id != null) resultByMaster[g.game_id] = g.result
    if (g.id != null) resultByUuid[g.id] = g.result
  })

  const userMap = {}
  const coveredGameIds = {} // userId → Set(claves de juegos con result que pickeó)
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
    if (!coveredGameIds[uid]) coveredGameIds[uid] = new Set()
    const result = resolveResult(p.game_id, resultByMaster, resultByUuid)
    if (result) {
      coveredGameIds[uid].add(p.game_id)
      userMap[uid].total++
      if (p.pick === result) userMap[uid].correct++
    }
  })

  // Fallidos automáticos: juegos con resultado, no elegidos por el usuario y
  // ya cerrados cuando el usuario se unió a la liga.
  if (Object.keys(joinedAt).length) {
    Object.keys(userMap).forEach(uid => {
      const rawJoin = joinedAt[uid]
      if (!rawJoin) return
      const joinMs = new Date(rawJoin).getTime()
      if (Number.isNaN(joinMs)) return
      const picked = coveredGameIds[uid]
      games.forEach(g => {
        if (!g.result) return
        const covered =
          picked &&
          ((g.game_id != null && picked.has(g.game_id)) ||
            (g.id != null && picked.has(g.id)))
        if (covered) return
        const t = g.game_time || g.time
        if (!t) return
        const deadline = new Date(t).getTime() - GAME_LOCK_GRACE_MS
        if (Number.isNaN(deadline)) return
        if (joinMs > deadline) userMap[uid].total++
      })
    })
  }

  return Object.values(userMap).sort((a, b) => b.correct - a.correct || a.total - b.total)
}