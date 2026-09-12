-- ============================================================================
-- BUILD-SUP-000 — Platform RLS foundation
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores.
--
-- Alcance (PLAN SUP §SUP-000 — RLS):
--   1) `master_games`: policies basadas en el JWT claim `platform_role`
--      (reemplazan el lookup a `profiles.is_superadmin`) + política UPDATE que
--      faltaba (el UI "Admin Global" edita partidos con masterGamesApi.update
--      y hoy RLS lo rechaza porque no existe policy de UPDATE).
--   2) `profiles`: bloquea el auto-escalamiento. La policy UPDATE actual
--      `id = auth.uid()` (sin guarda de columnas) permitiría a cualquier
--      usuario setear su propio platform_role='platform_superadmin'. Nuevas
--      policies:
--        - UPDATE: WITH CHECK exige que platform_role no cambie (lee el valor
--          actual vía subquery; RLS SELECT en profiles es público).
--        - INSERT: solo plataforma_role = 'user'. `handle_new_user` es
--          SECURITY DEFINER (bypassa RLS) y no se ve afectado.
--
-- GAPS CONOCIDOS (fuera de alcance de SUP-000, ver PLAN SUP):
--   - S1: training_sessions / game_weeks / pick_submissions public-read.
--   - S2: league_members public-read (005.4 nunca se aplicó en la BD viva:
--         `league_roster_open` no existe).
--   - profiles "Anyone can view profiles" (SELECT true) se mantiene (el rol
--     ya era público vía is_superadmin).
-- ============================================================================

-- ── master_games: switch a JWT claim + política UPDATE ───────────────────────
DROP POLICY IF EXISTS "Master games deletable by superadmins" ON public.master_games;
DROP POLICY IF EXISTS "Master games writable by superadmins" ON public.master_games;

CREATE POLICY "Master games insert by platform superadmin" ON public.master_games
  FOR INSERT
  WITH CHECK (public.is_platform_superadmin());

CREATE POLICY "Master games update by platform superadmin" ON public.master_games
  FOR UPDATE
  USING (public.is_platform_superadmin())
  WITH CHECK (public.is_platform_superadmin());

CREATE POLICY "Master games delete by platform superadmin" ON public.master_games
  FOR DELETE
  USING (public.is_platform_superadmin());

-- ── profiles: prevenir auto-escalamiento de platform_role ────────────────────
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can upsert their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND platform_role IN (
      SELECT p.platform_role FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can upsert their own profile" ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid() AND platform_role = 'user');
