-- ============================================================================
-- BUILD-AUTO-SYNC-001 — Auto Results Sync MVP (NFL)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- Alcance:
--   1) master_games: campos para external IDs (provider, external_game_id)
--   2) master_games: campo mapping_status para tracking de mapeo
--   3) leagues: campo auto_update_results para habilitar sync automático
--   4) sync_runs: tabla de observabilidad para registrar ejecuciones de sync
--
-- Este script NO modifica datos existentes. Los campos nuevos son opcionales
-- y permiten la integración con proveedores externos (API-Sports NFL MVP).
-- ============================================================================

-- 1) master_games: external IDs para mapeo con proveedores externos
ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS provider text;

ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS external_game_id text;

ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS external_competition_id text;

ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS mapping_status text DEFAULT 'unmapped';

-- 2) Constraint para mapping_status
ALTER TABLE master_games
  DROP CONSTRAINT IF EXISTS master_games_mapping_status_check;

ALTER TABLE master_games
  ADD CONSTRAINT master_games_mapping_status_check
  CHECK (mapping_status IN ('unmapped', 'mapped', 'error'));

-- 3) Índice único para evitar duplicados por provider + external_game_id
--    Usa índice parcial para solo aplicar cuando external_game_id no es null
CREATE UNIQUE INDEX IF NOT EXISTS master_games_external_game_unique
  ON master_games(provider, external_game_id)
  WHERE external_game_id IS NOT NULL;

-- 4) Índice para búsquedas por provider
CREATE INDEX IF NOT EXISTS master_games_provider_idx
  ON master_games(provider)
  WHERE provider IS NOT NULL;

-- 5) leagues: campo para habilitar/deshabilitar auto-update
ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS auto_update_results boolean DEFAULT false;

-- 6) sync_runs: tabla de observabilidad para registrar ejecuciones de sync
CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  sport text NOT NULL,
  season text,
  phase text,
  trigger_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms int,
  records_fetched int DEFAULT 0,
  records_created int DEFAULT 0,
  records_updated int DEFAULT 0,
  records_unchanged int DEFAULT 0,
  records_propagated int DEFAULT 0,
  records_rejected int DEFAULT 0,
  error_count int DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7) Constraints para sync_runs
ALTER TABLE sync_runs
  DROP CONSTRAINT IF EXISTS sync_runs_trigger_type_check;

ALTER TABLE sync_runs
  ADD CONSTRAINT sync_runs_trigger_type_check
  CHECK (trigger_type IN ('manual', 'cron'));

ALTER TABLE sync_runs
  DROP CONSTRAINT IF EXISTS sync_runs_status_check;

ALTER TABLE sync_runs
  ADD CONSTRAINT sync_runs_status_check
  CHECK (status IN ('running', 'completed', 'failed'));

-- 8) Índices para sync_runs
CREATE INDEX IF NOT EXISTS sync_runs_status_idx
  ON sync_runs(status);

CREATE INDEX IF NOT EXISTS sync_runs_started_idx
  ON sync_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS sync_runs_provider_idx
  ON sync_runs(provider);

-- 9) RLS para sync_runs (lectura para platform admins, escritura para service_role)
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_runs_select_platform ON sync_runs;
DROP POLICY IF EXISTS sync_runs_insert_service ON sync_runs;
DROP POLICY IF EXISTS sync_runs_update_service ON sync_runs;

-- Platform admins pueden leer sync_runs
CREATE POLICY sync_runs_select_platform
  ON sync_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.platform_role IN ('platform_admin', 'platform_superadmin')
    )
  );

-- service_role puede insertar (Edge Functions)
CREATE POLICY sync_runs_insert_service
  ON sync_runs FOR INSERT
  WITH CHECK (true);

-- service_role puede actualizar (Edge Functions)
CREATE POLICY sync_runs_update_service
  ON sync_runs FOR UPDATE
  USING (true);

-- 10) Verificación (opcional)
SELECT 
  'master_games columns added' as change,
  count(*) as affected_rows
FROM master_games
WHERE provider IS NOT NULL;

SELECT 
  'sync_runs table created' as change,
  count(*) as total_runs
FROM sync_runs;
