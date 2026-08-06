-- ============================================================================
-- BUILD-TC-003 — Training Sessions (Event Director) (PLAN-005)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
-- Reemplaza a 005.1-training-camps.sql (nunca ejecutado): la tabla deja de ser
-- 1:1 con leagues y pasa a ser una entidad independiente "Training Session"
-- (1:N-ready con `session_no`), aunque temporalmente la app usa una única
-- sesión por liga. La liga practice sigue siendo el contenedor del evento.
-- Hasta que se ejecute, la app degrada a almacenamiento local (localStorage),
-- por lo que el Lobby funciona igual en ambos casos.
-- ============================================================================

-- 1) Tabla de sesiones de entrenamiento (1:N-ready con leagues)
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id     uuid NOT NULL REFERENCES public.leagues (id) ON DELETE CASCADE,
  session_no    int  NOT NULL DEFAULT 1,
  name          text NOT NULL DEFAULT '',
  start_at      timestamptz,
  level         text NOT NULL DEFAULT 'standard',
  game_count    int  NOT NULL DEFAULT 10,
  speed         text NOT NULL DEFAULT 'normal',
  fixture_mode  text NOT NULL DEFAULT 'auto',
  state         text NOT NULL DEFAULT 'created',
  seed          int,
  started_at    timestamptz,
  finished_at   timestamptz,
  cancel_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_sessions_league_session_unique UNIQUE (league_id, session_no)
);

-- 2) Estado del evento (9 estados de PLAN-005 + cancelled)
ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_state_check;
ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_state_check
  CHECK (state IN (
    'created', 'waiting_players', 'countdown', 'training_started',
    'picks_open', 'picks_locked', 'games_in_progress',
    'simulation_running', 'finished', 'cancelled'
  ));

-- 3) Nivel de entrenamiento
ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_level_check;
ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_level_check
  CHECK (level IN ('express', 'standard', 'advanced', 'custom'));

-- 4) RLS permisiva (mismo estilo que el resto del esquema con anon key)
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ts_read   ON public.training_sessions;
DROP POLICY IF EXISTS ts_insert ON public.training_sessions;
DROP POLICY IF EXISTS ts_update ON public.training_sessions;
DROP POLICY IF EXISTS ts_delete ON public.training_sessions;

CREATE POLICY ts_read   ON public.training_sessions FOR SELECT USING (true);
CREATE POLICY ts_insert ON public.training_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY ts_update ON public.training_sessions FOR UPDATE USING (true);
CREATE POLICY ts_delete ON public.training_sessions FOR DELETE USING (true);
