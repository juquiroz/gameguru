import { useState, useEffect } from 'react'
import { profilesApi } from '../supabase'

export function useSuperAdmin(user) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false)
      setChecking(false)
      return
    }
    setChecking(true)
    profilesApi.get(user.id).then(({ data, error }) => {
      setIsSuperAdmin(data?.is_superadmin === true && !error)
      setChecking(false)
    }).catch(() => {
      setIsSuperAdmin(false)
      setChecking(false)
    })
  }, [user])

  return { isSuperAdmin, checking }
}
