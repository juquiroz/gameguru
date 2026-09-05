import { useState, useEffect } from 'react'
import { profilesApi } from '../supabase'
import { platformRoleFromJwt, isPlatformSuperAdmin } from '../domains/platform'

// BUILD-SUP-000 — Rol de plataforma (SUP-000/001).
// Fuente primaria: claim JWT `app_metadata.platform_role` (sincronizado desde
// profiles.platform_role por el trigger 007.0; llega al JWT tras re-login o
// refresh del token). Fallback legacy: `profiles.is_superadmin` (columna
// deprecated) solo cuando el claim no aporta rol.
export function useSuperAdmin(user) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false)
      setChecking(false)
      return
    }

    if (isPlatformSuperAdmin(platformRoleFromJwt(user))) {
      setIsSuperAdmin(true)
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
