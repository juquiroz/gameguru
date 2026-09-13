-- VERIFICACIÓN TEMPORAL PLAN-022 (se dropea tras confirmar con README)
CREATE OR REPLACE FUNCTION public.admn_verify_freq() RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cron jsonb;
  v_budget jsonb;
  v_cooldown jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('jobname', jobname, 'schedule', schedule)), '[]'::jsonb)
    INTO v_cron
    FROM cron.job
    WHERE jobname = 'auto-sync-nfl-results';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'provider', provider, 'date', date, 'automatic_limit', automatic_limit,
      'automatic_used', automatic_used, 'manual_limit', manual_limit, 'manual_used', manual_used))
    , '[]'::jsonb)
    INTO v_budget
    FROM public.api_budget
    WHERE provider = 'espn' AND date = CURRENT_DATE;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('sync_window', sync_window, 'cooldown_minutes', cooldown_minutes))
    , '[]'::jsonb)
    INTO v_cooldown
    FROM public.sync_cooldown_config;

  RETURN jsonb_build_object(
    'cron', v_cron,
    'budget_today', v_budget,
    'cooldowns', v_cooldown,
    'utc_now', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admn_verify_freq() TO anon, authenticated;