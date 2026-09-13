-- ============================================================================
-- PLAN-022 — Frecuencia de actualización de resultados NFL (API pública ESPN)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- API usada (pública, sin key, sin pago):
--   GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=YYYYMMDD
--
-- Cambios:
--   1) cron 'auto-sync-nfl-results' pasa de */5 a */3 minutos (refresco en vivo).
--   2) sync_cooldown_config: cooldowns bajos durante el juego (imminent 3,
--      just_finished 3, past_active 5, pregame 15); past_extended 120 y
--      past_reconciled 999999 (reconciliado no se vuelve a consultar).
--   3) api_budget: límites por proveedor en reserve_api_request — ESPN
--      automatic 600/dia (techo estimado para un día de juegos: domingo con
--      2 oleadas de kickoff + lunes), manual 20; api-sports conserva 80/20.
-- ============================================================================

-- 1) Cooldowns por ventana (SOLO actualizan las ventanas de juego)
UPDATE sync_cooldown_config SET
  cooldown_minutes = 15,
  description = 'Partido <2h antes — frecuencia moderada',
  updated_at = now()
WHERE sync_window = 'pregame';

UPDATE sync_cooldown_config SET
  cooldown_minutes = 3,
  description = 'Partido <30min antes — frecuencia alta (cron 3min)',
  updated_at = now()
WHERE sync_window = 'imminent';

UPDATE sync_cooldown_config SET
  cooldown_minutes = 3,
  description = 'Partido finalizado hace <2h — reconciliación activa',
  updated_at = now()
WHERE sync_window = 'just_finished';

UPDATE sync_cooldown_config SET
  cooldown_minutes = 5,
  description = 'Partido finalizado hace 2-6h — reconciliación',
  updated_at = now()
WHERE sync_window = 'past_active';

-- 2) Cron job cada 3 minutos (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-sync-nfl-results');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-sync-nfl-results',
  '*/3 * * * *',  -- Cada 3 minutos
  $$
  SELECT net.http_post(
    url := 'https://yzssihtflqmgolyajhvb.supabase.co/functions/v1/results-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := jsonb_build_object('manual', false)
  );
  $$
);

-- 3) Límites por proveedor en reserve_api_request (espn 600/dia, manual 20)
CREATE OR REPLACE FUNCTION public.reserve_api_request(
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
  v_auto_limit int;
  v_manual_limit int;
BEGIN
  -- Validar source
  IF p_source NOT IN ('automatic', 'manual') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'invalid_source',
      'message', 'Source must be automatic or manual'
    );
  END IF;

  -- Límites por proveedor
  IF p_provider = 'espn' THEN
    v_auto_limit := 600;
    v_manual_limit := 20;
  ELSE
    v_auto_limit := 80;
    v_manual_limit := 20;
  END IF;

  -- Obtener o crear budget del día con lock
  v_tomorrow := (CURRENT_DATE + INTERVAL '1 day')::date;

  INSERT INTO public.api_budget (provider, date, automatic_limit, manual_limit, reset_at)
  VALUES (p_provider, CURRENT_DATE, v_auto_limit, v_manual_limit, v_tomorrow::timestamptz)
  ON CONFLICT (provider, date) DO UPDATE
    SET updated_at = now(),
        automatic_limit = EXCLUDED.automatic_limit,
        manual_limit = EXCLUDED.manual_limit
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

-- 4) check_budget: defaults por proveedor cuando aún no hay fila del día
CREATE OR REPLACE FUNCTION public.check_budget(
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
      'automatic_limit', CASE WHEN p_provider = 'espn' THEN 600 ELSE 80 END,
      'automatic_used', 0,
      'automatic_remaining', CASE WHEN p_provider = 'espn' THEN 600 ELSE 80 END,
      'manual_limit', 20,
      'manual_used', 0,
      'manual_remaining', 20,
      'total_limit', CASE WHEN p_provider = 'espn' THEN 620 ELSE 100 END,
      'total_used', 0,
      'total_remaining', CASE WHEN p_provider = 'espn' THEN 620 ELSE 100 END,
      'reset_at', (CURRENT_DATE + INTERVAL '1 day')::timestamptz
    )
  )
  FROM public.api_budget b
  WHERE b.provider = p_provider AND b.date = CURRENT_DATE;
$$;

-- 5) Verificaciones
SELECT
  'Cooldowns' as check_l,
  sync_window, cooldown_minutes AS new_cooldown
FROM sync_cooldown_config
ORDER BY sync_window;

SELECT
  'Cron' as check_l,
  jobname, schedule
FROM cron.job
WHERE jobname = 'auto-sync-nfl-results';

SELECT
  'Budget defaults' as check_l,
  t.provider, t.automatic_limit, t.manual_limit
FROM (
  SELECT 'espn' AS provider
  UNION ALL SELECT 'api-sports'
) t;