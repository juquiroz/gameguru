import { useState, useEffect, useCallback } from 'react'
import { authApi, profilesApi } from '../supabase'

export function useAuth() {
  const [user,    setUser]    = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Listen to auth state changes
  useEffect(() => {
    authApi.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: listener } = authApi.onAuthChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signUp = useCallback(async (email, password, realName) => {
    const { data, error } = await authApi.signUp(email, password, {
      realName: realName || email.split('@')[0],
    })
    if (error) return { error }

    // Fallback defensivo idempotente: el trigger handle_new_user crea el
    // perfil con real_name/avatar; este upsert solo refuerza por si el trigger
    // no corre en el entorno. No setea nickname: es por liga.
    if (data.user) {
      await profilesApi.upsert({
        id: data.user.id,
        real_name: realName || email.split('@')[0],
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

  const signOut = useCallback(async () => {
    await authApi.signOut()
    setUser(null)
    setSession(null)
  }, [])

  return { user, session, loading, signUp, signIn, signInWithGoogle, signOut }
}
