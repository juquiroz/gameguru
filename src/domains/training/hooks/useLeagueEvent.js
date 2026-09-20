import { useState, useEffect } from 'react'
import { trainingSessionService } from '../services/trainingSessionService'

// BUILD-TC-005.4 — Lectura (solo lectura) del evento más reciente de una liga
// para superficies fuera del Lobby (dashboard). NO orquesta nada: no monta
// directores ni dispara efectos de transición (a diferencia de
// useTrainingSession); solo expone la sesión para que la UI decida (CTA
// MAKE YOUR PICKS, invitaciones según el estado del roster).
export function useLeagueEvent(leagueId) {
  const [event, setEvent] = useState(null)

  useEffect(() => {
    let mounted = true
    setEvent(null)
    if (!leagueId) return () => { mounted = false }
    trainingSessionService.get(leagueId)
      .then(res => { if (mounted) setEvent(res?.data || null) })
      .catch(() => { if (mounted) setEvent(null) })
    return () => { mounted = false }
  }, [leagueId])

  return event
}
