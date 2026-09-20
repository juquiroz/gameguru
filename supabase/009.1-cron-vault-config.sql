-- ============================================================================
-- BUILD-AUTO-SYNC-002 — Cron + Vault Configuration
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- REQUISITOS PREVIOS:
--   1) Habilitar extensiones en Supabase Dashboard > Database > Extensions:
--      - pg_cron
--      - pg_net
--      - supabase_vault (el schema es 'vault')
--
--   2) Configurar CRON_SECRET en Supabase Dashboard > Edge Functions > Secrets:
--      - Name: CRON_SECRET
--      - Value: generar un UUID v4 o string aleatorio seguro (ej: openssl rand -hex 32)
--
--   3) Configurar el MISMO CRON_SECRET en Supabase Vault:
--      - Dashboard > Database > Vault > New Secret
--      - Name: cron_secret
--      - Value: el mismo valor que CRON_SECRET en Edge Functions Secrets
--
-- ALCANCE:
--   1) Verificar que el Vault secret 'cron_secret' existe
--   2) Configurar cron job centralizado para results-sync
--   3) El cron NO expone service_role_key ni API keys en SQL
--
-- SEGURIDAD:
--   - CRON_SECRET se almacena en Vault (encriptado at-rest)
--   - pg_net lee el secret desde Vault al momento de la invocación
--   - Edge Function valida CRON_SECRET antes de ejecutar sync
--   - No hay secrets hardcodeados en SQL source
-- ============================================================================

-- 1) Verificar que las extensiones necesarias estén habilitadas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension is not enabled. Enable it in Supabase Dashboard > Database > Extensions';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension is not enabled. Enable it in Supabase Dashboard > Database > Extensions';
  END IF;

  -- IMPORTANTE: La extensión se llama 'supabase_vault' pero el schema es 'vault'
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
    RAISE EXCEPTION 'supabase_vault extension is not enabled. Enable it in Supabase Dashboard > Database > Extensions';
  END IF;
END $$;

-- 2) Verificar que el Vault secret 'cron_secret' existe
-- NOTA: El usuario debe crear este secret manualmente en Supabase Dashboard > Database > Vault
-- El valor debe ser el MISMO que CRON_SECRET en Edge Functions Secrets
DO $$
DECLARE
  secret_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret'
  ) INTO secret_exists;

  IF NOT secret_exists THEN
    RAISE EXCEPTION 'Vault secret "cron_secret" not found. Create it in Supabase Dashboard > Database > Vault with the same value as CRON_SECRET in Edge Functions Secrets';
  END IF;
END $$;

-- 3) Configurar cron job centralizado (idempotente)
-- Frecuencia: cada 5 minutos
-- El cron job NO incluye service_role_key ni API keys
-- Solo incluye el CRON_SECRET desde Vault para autenticación

-- Primero, eliminar el cron job si ya existe (para evitar duplicados)
DO $$
BEGIN
  -- Intentar desprogramar el job si existe
  PERFORM cron.unschedule('auto-sync-nfl-results');
EXCEPTION
  WHEN OTHERS THEN
    -- Si el job no existe, ignorar el error
    NULL;
END $$;

-- Ahora crear el cron job
SELECT cron.schedule(
  'auto-sync-nfl-results',
  '*/5 * * * *',  -- Cada 5 minutos
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

-- 4) Verificar que el cron job fue creado
SELECT 
  'Cron job created' as status,
  jobid,
  jobname,
  schedule,
  command
FROM cron.job
WHERE jobname = 'auto-sync-nfl-results';

-- 5) Verificar próximas ejecuciones
SELECT 
  'Next scheduled runs' as status,
  d.jobid,
  j.jobname,
  d.runid,
  d.status,
  d.start_time,
  d.end_time
FROM cron.job_run_details d
LEFT JOIN cron.job j ON d.jobid = j.jobid
WHERE j.jobname = 'auto-sync-nfl-results'
ORDER BY d.start_time DESC
LIMIT 5;
