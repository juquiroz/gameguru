import { useState, useEffect } from 'react'
import { profilesApi } from '../supabase'
import { platformRoleFromJwt, isPlatformSuperAdmin, isPlatformAdmin as isPlatformAdminRole } from '../domains/platform'

// BUILD-SUP-000/005 — Rol de plataforma (SUP-000/001).
// Fuente primaria: claim JWT `app_metadata.platform_role` (sincronizado desde
// profiles.platform_role por el trigger 007.0; llega al JWT tras re-login o
// refresh del token). Fallback legacy: `profiles.is_superadmin` (columna
// deprecated) solo cuando el claim no aporta rol.
//
// Devuelve dos flags:
//   - isPlatformAdmin:  lectura de la consola read-only ligas/usuarios/API
//                       (platform_admin O platform_superadmin, BUILD-SUP-005).
//   - isSuperAdmin:     operaciones de riesgo (calendario maestro, reconcile).
export function useSuperAdmin(user) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false)
      setIsPlatformAdmin(false)
      setChecking(false)
      return
    }

    const role = platformRoleFromJwt(user)
    if (isPlatformSuperAdmin(role)) {
      setIsSuperAdmin(true)
      setIsPlatformAdmin(true)
      setChecking(false)
      return
    }
    if (isPlatformAdminRole(role)) {
      setIsSuperAdmin(false)
      setIsPlatformAdmin(true)
      setChecking(false)
      return
    }

    setChecking(true)
    profilesApi.get(user.id).then(({ data, error }) => {
      const legacy = data?.is_superadmin === true && !error
      setIsSuperAdmin(legacy)
      setIsPlatformAdmin(legacy)
      setChecking(false)
    }).catch(() => {
      setIsSuperAdmin(false)
      setIsPlatformAdmin(false)
      setChecking(false)
    })
  }, [user])

  return { isSuperAdmin, isPlatformAdmin, checking }
}