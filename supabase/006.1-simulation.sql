-- ============================================================================
-- BUILD-TC-006.1 — Simulation Engine: columnas de corrida en game_weeks
--
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- NO se ejecuta desde código: el front degrada a localStorage (clave
-- `gameguru.sim.<weekId>`) hasta que la tabla tenga estas columnas.
--
-- Contexto:
--   - Resultados → `league_games` (home_score / away_score / result / finished),
--     columnas ya existentes (mismo contrato que ScoreEditor / setScores).
--   - Standings → derivados en JS (StandingsCalculator), NO se persisten.
--   - Esta migración solo agrega el registro de la CORRIDA a `game_weeks`:
--       seed               int           → seed determinista de la simulación
--       simulation_progress jsonb        → máquina interna del SimulationDirector
--       simulated_at       timestamptz   → fin de la corrida
--   - RLS: game_weeks ya es permisiva (políticas gw_* de 005.2); las columnas
--     nuevas heredan ese comportamiento. No se toca RLS.
-- ============================================================================

-- 1) game_weeks: columnas de la corrida de simulación
ALTER TABLE public.game_weeks
  ADD COLUMN IF NOT EXISTS seed integer;

ALTER TABLE public.game_weeks
  ADD COLUMN IF NOT EXISTS simulation_progress jsonb;

ALTER TABLE public.game_weeks
  ADD COLUMN IF NOT EXISTS simulated_at timestamptz;

-- 2) Índice por estado (filtrar jornadas en simulación / completadas)
CREATE INDEX IF NOT EXISTS game_weeks_sim_state_idx ON public.game_weeks (state);

-- 3) (Opcional) Verificación
-- SELECT id, week, state, seed, simulation_progress, simulated_at
-- FROM public.game_weeks ORDER BY created_at;
