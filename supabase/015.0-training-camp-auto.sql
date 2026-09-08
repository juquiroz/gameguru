-- ============================================================================
-- BUILD-TC-V2-AUTO — Training Camp Automático (modelo simple + auto)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- ADITIVO: NO borra ni rompe el pipeline legacy ni el TC v2 manual. El modo
-- automático reutiliza las tablas existentes (training_sessions, league_games,
-- game_weeks, picks, pick_snapshots) y solo agrega dos banderas de
-- configuración a `training_sessions`:
--   1) `auto` → la liga corre en modo automático (5 juegos/semana generados,
--      picks por juego que cierran 10 min antes, resultados auto al tip,
--      semana activa derivada del reloj, revelado al final).
--   2) `seed` → semilla estable de la liga para el MatchSimulator
--      (resultados deterministas) y para el sorteo semanal reproducible.
-- Las ligas sin `auto` conservan EXACTAMENTE el comportamiento manual (014.0).
--
-- Compatibilidad de degradación: si esta migración NO está aplicada, el
-- frontend detecta el fallo de columna (PGRST427) y degrada a localStorage
-- (mismo patrón tolerante del dominio TC), sin romper la UI.
-- ============================================================================

-- 1) Banderas de configuración del modo automático
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS auto boolean NOT NULL DEFAULT false;

-- `seed` ya existía como `int` (005.1) y el ranking usa valores de 32 bits
-- positivos (hasta 2^32-1) → ampliar a bigint. Idempotente: si ya está en
-- bigint, ALTER TYPE es un no-op.
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS seed  bigint;
ALTER TABLE public.training_sessions
  ALTER COLUMN seed TYPE bigint USING seed::bigint;

-- 2) Índice conveniente: sesiones automáticas activas por liga
CREATE INDEX IF NOT EXISTS training_sessions_auto_idx
  ON public.training_sessions (league_id)
  WHERE auto = true AND state = 'training_camp_v2';