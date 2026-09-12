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
  const coveredGameIds = {} // userId → Set(claves de juegos que pickeó, con o sin resultado)
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
    // BUILD-017-G: se registra el pick SIEMPRE (aunque el juego aún no tenga
    // resultado) para que un juego ya elegido jamás cuente como fallido.
    coveredGameIds[uid].add(p.game_id)
    const result = resolveResult(p.game_id, resultByMaster, resultByUuid)
    if (result) {
      userMap[uid].total++
      if (p.pick === result) userMap[uid].correct++
    }
  })

  // Fallidos automáticos: juegos NO elegidos por el usuario y ya cerrados
  // cuando el usuario se unió a la liga. Cerrado = deadline propio (kickoff −
  // 5 min) ya pasado al momento de unirse. BUILD-017-G: se cuenta con o sin
  // resultado — si el kickoff ya pasó el juego se perdió igual aunque todavía
  // no se haya cargado el resultado (caso reportado: "registrado ayer, primer
  // juego ya jugado").
  if (Object.keys(joinedAt).length) {
    Object.keys(userMap).forEach(uid => {
      const rawJoin = joinedAt[uid]
      if (!rawJoin) return
      const joinMs = new Date(rawJoin).getTime()
      if (Number.isNaN(joinMs)) return
      const picked = coveredGameIds[uid]
      games.forEach(g => {
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

// BUILD-017-F — racha actual: juegos acertados de seguido (consecutivos)
// terminando en el último partido finalizado con resultado, en orden
// cronológico. Un juego con resultado que el usuario no pickeó corta la racha.
// Soportan las dos claves (match BUILD-017-C): el pick se guarda con el
// game_id maestro o con el UUID de league_games.id en partidos manuales.
const sortFinishedByTime = (games) =>
  (games || [])
    .filter(g => g.finished && g.result)
    .sort((a, b) => {
      const ta = new Date(a.game_time || a.time || 0).getTime()
      const tb = new Date(b.game_time || b.time || 0).getTime()
      return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb)
    })

export const calcStreak = (picks, games, userId) => {
  const finished = sortFinishedByTime(games)
  if (!finished.length) return 0
  const pickByGame = {}
  ;(picks || []).forEach(p => {
    if (p.user_id !== userId || p.game_id == null) return
    pickByGame[p.game_id] = p.pick
  })
  let streak = 0
  finished.forEach(g => {
    const key = g.game_id != null ? g.game_id : g.id
    const pick = key != null ? pickByGame[key] : undefined
    if (pick == null) { streak = 0; return }
    if (pick === g.result) streak++
    else streak = 0
  })
  return streak
}

// Builds a map userId → current streak en una sola pasada por los juegos.
export const calcStreaks = (picks, games, userIds) => {
  const map = {}
  ;(userIds || []).forEach(uid => { map[uid] = calcStreak(picks, games, uid) })
  return map
}