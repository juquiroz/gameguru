-- ============================================================================
-- BUILD-TC-005 — Game Week & Picks
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- Alcance (PLAN-TC-005 §8.5):
--   1) `game_weeks`        → jornada de juego de una sesión (WeekState)
--   2) `pick_submissions`  → confirmación/bloqueo de la planilla por usuario
--   3) `league_games.training_session_id` → vínculo explícito sesión→partidos
--      (elimina el parseo de game_id `tc-<sessionNo>-*`)
--   4) `picks.training_session_id` + `picks.submitted_at` → picks por sesión
--   5) `training_sessions.event_type` + 'game_week' (3er evento)
--   6) `training_sessions.picks_deadline_at` → deadline del director (puro)
--
-- Hasta que se ejecute, GameWeekService degrada a localStorage
-- (gameguru.gw.<sessionId> / gameguru.picks.<sessionId>) para que la jornada
-- sea funcional sin la tabla, igual que training_sessions en TC-003/004.
-- ============================================================================

-- 1) Jornadas de juego (WeekState): pending → picks_open → picks_locked →
--    games_in_progress → simulation_running → completed (+ cancelled).
--    TC-005 implementa waiting/picks_open/picks_locked/completed; los estados
--    de simulación son del TC-006 (se declaran ya en el CHECK).
CREATE TABLE IF NOT EXISTS public.game_weeks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_session_id  uuid NOT NULL REFERENCES public.training_sessions (id) ON DELETE CASCADE,
  league_id            uuid NOT NULL REFERENCES public.leagues (id) ON DELETE CASCADE,
  week                 int  NOT NULL DEFAULT 1,
  game_count           int  NOT NULL DEFAULT 10,
  deadline_at          timestamptz,
  state                text NOT NULL DEFAULT 'pending',
  opened_at            timestamptz,
  locked_at            timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_weeks_session_week_unique UNIQUE (training_session_id, week)
);

-- 2) Confirmaciones de planilla (PickSubmission): 1 fila por usuario y jornada.
CREATE TABLE IF NOT EXISTS public.pick_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_week_id        uuid NOT NULL REFERENCES public.game_weeks (id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  league_id           uuid NOT NULL REFERENCES public.leagues (id) ON DELETE CASCADE,
  pick_count          int  NOT NULL DEFAULT 0,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pick_submissions_week_user_unique UNIQUE (game_week_id, user_id)
);

-- 3) Vínculo explícito sesión → partidos generados (FG)
ALTER TABLE public.league_games
  ADD COLUMN IF NOT EXISTS training_session_id uuid REFERENCES public.training_sessions (id) ON DELETE CASCADE;

-- 4) Picks por sesión + marca de confirmación
ALTER TABLE public.picks
  ADD COLUMN IF NOT EXISTS training_session_id uuid REFERENCES public.training_sessions (id) ON DELETE CASCADE;
ALTER TABLE public.picks
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- 5) Tipo de evento game_week (3er evento) + deadline de picks del director
ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_event_type_check;
ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_event_type_check
  CHECK (event_type IN ('training_camp', 'fixture_generation', 'game_week'));

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS picks_deadline_at timestamptz;

-- Ventana de picks en minutos del nivel (express 5 / standard 10 / advanced 15 /
-- custom editable). La persiste createGameWeekEvent; GameWeekService la usa para
-- el deadline de la jornada (apertura + pick_window_minutes).
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS pick_window_minutes int;

-- 5b) Estado de la jornada (WeekState) — idempotente
ALTER TABLE public.game_weeks
  DROP CONSTRAINT IF EXISTS game_weeks_state_check;
ALTER TABLE public.game_weeks
  ADD CONSTRAINT game_weeks_state_check
  CHECK (state IN (
    'pending', 'waiting', 'picks_open', 'picks_locked',
    'games_in_progress', 'simulation_running', 'completed',
    'cancelled'
  ));

-- 6) Índices
CREATE INDEX IF NOT EXISTS game_weeks_session_idx      ON public.game_weeks (training_session_id);
CREATE INDEX IF NOT EXISTS game_weeks_league_idx       ON public.game_weeks (league_id);
CREATE INDEX IF NOT EXISTS pick_submissions_week_idx   ON public.pick_submissions (game_week_id);
CREATE INDEX IF NOT EXISTS picks_session_idx           ON public.picks (training_session_id);

-- Índice único de picks por sesión (los de TC no colisionan con la UK general
-- user_id,league_id,week,game_id porque game_id incluye el session_no).
-- TC-005.1: se usa un UNIQUE CONSTRAINT y no un índice parcial — PostgREST solo
-- acepta `on_conflict` contra constraints, y PicksService hace upsert con
-- onConflict 'user_id,league_id,training_session_id,game_id'. Con
-- training_session_id NULL (picks de temporada) los NULLs son distintos en
-- Postgres, así que el constraint replica la semántica del índice parcial.
DROP INDEX IF EXISTS public.picks_session_game_unique;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'picks_session_game_unique'
  ) THEN
    ALTER TABLE public.picks
      ADD CONSTRAINT picks_session_game_unique
      UNIQUE (user_id, league_id, training_session_id, game_id);
  END IF;
END $$;

-- 7) RLS permisiva (mismo estilo que el resto del esquema con anon key)
ALTER TABLE public.game_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gw_read   ON public.game_weeks;
DROP POLICY IF EXISTS gw_insert ON public.game_weeks;
DROP POLICY IF EXISTS gw_update ON public.game_weeks;
DROP POLICY IF EXISTS gw_delete ON public.game_weeks;
DROP POLICY IF EXISTS ps_read   ON public.pick_submissions;
DROP POLICY IF EXISTS ps_insert ON public.pick_submissions;
DROP POLICY IF EXISTS ps_update ON public.pick_submissions;
DROP POLICY IF EXISTS ps_delete ON public.pick_submissions;

CREATE POLICY gw_read   ON public.game_weeks FOR SELECT USING (true);
CREATE POLICY gw_insert ON public.game_weeks FOR INSERT WITH CHECK (true);
CREATE POLICY gw_update ON public.game_weeks FOR UPDATE USING (true);
CREATE POLICY gw_delete ON public.game_weeks FOR DELETE USING (true);
CREATE POLICY ps_read   ON public.pick_submissions FOR SELECT USING (true);
CREATE POLICY ps_insert ON public.pick_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY ps_update ON public.pick_submissions FOR UPDATE USING (true);
CREATE POLICY ps_delete ON public.pick_submissions FOR DELETE USING (true);

-- 7b) league_games y picks conservan su RLS de membresía (auth.uid()): anon no
-- inserta ni ve (el demo degrada a localStorage por diseño); la app real
-- inserta/lee como usuario autenticado miembro/admin de la liga.
