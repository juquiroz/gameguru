export const PLATFORM_ROLES = {
  USER: 'user',
  PLATFORM_ADMIN: 'platform_admin',
  PLATFORM_SUPERADMIN: 'platform_superadmin',
}

export const PLATFORM_ROLES_LIST = Object.values(PLATFORM_ROLES)

// Orden de jerarquía de roles de plataforma (BUILD-SUP-000).
export const PLATFORM_ROLE_RANK = {
  [PLATFORM_ROLES.USER]: 0,
  [PLATFORM_ROLES.PLATFORM_ADMIN]: 1,
  [PLATFORM_ROLES.PLATFORM_SUPERADMIN]: 2,
}

export const isValidPlatformRole = (role) =>
  role === PLATFORM_ROLES.USER ||
  role === PLATFORM_ROLES.PLATFORM_ADMIN ||
  role === PLATFORM_ROLES.PLATFORM_SUPERADMIN

// Cualquier valor desconocido/ausente cae a 'user' (fail-closed).
export const normalizePlatformRole = (role) =>
  isValidPlatformRole(role) ? role : PLATFORM_ROLES.USER

// Claim del JWT: auth.users.raw_app_meta_data.platform_role → JWT `app_metadata`.
// `useSuperAdmin` lo extrae de user.app_metadata; RLS usa el mismo claim en SQL.
export const platformRoleFromJwt = (user) =>
  normalizePlatformRole(user && user.app_metadata && user.app_metadata.platform_role)

export const isPlatformSuperAdmin = (role) => role === PLATFORM_ROLES.PLATFORM_SUPERADMIN

export const isPlatformAdmin = (role) =>
  role === PLATFORM_ROLES.PLATFORM_ADMIN || role === PLATFORM_ROLES.PLATFORM_SUPERADMIN

// Acceso de lectura a la consola de plataforma (SUP-001, read-only).
export const canReadPlatform = (role) => isPlatformAdmin(role)
