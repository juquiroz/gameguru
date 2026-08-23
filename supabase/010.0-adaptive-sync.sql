-- ============================================================================
-- BUILD-010.0 — Adaptive Sync + API Budget
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- Alcance:
--   1) master_games: campos sync_state, last_synced_at, reconciled_at
--   2) api_budget: tabla de control de consumo diario (80 auto + 20 manual)
--   3) reserve_api_request(): función atómica con SELECT FOR UPDATE
--   4) check_budget(): función read-only para consultar budget
--   5) sync_runs: extender con skip_reason, games_evaluated, etc.
--   6) sync_cooldown_config: tabla de configuración de cooldowns
--
-- NO modifica datos existentes. NO expone secrets.
-- ============================================================================

-- 1) master_games: campos de sync
ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS sync_state text DEFAULT 'unknown';

ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE master_games
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

-- Constraint para sync_state
ALTER TABLE master_games
  DROP CONSTRAINT IF EXISTS master_games_sync_state_check;

ALTER TABLE master_games
  ADD CONSTRAINT master_games_sync_state_check
  CHECK (sync_state IN (
    'unknown', 'scheduled', 'approaching', 'pregame', 'live',
    'final_pending', 'reconciled', 'postponed', 'cancelled'
  ));

-- Índice para scheduler (partidos que necesitan sync)
CREATE INDEX IF NOT EXISTS idx_master_games_sync_state
  ON master_games(sync_state)
  WHERE sync_state NOT IN ('reconciled', 'cancelled');

-- Índice para consultas por game_time (scheduler)
CREATE INDEX IF NOT EXISTS idx_master_games_game_time
  ON master_games(game_time)
  WHERE provider = 'api-sports';

-- 2) api_budget: control de consumo diario
CREATE TABLE IF NOT EXISTS api_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  automatic_limit int NOT NULL DEFAULT 80,
  automatic_used int NOT NULL DEFAULT 0,
  manual_limit int NOT NULL DEFAULT 20,
  manual_used int NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, date)
);

-- Constraints para api_budget
ALTER TABLE api_budget
  DROP CONSTRAINT IF EXISTS api_budget_limits_check;

ALTER TABLE api_budget
  ADD CONSTRAINT api_budget_limits_check
  CHECK (
    automatic_limit >= 0 AND
    manual_limit >= 0 AND
    automatic_used >= 0 AND
    manual_used >= 0 AND
    automatic_used <= automatic_limit AND
    manual_used <= manual_limit
  );

-- Índices para api_budget
CREATE INDEX IF NOT EXISTS idx_api_budget_provider_date
  ON api_budget(provider, date DESC);

-- 3) Función atómica de reserva de API request
CREATE OR REPLACE FUNCTION reserve_api_request(
  p_provider text,
  p_source text  -- 'automatic' | 'manual'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_budget public.api_budget%ROWTYPE;
  v_limit int;
  v_used int;
  v_remaining int;
  v_tomorrow date;
BEGIN
  -- Validar source
  IF p_source NOT IN ('automatic', 'manual') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'invalid_source',
      'message', 'Source must be automatic or manual'
    );
  END IF;

  -- Obtener o crear budget del día con lock
  v_tomorrow := (CURRENT_DATE + INTERVAL '1 day')::date;

  INSERT INTO public.api_budget (provider, date, reset_at)
  VALUES (p_provider, CURRENT_DATE, v_tomorrow::timestamptz)
  ON CONFLICT (provider, date) DO UPDATE
    SET updated_at = now()
  RETURNING * INTO v_budget;

  -- Lock explícito para garantizar atomicidad
  SELECT * INTO v_budget
  FROM public.api_budget
  WHERE provider = p_provider AND date = CURRENT_DATE
  FOR UPDATE;

  -- Determinar qué pool usar
  IF p_source = 'manual' THEN
    v_limit := v_budget.manual_limit;
    v_used := v_budget.manual_used;
  ELSE
    v_limit := v_budget.automatic_limit;
    v_used := v_budget.automatic_used;
  END IF;

  v_remaining := v_limit - v_used;

  -- Verificar si hay budget disponible
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'budget_exhausted',
      'source', p_source,
      'limit', v_limit,
      'used', v_used,
      'remaining', 0
    );
  END IF;

  -- Consumir 1 request atómicamente
  IF p_source = 'manual' THEN
    UPDATE public.api_budget
    SET manual_used = manual_used + 1, updated_at = now()
    WHERE provider = p_provider AND date = CURRENT_DATE;
  ELSE
    UPDATE public.api_budget
    SET automatic_used = automatic_used + 1, updated_at = now()
    WHERE provider = p_provider AND date = CURRENT_DATE;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'source', p_source,
    'limit', v_limit,
    'used', v_used + 1,
    'remaining', v_remaining - 1
  );
END;
$$;

-- 4) Función read-only para consultar budget
CREATE OR REPLACE FUNCTION check_budget(
  p_provider text,
  p_source text  -- 'automatic' | 'manual' | 'all'
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_build_object(
      'date', b.date,
      'automatic_limit', b.automatic_limit,
      'automatic_used', b.automatic_used,
      'automatic_remaining', b.automatic_limit - b.automatic_used,
      'manual_limit', b.manual_limit,
      'manual_used', b.manual_used,
      'manual_remaining', b.manual_limit - b.manual_used,
      'total_limit', b.automatic_limit + b.manual_limit,
      'total_used', b.automatic_used + b.manual_used,
      'total_remaining', (b.automatic_limit - b.automatic_used) + (b.manual_limit - b.manual_used),
      'reset_at', b.reset_at
    ),
    jsonb_build_object(
      'date', CURRENT_DATE,
      'automatic_limit', 80,
      'automatic_used', 0,
      'automatic_remaining', 80,
      'manual_limit', 20,
      'manual_used', 0,
      'manual_remaining', 20,
      'total_limit', 100,
      'total_used', 0,
      'total_remaining', 100,
      'reset_at', (CURRENT_DATE + INTERVAL '1 day')::timestamptz
    )
  )
  FROM public.api_budget b
  WHERE b.provider = p_provider AND b.date = CURRENT_DATE;
$$;

-- 5) Extender sync_runs para registrar skips
ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS skip_reason text;

ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS games_evaluated int DEFAULT 0;

ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS games_needing_sync int DEFAULT 0;

ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS budget_remaining int;

-- Actualizar constraint de status para incluir 'skipped'
ALTER TABLE sync_runs
  DROP CONSTRAINT IF EXISTS sync_runs_status_check;

ALTER TABLE sync_runs
  ADD CONSTRAINT sync_runs_status_check
  CHECK (status IN ('running', 'completed', 'failed', 'skipped'));

-- 6) sync_cooldown_config: configuración de cooldowns por ventana
CREATE TABLE IF NOT EXISTS sync_cooldown_config (
  sync_window text PRIMARY KEY,
  cooldown_minutes int NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Valores por defecto (idempotente con ON CONFLICT)
INSERT INTO sync_cooldown_config (sync_window, cooldown_minutes, description) VALUES
  ('future', 999999, 'Partido >24h en el futuro — no consultar'),
  ('approaching', 240, 'Partido 2-24h antes — baja frecuencia'),
  ('pregame', 60, 'Partido <2h antes — frecuencia moderada'),
  ('imminent', 15, 'Partido <30min antes — frecuencia alta'),
  ('just_finished', 10, 'Partido finalizado hace <2h — reconciliación activa'),
  ('past_active', 30, 'Partido finalizado hace 2-6h — reconciliación'),
  ('past_extended', 120, 'Partido finalizado hace 6-24h — verificación'),
  ('past_reconciled', 999999, 'Partido finalizado hace >24h — no consultar')
ON CONFLICT (sync_window) DO NOTHING;

-- 7) RLS para api_budget
ALTER TABLE api_budget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_budget_select_platform ON api_budget;
DROP POLICY IF EXISTS api_budget_insert_service ON api_budget;
DROP POLICY IF EXISTS api_budget_update_service ON api_budget;

-- Platform admins pueden leer api_budget
CREATE POLICY api_budget_select_platform
  ON api_budget FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.platform_role IN ('platform_admin', 'platform_superadmin')
    )
  );

-- service_role puede insertar/actualizar (Edge Functions)
CREATE POLICY api_budget_insert_service
  ON api_budget FOR INSERT
  WITH CHECK (true);

CREATE POLICY api_budget_update_service
  ON api_budget FOR UPDATE
  USING (true);

-- 8) RLS para sync_cooldown_config
ALTER TABLE sync_cooldown_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_cooldown_select ON sync_cooldown_config;
DROP POLICY IF EXISTS sync_cooldown_update_service ON sync_cooldown_config;

-- Cualquiera autenticado puede leer cooldowns (para UI)
CREATE POLICY sync_cooldown_select
  ON sync_cooldown_config FOR SELECT
  USING (true);

-- service_role puede actualizar (Edge Functions)
CREATE POLICY sync_cooldown_update_service
  ON sync_cooldown_config FOR UPDATE
  USING (true);

-- 9) Verificación
SELECT 'master_games sync columns added' as change,
  count(*) as affected_rows
FROM master_games
WHERE sync_state IS NOT NULL;

SELECT 'api_budget table created' as change,
  count(*) as total_rows
FROM api_budget;

SELECT 'sync_cooldown_config created' as change,
  count(*) as total_windows
FROM sync_cooldown_config;

SELECT 'sync_runs extended' as change,
  count(*) as total_runs
FROM sync_runs;
