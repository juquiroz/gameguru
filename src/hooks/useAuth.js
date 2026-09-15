import { useState, useEffect, useCallback } from 'react'
import { authApi, profilesApi, isRecoveryLink } from '../supabase'

export function useAuth() {
  const [user,    setUser]    = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // Inicializado desde la URL de arranque: cubre el caso real donde el SDK
  // consume el token del link antes de registrar el listener y no llega el
  // evento PASSWORD_RECOVERY (→ el usuario entraría al dashboard directo).
  const [recovery, setRecovery] = useState(isRecoveryLink)

  // Listen to auth state changes. El listener se registra ANTES de getSession:
  // la inicialización del SDK procesa el hash del link de recuperación y
  // dispara PASSWORD_RECOVERY durante esa primera llamada; si el listener se
  // registrara después, el evento se perdería.
  useEffect(() => {
    const { data: listener } = authApi.onAuthChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    authApi.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signUp = useCallback(async (email, password, realName) => {
    // real_name SOLO si el usuario lo escribió explícitamente: nunca se
    // deriva del email (un email guardado como nombre se mostraría a todos
    // los jugadores al revelar la liga).
    const meta = realName ? { real_name: realName } : {}
    const { data, error } = await authApi.signUp(email, password, meta)
    if (error) return { error }

    // Fallback defensivo idempotente: el trigger handle_new_user crea el
    // perfil con real_name/avatar; este upsert solo refuerza por si el trigger
    // no corre en el entorno. No setea nickname: es por liga.
    if (data.user && realName) {
      await profilesApi.upsert({
        id: data.user.id,
        real_name: realName,
      })
    }
    return { data }
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await authApi.signIn(email, password)
    if (error) return { error }
    return { data }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await authApi.signInWithGoogle()
    if (error) return { error }
    return { data }
  }, [])

  const resetPassword = useCallback(async (email) => {
    const { error } = await authApi.resetPassword(email)
    return { error }
  }, [])

  const updatePassword = useCallback(async (newPassword) => {
    const { data, error } = await authApi.updatePassword(newPassword)
    if (error) return { error }
    return { data }
  }, [])

  // Cierra la sesión de recuperación y devuelve al login.
  const completeRecovery = useCallback(async () => {
    await authApi.signOut()
    setRecovery(false)
    setUser(null)
    setSession(null)
  }, [])

  const signOut = useCallback(async () => {
    await authApi.signOut()
    setUser(null)
    setSession(null)
  }, [])

  return { user, session, loading, recovery, signUp, signIn, signInWithGoogle, resetPassword, updatePassword, completeRecovery, signOut }
}
