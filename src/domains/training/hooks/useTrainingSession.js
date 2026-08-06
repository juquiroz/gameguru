import { useState, useEffect, useCallback, useRef } from 'react'
import { leaguesApi, profilesApi } from '../../../supabase'
import { trainingSessionService } from '../services/trainingSessionService'
import { getDerivedPhase } from '../models/states'
import { decorateParticipants, presenceAvailability } from '../models/presence'
import { trainingCampDirector, EVENT_ACTIONS } from '../../event'

// Hook de datos de la sesión de entrenamiento (BUILD-TC-003 — Event Director).
// Carga estado, miembros y perfiles, y expone acciones de transición que se
// resuelven SIEMPRE a través del TrainingCampDirector (dispatch). El director
// también avanza por hora en cada tick (waiting→countdown→training_started).
export function useTrainingSession({ leagueId, userId, league }) {
  const [event, setEvent] = useState(null)
  const [persisted, setPersisted] = useState('local')
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => new Date())

  const eventRef = useRef(event)
  useEffect(() => { eventRef.current = event }, [event])

  const load = useCallback(async () => {
    if (!leagueId) return
    setLoading(true)
    const [evRes, membersRes] = await Promise.all([
      trainingSessionService.get(leagueId),
      leaguesApi.getMembers(leagueId),
    ])
    setEvent(evRes.data)
    setPersisted(evRes.persisted)
    if (membersRes.data) {
      setMembers(membersRes.data)
      const userIds = [...new Set(membersRes.data.map(m => m.user_id))]
      const { data } = await profilesApi.getMany(userIds)
      setProfiles(data || [])
    }
    setLoading(false)
  }, [leagueId])

  useEffect(() => { load() }, [load])

  // Tick de 1s: refresca el reloj y deja que el director avance el evento por hora.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Aplica un parche del director: optimista + persistencia (nube o local).
  const applyPatch = useCallback(async (patch) => {
    setEvent(prev => ({ ...(prev || {}), ...patch }))
    const r = await trainingSessionService.update(leagueId, patch)
    setEvent(r.data)
    setPersisted(r.persisted)
  }, [leagueId])

  // Auto-avance orquestado por el director en cada tick.
  useEffect(() => {
    const current = eventRef.current
    if (!current) return
    const patch = trainingCampDirector.dispatch(current, EVENT_ACTIONS.TICK, { now })
    if (patch) applyPatch(patch)
  }, [now, applyPatch])

  const isAdmin = !!league && (league.admin_id === userId || league.role === 'admin')

  const phase = getDerivedPhase(event, now)
  const remainingMs = event?.start_at ? new Date(event.start_at) - now : null

  const profileMap = {}
  profiles.forEach(p => { profileMap[p.id] = p.username || p.id.slice(0, 8) })
  const participants = decorateParticipants(members, {}).map(m => ({
    ...m,
    username: profileMap[m.user_id] || m.user_id.slice(0, 8),
  }))

  const openLobby = async () => {
    const patch = trainingCampDirector.dispatch(eventRef.current, EVENT_ACTIONS.OPEN_LOBBY, { now })
    if (patch) await applyPatch(patch)
  }

  const startNow = async () => {
    const patch = trainingCampDirector.dispatch(eventRef.current, EVENT_ACTIONS.START_NOW, { now })
    if (patch) await applyPatch(patch)
  }

  const cancelEvent = async (reason) => {
    const patch = trainingCampDirector.dispatch(eventRef.current, EVENT_ACTIONS.CANCEL, { now, reason })
    if (patch) await applyPatch(patch)
  }

  return {
    event,
    persisted,
    phase,
    remainingMs,
    participants,
    loading,
    isAdmin,
    now,
    steps: trainingCampDirector.getSteps(),
    currentStep: event ? trainingCampDirector.getCurrentStep(event, now) : null,
    lastCompletedStep: event ? trainingCampDirector.getLastCompletedStep(event, now) : null,
    sessionNo: event?.session_no ?? null,
    openLobby,
    startNow,
    cancelEvent,
    reload: load,
  }
}

export { presenceAvailability }
