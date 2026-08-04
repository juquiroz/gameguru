-- ============================================================================
-- BUILD-004.1 — Sistema de Temporadas (PLAN-004)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
-- No migra calendarios ni toca datos de juegos: solo crea el modelo de fases.
-- ============================================================================

-- 1) leagues: modo de experiencia + temporada de la liga
ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS league_mode text NOT NULL DEFAULT 'regular';

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2026';

-- 2) master_games: fase de temporada (desambigua semanas pre/regular/post)
ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'regular';

-- 3) Restricciones (recreadas de forma idempotente)
ALTER TABLE leagues
  DROP CONSTRAINT IF EXISTS leagues_league_mode_check;
ALTER TABLE leagues
  ADD CONSTRAINT leagues_league_mode_check
  CHECK (league_mode IN ('practice', 'preseason', 'regular'));

ALTER TABLE master_games
  DROP CONSTRAINT IF EXISTS master_games_phase_check;
ALTER TABLE master_games
  ADD CONSTRAINT master_games_phase_check
  CHECK (phase IN ('preseason', 'regular', 'postseason'));

-- 4) Índices para filtros futuros por (sport, season, phase)
CREATE INDEX IF NOT EXISTS master_games_phase_idx ON master_games (phase);
CREATE INDEX IF NOT EXISTS leagues_league_mode_idx ON leagues (league_mode);

-- 5) Backfill de ligas existentes (idempotente)
--    simulation = true  → practice  (liga de práctica / antigua simulación)
--    simulation = false → regular   (temporada oficial con calendario maestro)
--    Una liga ya marcada 'preseason' manualmente se preserva.
UPDATE leagues
SET league_mode = 'practice'
WHERE simulation = TRUE
  AND (league_mode IS NULL OR league_mode = 'regular');

UPDATE leagues
SET league_mode = 'regular'
WHERE simulation = FALSE
  AND league_mode IS NULL;

-- 6) (Opcional) Verificación del backfill
SELECT id, name, sport, season, league_mode, simulation
FROM leagues
ORDER BY created_at;
