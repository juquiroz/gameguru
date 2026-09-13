// BUILD-017-G2 — cualquier juego cerrado sin pick = fallido para todos.
// Un juego se considera "cerrado" cuando su deadline (kickoff − 5 min,
// igual que isGameLocked) ya venció respecto al momento del cómputo.
// Todo miembro que no haya pickeado un juego cerrado recibe un fallido en
// su denominador (total), independientemente de cuándo se unió a la liga.
// Esto penaliza tanto el olvido como la llegada tardía. Un juego cerrado
// sin resultado cargado también cuenta como perdido (el partido se jugó).
// Los picks sin resultado cargado cubren el juego (no se duplica fallido)
// pero no suman acierto hasta que el resultado se cargue.
const GAME_LOCK_GRACE_MS = 5 * 60 * 1000

// BUILD-017-C — matching de claves robusto: un pick se guarda con el `game_id`
// del calendario maestro cuando el partido se importó desde master, pero con el
// UUID de `league_games.id` cuando el partido se cargó manualmente (game_id
// NULL). Se aceptan ambas claves para no perder picks en vistas públicas ni en
// los standings.
const resolveResult = (gameId, byMaster, byUuid) =>
  (gameId != null && (byMaster[gameId] || byUuid[gameId])) || null

export const calcStandings = (picks, games, profileMap, opts = {}) => {
  // BUILD-017-G2: referencia temporal del cómputo. Default, el momento real;
  // los tests inyectan un `now` fijo para ser deterministas.
  const now = opts.now != null ? opts.now : Date.now()

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

  // Fallidos automáticos: juegos NO elegidos por el usuario cuyo deadline
  // propio (kickoff − 5 min) ya venció al momento del cómputo. BUILD-017-G2:
  // se cuenta para TODOS los miembros (con o sin resultado, hayan entrado
  // antes o después) — un juego ya cerrado sin pick es un fallo. Los juegos
  // con deadline futuro todavía no cuentan.
  games.forEach(g => {
    const t = g.game_time || g.time
    if (!t) return
    const deadline = new Date(t).getTime() - GAME_LOCK_GRACE_MS
    if (Number.isNaN(deadline)) return
    if (deadline >= now) return // juego futuro → aún no cuenta como fallido.
    Object.keys(userMap).forEach(uid => {
      const picked = coveredGameIds[uid]
      const covered =
        picked &&
        ((g.game_id != null && picked.has(g.game_id)) ||
          (g.id != null && picked.has(g.id)))
      if (covered) return
      userMap[uid].total++
    })
  })

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