-- ============================================================================
-- PLAN-021 — Provider ESPN para resultados 2026 (scraper scoreboard público)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- Alcance:
--   1) Ampliar CHECK de reconciliation_source para incluir 'espn'
--   2) Índice idx_master_games_game_time: incluir provider = 'espn'
--   3) (opcional) NOTA: no se alteran datos existentes; provider = 'espn'
--      será escrito por results-sync / reconcile.
-- ============================================================================

-- 1) reconciliation_source: agregar 'espn'
ALTER TABLE master_games
  DROP CONSTRAINT IF EXISTS master_games_reconciliation_source_check;

ALTER TABLE master_games
  ADD CONSTRAINT master_games_reconciliation_source_check
  CHECK (reconciliation_source IS NULL OR reconciliation_source IN (
    'api-sports', 'espn', 'manual', 'backfill'
  ));

-- 2) Índice de scheduler por game_time: incluir provider 'espn'
DROP INDEX IF EXISTS idx_master_games_game_time;

CREATE INDEX idx_master_games_game_time
  ON master_games(game_time)
  WHERE provider IN ('api-sports', 'espn');

-- 3) Índice único por provider + external_game_id existente ya cubre 'espn'
--    (provider es texto libre; CHECK no lo restringe).