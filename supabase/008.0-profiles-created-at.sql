-- ============================================================================
-- BUILD-SUP-003 — profiles.created_at (fecha de registro en public schema)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL) o
-- vía Management API /database/query. Idempotente: puede ejecutarse varias
-- veces sin errores.
--
-- Objetivo (PLAN SUP-003 §1/§20):
--   Dar a la consola de usuarios (read-only) la fecha de registro SIN exponer
--   auth.users al navegador (0 grants a anon/authenticated; RLS lo protege).
--   La fuente es auth.users.created_at, que NO se modifica.
--
-- Proceso obligatorio:
--   1) columna nullable;
--   2) backfill desde auth.users.created_at;
--   3) verificar 0 NULLs ANTES de NOT NULL (aborta en vez de inventar timestamps);
--   4) NOT NULL + DEFAULT now() para nuevos signups;
--   5) índices realmente útiles para las queries de SUP-003:
--        - profiles.created_at DESC (orden del listado por "registrado");
--        - league_members(user_id) (detalle: ligas de un usuario sin full-scan).
-- NO se tocan auth.users, otros perfiles ni timestamps existentes.
-- ============================================================================

-- 1) Columna nullable (solo si no existe).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN created_at timestamptz;
  END IF;
END $$;

-- 2) Backfill desde auth.users.created_at (solo perfiles sin valor; no toca auth).
UPDATE public.profiles p
SET created_at = u.created_at
FROM auth.users u
WHERE u.id = p.id
  AND p.created_at IS NULL;

-- 3) Verificación: 0 NULLs antes de NOT NULL (fallar alto, nunca inventar fechas).
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE created_at IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'profiles.created_at backfill incomplete: % profile(s) without created_at', n;
  END IF;
END $$;

-- 4) NOT NULL + default para los nuevos signups (handle_new_user inserta sin
-- created_at → toma now(), momento equivalente a la creación del auth user).
ALTER TABLE public.profiles ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.profiles ALTER COLUMN created_at SET NOT NULL;

-- 5) Índices útiles para SUP-003 (idempotentes).
CREATE INDEX IF NOT EXISTS profiles_created_at_idx
  ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS league_members_user_id_idx
  ON public.league_members (user_id);
