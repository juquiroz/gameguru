// Draft de picks sin enviar (localStorage) — persiste las selecciones locales
// cuando el tab es descargado por el sistema en móvil (reload al volver).
export const draftKey = (userId, leagueId, week) =>
  `gameguru_picks_draft_${userId}_${leagueId}_${week}`

export function readDraft(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeDraft(key, map) {
  try {
    localStorage.setItem(key, JSON.stringify(map))
  } catch {
    // storage lleno o no disponible: el draft se pierde pero el app sigue vivo
  }
}

export function dropDraft(key) {
  try { localStorage.removeItem(key) } catch {}
}