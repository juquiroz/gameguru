export const IDENTITY_FALLBACK = 'Jugador'

export const isEmailLike = (value) => {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())
}

export const isNicknameUnique = (members, nickname, userId) => {
  if (!nickname || !String(nickname).trim()) return { unique: false, error: 'nickname_required' }
  const normalized = String(nickname).trim().toLowerCase()
  const clash = (members || []).some(
    (m) =>
      m.user_id !== userId &&
      String(m.nickname || '').trim().toLowerCase() === normalized
  )
  return clash ? { unique: false, error: 'nickname_taken' } : { unique: true, error: null }
}

export const resolveDisplayName = ({ nickname, realName, revealed = false }) => {
  const nick = nickname && String(nickname).trim() ? String(nickname).trim() : null
  // real_name NUNCA se muestra si parece un email: un correo es contacto,
  // no identidad, y quedaría expuesto a todos al revelar la liga.
  const real = !isEmailLike(realName) && String(realName || '').trim()
    ? String(realName).trim()
    : null

  if (revealed) {
    if (real && nick) return `${real} (${nick})`
    if (real) return real
    if (nick) return nick
    return IDENTITY_FALLBACK
  }
  // En pantallas de liga el display es el nick de esa liga; nunca se cae a
  // username global (que para signups por email puede ser el prefijo del correo).
  return nick || IDENTITY_FALLBACK
}

export const buildLeagueIdentityMap = (members = [], profilesById = {}, { revealed = false } = {}) => {
  const map = {}
  for (const m of members) {
    const profile = profilesById[m.user_id] || {}
    map[m.user_id] = {
      nickname: m.nickname || null,
      realName: profile.real_name || null,
      username: profile.username || null,
      display: resolveDisplayName({
        nickname: m.nickname,
        realName: profile.real_name,
        revealed,
      }),
    }
  }
  return map
}

export const revealLifecycle = ({ finished = false, revealed = false } = {}) => {
  return {
    canFinish: !finished,
    canReveal: finished && !revealed,
    isFinished: Boolean(finished),
    isRevealed: Boolean(revealed),
  }
}
