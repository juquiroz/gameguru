-- ============================================================================
-- BUILD-SUP-000 — Platform roles (profiles.platform_role + JWT claim sync)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- Alcance (PLAN SUP §SUP-000):
--   1) `profiles.platform_role` → rol de plataforma: 'user' (default),
--      'platform_admin' (declarado, dormante) o 'platform_superadmin'
--      (operativo). `profiles.is_superadmin` queda como columna legacy
--      (deprecated); backfill: is_superadmin=true → platform_superadmin.
--   2) JWT claim: el rol viaja en `auth.users.raw_app_meta_data.platform_role`
--      (→ JWT `app_metadata`). RLS debe confiar en el claim (`auth.jwt()`),
--      no en lookups a profiles ni en el frontend.
--   3) Trigger `trg_sync_platform_role_to_jwt` (SECURITY DEFINER): mantiene
--      `raw_app_meta_data.platform_role` sincronizado con
--      `profiles.platform_role` en cada INSERT / UPDATE de platform_role.
--      Los JWT ya emitidos no cambian: el usuario necesita re-login (o refresh
--      del token) para recibir el nuevo claim.
--   4) Reconciliación del signup trigger `handle_new_user` (existía en la BD
--      viva pero no estaba versionado en el repo). CREATE OR REPLACE
--      idempotente con definición idéntica a la viva.
--
-- ESCALAMIENTO: un usuario NO puede setear su propio platform_role. Las
--   políticas UPDATE/INSERT de `profiles` se endurecen en
--   007.1-platform-rls.sql (misma sesión de despliegue, sin ventana de
--   exposición).
-- ============================================================================

-- 1) Columna platform_role + CHECK (NOT NULL DEFAULT aplica a filas existentes)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS platform_role text NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_platform_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_platform_role_check
      CHECK (platform_role IN ('user', 'platform_admin', 'platform_superadmin'));
  END IF;
END $$;

-- 2) Helpers de rol desde el JWT claim (única fuente para RLS)
CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata') ->> 'platform_role', '') = 'platform_superadmin';
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata') ->> 'platform_role', '')
         IN ('platform_admin', 'platform_superadmin');
$$;

-- 3) Trigger de sincronización del claim (SECURITY DEFINER, search_path vacío).
CREATE OR REPLACE FUNCTION public.sync_platform_role_to_jwt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object('platform_role', NEW.platform_role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_platform_role_to_jwt ON public.profiles;
CREATE TRIGGER trg_sync_platform_role_to_jwt
  AFTER INSERT OR UPDATE OF platform_role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_platform_role_to_jwt();

-- 4) Backfill is_superadmin=true → platform_superadmin.
--    Se ejecuta DESPUÉS de crear el trigger para que el claim se sincronice
--    en auth.users (el re-login del superadmin lo verá en su JWT).
UPDATE public.profiles
SET platform_role = 'platform_superadmin'
WHERE is_superadmin = true
  AND platform_role = 'user';

-- 5) Reconciliación del signup trigger (repositorio == BD viva), idempotente.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
