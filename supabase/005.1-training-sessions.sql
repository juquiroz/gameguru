-- ============================================================================
-- BUILD-TC-003 + TC-004 — Training Sessions (Event Director + Fixture Generation)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
-- Reemplaza a 005.1-training-camps.sql (nunca ejecutado): la tabla deja de ser
-- 1:1 con leagues y pasa a ser una entidad independiente "Training Session"
-- (1:N-ready con `session_no`), aunque temporalmente la app usa una única
-- sesión por liga. La liga practice sigue siendo el contenedor del evento.
-- BUILD-TC-004: `event_type` distingue el evento (training_camp /
-- fixture_generation); este último se crea al finalizar el TC y reporta su
-- avance en `fixture_progress` (JSONB).
-- Hasta que se ejecute, la app degrada a almacenamiento local (localStorage),
-- por lo que el Lobby funciona igual en ambos casos.
-- ============================================================================

-- 1) Tabla de sesiones de entrenamiento (1:N-ready con leagues)
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id        uuid NOT NULL REFERENCES public.leagues (id) ON DELETE CASCADE,
  session_no       int  NOT NULL DEFAULT 1,
  event_type       text NOT NULL DEFAULT 'training_camp',
  name             text NOT NULL DEFAULT '',
  start_at         timestamptz,
  level            text NOT NULL DEFAULT 'standard',
  game_count       int  NOT NULL DEFAULT 10,
  speed            text NOT NULL DEFAULT 'normal',
  fixture_mode     text NOT NULL DEFAULT 'auto',
  fixture_progress jsonb,
  state            text NOT NULL DEFAULT 'created',
  seed             int,
  started_at       timestamptz,
  finished_at      timestamptz,
  cancel_reason    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_sessions_league_session_unique UNIQUE (league_id, session_no)
);

-- 1b) Crear/actualizar: si ya existía una tabla parcial (sin columnas de
--     BUILD-TC-004 o previas), este bloque la lleva al esquema vigente.
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS session_no       int  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS event_type       text NOT NULL DEFAULT 'training_camp',
  ADD COLUMN IF NOT EXISTS fixture_mode     text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS fixture_progress jsonb,
  ADD COLUMN IF NOT EXISTS seed             int;

-- 2) Estado del evento (9 estados de PLAN-005 + estados del Fixture Generation + cancelled)
ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_state_check;
ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_state_check
  CHECK (state IN (
    'created', 'waiting_players', 'countdown', 'training_started',
    'picks_open', 'picks_locked', 'games_in_progress',
    'simulation_running', 'finished',
    'waiting', 'generating_fixtures', 'saving_matches', 'completed',
    'cancelled'
  ));

-- 2b) Tipo de evento (BUILD-TC-004)
ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_event_type_check;
ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_event_type_check
  CHECK (event_type IN ('training_camp', 'fixture_generation'));

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

-- 5) Índices (BUILD-TC-004.2): consultas típicas por liga y por estado.
--    El UNIQUE (league_id, session_no) ya cubre el prefijo league_id; el de
--    estado acelera filtros de "eventos pendientes/activos".
CREATE INDEX IF NOT EXISTS training_sessions_league_idx ON public.training_sessions (league_id);
CREATE INDEX IF NOT EXISTS training_sessions_state_idx  ON public.training_sessions (state);
CREATE INDEX IF NOT EXISTS training_sessions_event_type_idx ON public.training_sessions (event_type);
