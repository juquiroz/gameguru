// Modelo de presencia "en línea" de los participantes.
// BUILD-TC-001 NO integra Supabase Realtime: la información de conexión aún no
// está disponible. El modelo queda preparado (online: boolean | null) para que
// cuando llegue Realtime (BUILD-TC-006) solo haya que alimentar el mapa online.

export const ONLINE_SOURCE = {
  realtime: 'realtime',
  none: 'none',
}

// Estado de plataforma: hoy no hay presencia en tiempo real configurada.
export const presenceAvailability = () => ONLINE_SOURCE.none

export const isPresenceAvailable = () => presenceAvailability() === ONLINE_SOURCE.realtime

// Decora los miembros con su estado de conexión (null = desconocido).
export function decorateParticipants(members, onlineMap = {}) {
  if (!members) return []
  return members.map(m => ({
    ...m,
    online: Object.prototype.hasOwnProperty.call(onlineMap, m.user_id)
      ? onlineMap[m.user_id]
      : null,
  }))
}
