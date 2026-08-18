-- ============================================================================
-- BUILD-SUP-000 — Console read RLS (SUP-001 Overview)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores.
--
-- La consola de plataforma lee con el cliente anónimo autenticado + claim JWT
-- de platform admin (read-only, SIN service_role en el navegador). Las tablas
-- con SELECT público (leagues, profiles, league_members, master_games,
-- game_weeks, training_sessions, pick_submissions) ya son legibles; SOLO
-- `picks` y `league_games` están restringidas a la membresía y necesitan una
-- política de lectura global para platform admins.
--
-- Alcance (read-only): las nuevas policies son SOLO SELECT y exigen
-- public.is_platform_admin() (claim JWT app_metadata.platform_role en
-- platform_admin / platform_superadmin). Las policies de membresía existentes
-- siguen vigentes (OR entre policies de SELECT).
-- ============================================================================

CREATE POLICY "Platform admins can read all picks" ON public.picks
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can read all league_games" ON public.league_games
  FOR SELECT
  USING (public.is_platform_admin());
