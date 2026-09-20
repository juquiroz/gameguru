-- ============================================================================
-- BUILD-SUP-004 — Provider Game Reconciliation
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- Alcance (PLAN SUP-004):
--   1) master_games: expandir mapping_status a 5 estados
--   2) master_games: columnas mapping_confidence, mapped_at, mapped_by,
--      reconciliation_source
--   3) Índice de candidate lookup para matching (home_abbr, away_abbr,
--      season, phase, game_time) WHERE provider IS NULL
--   4) Función reconcile_match_candidates() para candidate lookup
--   5) Función propagate_to_league_games() para propagación selectiva
--   6) RLS/grants si corresponde
--
-- NO modifica datos existentes. NO ejecuta backfill.
-- ============================================================================

-- 1) Expandir mapping_status a 5 estados
ALTER TABLE master_games
  DROP CONSTRAINT IF EXISTS master_games_mapping_status_check;

ALTER TABLE master_games
  ADD CONSTRAINT master_games_mapping_status_check
  CHECK (mapping_status IN (
    'unmapped', 'mapped', 'unmatched', 'ambiguous', 'manual_override'
  ));

-- 2) Columna mapping_confidence
ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS mapping_confidence text;

ALTER TABLE master_games
  DROP CONSTRAINT IF EXISTS master_games_mapping_confidence_check;

ALTER TABLE master_games
  ADD CONSTRAINT master_games_mapping_confidence_check
  CHECK (mapping_confidence IS NULL OR mapping_confidence IN (
    'high', 'medium', 'low', 'manual', 'conflict'
  ));

-- 3) Columna mapped_at
ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS mapped_at timestamptz;

-- 4) Columna mapped_by
ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS mapped_by uuid REFERENCES auth.users(id);

-- 5) Columna reconciliation_source
ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS reconciliation_source text;

ALTER TABLE master_games
  DROP CONSTRAINT IF EXISTS master_games_reconciliation_source_check;

ALTER TABLE master_games
  ADD CONSTRAINT master_games_reconciliation_source_check
  CHECK (reconciliation_source IS NULL OR reconciliation_source IN (
    'api-sports', 'manual', 'backfill'
  ));

-- 6) Índice de candidate lookup para matching
--    Permite búsqueda eficiente por identidad de equipos + temporada + fase + tiempo
--    Solo aplica a partidos sin mapear (provider IS NULL)
CREATE INDEX IF NOT EXISTS idx_master_games_candidate_lookup
  ON master_games(home_abbr, away_abbr, season, phase, game_time)
  WHERE provider IS NULL;

-- 7) Índice para búsqueda por mapping_status (reconciliation queries)
CREATE INDEX IF NOT EXISTS idx_master_games_mapping_status
  ON master_games(mapping_status)
  WHERE mapping_status NOT IN ('mapped', 'manual_override');

-- 8) Verificación
SELECT 'mapping_status expanded to 5 states' as change,
  conname as constraint_name
FROM pg_constraint
WHERE conname = 'master_games_mapping_status_check';

SELECT 'mapping_confidence column added' as change,
  count(*) as rows_with_value
FROM master_games
WHERE mapping_confidence IS NOT NULL;

SELECT 'candidate lookup index created' as change,
  indexname
FROM pg_indexes
WHERE indexname = 'idx_master_games_candidate_lookup';
