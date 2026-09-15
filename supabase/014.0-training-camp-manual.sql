-- ============================================================================
-- BUILD-TC-V2-001 — Training Camp Redesign (modelo simple y manual)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- ADITIVO: NO borra ni rompe el pipeline legacy (training_sessions multi-evento
-- con event_type fixture_generation / game_week, simulation states, etc.). El
-- nuevo flujo simple reutiliza las tablas existentes (training_sessions,
-- game_weeks, picks, pick_submissions, league_games) y solo les agrega columnas
-- de configuración más un snapshot de auditoría. El código legacy queda inerte
-- (no se importa) pero sus datos no se tocan.
--
-- Alcance:
--   1) `training_sessions.total_weeks`      → número de semanas del campamento
--   2) `training_sessions.current_week`     → semana activa (secuencial)
--   3) `training_sessions.schedule_complete`→ true cuando el admin guardó todas
--      las semanas (abre la fase de invitación/picks)
--   4) `pick_snapshots`                     → snapshot público de picks
--      (congelado al iniciar el primer juego de la semana) con hash de auditoría
--   5) Estado simple `training_camp_v2`     → check state ampliado (aditivo)
-- ============================================================================

-- 1) Columnas de configuración del modelo simple en training_sessions
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS total_weeks      int  NOT NULL DEFAULT 1;
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS current_week     int  NOT NULL DEFAULT 1;
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS schedule_complete boolean NOT NULL DEFAULT false;
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS started           boolean NOT NULL DEFAULT false;

-- 2) Estado simple del modelo v2 (además de los estados legacy ya permitidos).
--    Ampliamos el CHECK de forma aditiva (no lo reemplazamos de golpe): el
--    nuevo estado `training_camp_v2` convive con el resto.
ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_state_check;
ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_state_check
  CHECK (state IN (
    -- estados legacy
    'created', 'waiting_players', 'countdown', 'training_started',
    'picks_open', 'picks_locked', 'games_in_progress',
    'simulation_running', 'finished',
    'waiting', 'generating_fixtures', 'saving_matches', 'completed',
    'cancelled',
    -- estado simple v2
    'training_camp_v2'
  ));

-- 3) left join útil: una sesión v2 se reconoce por state='training_camp_v2'
--    (acelerar consultas de "sesión activa del campamento").
CREATE INDEX IF NOT EXISTS training_sessions_v2_state_idx
  ON public.training_sessions (league_id) WHERE state = 'training_camp_v2';

-- 4) Snapshot público de picks (auditoría).
--    Se crea cuando el primer juego de la semana inicia (deadline pasado):
--    congela el listado de picks confirmados y el de partidos con su orden.
--    `snapshot_hash` es la clave pública corta de la URL de auditoría.
CREATE TABLE IF NOT EXISTS public.pick_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_week_id    uuid NOT NULL REFERENCES public.game_weeks (id) ON DELETE CASCADE,
  league_id       uuid NOT NULL REFERENCES public.leagues (id) ON DELETE CASCADE,
  week            int  NOT NULL,
  snapshot_hash   text NOT NULL UNIQUE,
  frozen_at       timestamptz NOT NULL DEFAULT now(),
  games_json      jsonb NOT NULL DEFAULT '[]'::jsonb,
  picks_json      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 5) RLS permisiva (mismo estilo que el resto del esquema con anon key):
--    el snapshot es público por diseño (URL de auditoría sin login).
ALTER TABLE public.pick_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS psnap_read   ON public.pick_snapshots;
DROP POLICY IF EXISTS psnap_insert ON public.pick_snapshots;
DROP POLICY IF EXISTS psnap_update ON public.pick_snapshots;
DROP POLICY IF EXISTS psnap_delete ON public.pick_snapshots;

CREATE POLICY psnap_read   ON public.pick_snapshots FOR SELECT USING (true);
CREATE POLICY psnap_insert ON public.pick_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY psnap_update ON public.pick_snapshots FOR UPDATE USING (true);
CREATE POLICY psnap_delete ON public.pick_snapshots FOR DELETE USING (true);

-- 6) Índices
CREATE INDEX IF NOT EXISTS pick_snapshots_week_idx      ON public.pick_snapshots (game_week_id);
CREATE INDEX IF NOT EXISTS pick_snapshots_league_idx    ON public.pick_snapshots (league_id);
CREATE INDEX IF NOT EXISTS pick_snapshots_hash_idx      ON public.pick_snapshots (snapshot_hash);
