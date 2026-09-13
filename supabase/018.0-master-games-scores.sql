-- ============================================================================
-- BUILD-AUTO-RESULTS-001 — Columnas de scores en master_games + activación
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores.
--
-- OBJETIVO (PLAN AUTO-RESULTS, 2026-09-13):
--   La actualización automática de resultados (Edge Function `results-sync`
--   + `reconcile`) escribe/lee `home_score`, `away_score`, `result` y
--   `finished` en `master_games`, pero esas columnas NO existen todavía (solo
--   viven en `league_games`). Sin ellas, ambas Edge Functions fallan en el
--   primer SELECT. Esta migración cierra la brecha y activa la liga:
--
--   1) master_games: columnas de resultados (mismo contrato que league_games).
--   2) leagues: activa `auto_update_results` en las ligas oficiales NFL 2026
--      (NflMasters2026 y Momios2026), confirmadas vía REST como las únicas.
--   3) leagues: policy de UPDATE para que el toggle "Actualizar automáticamente"
--      (SyncStatus) funcione desde la UI sin usar service_role.
--
-- RLS: no se cambia la semántica de SELECT/INSERT existente; solo se agrega
-- la policy de UPDATE que faltaba sobre `leagues`.
-- ============================================================================

-- ── 1) master_games: columnas de resultados ───────────────────────────────────
ALTER TABLE public.master_games
  ADD COLUMN IF NOT EXISTS home_score smallint,
  ADD COLUMN IF NOT EXISTS away_score smallint,
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS finished boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS master_games_results_idx
  ON public.master_games (finished);

-- ── 2) leagues: activar actualización automática en las ligas NFL 2026 ────────
-- Idempotente: solo las dos ligas oficiales (NflMasters2026, Momios2026);
-- si en el futuro se crea otra liga, queda en false por defecto.
UPDATE public.leagues
SET auto_update_results = true
WHERE sport = 'NFL'
  AND season = '2026'
  AND league_mode IN ('preseason', 'regular')
  AND id IN (
    '7ed658fb-fe8f-47b7-89c4-f5033f1d3f97', -- NflMasters2026
    '479e5955-6fb2-408c-a141-cb3d7de8d9c1'  -- Momios2026
  );

-- ── 3) leagues: policy de UPDATE para el toggle de SyncStatus ─────────────────
-- Espejo del contrato del frontend (canManageLeague): admin de la liga
-- (leagues.admin_id) o miembro con role='admin', más platform admins.
DROP POLICY IF EXISTS leagues_auto_sync_update ON public.leagues;

CREATE POLICY leagues_auto_sync_update ON public.leagues
  FOR UPDATE
  USING (
    public.is_platform_admin()
    OR admin_id = auth.uid()
    OR id IN (
      SELECT league_id FROM public.league_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR admin_id = auth.uid()
    OR id IN (
      SELECT league_id FROM public.league_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT 'master_games columns' AS check_name, count(*) AS value
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'master_games'
  AND column_name IN ('home_score', 'away_score', 'result', 'finished');

SELECT 'leagues auto_update_results' AS check_name,
       count(*) FILTER (WHERE auto_update_results) AS enabled,
       count(*) AS total
FROM public.leagues
WHERE sport = 'NFL' AND season = '2026';