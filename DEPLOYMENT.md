# Auto-Results Sync - Deployment Guide

## Overview

This guide documents the manual steps required to deploy the Auto-Results Sync feature to production.

**Status**: Ready for deployment  
**Tests**: 56/56 passing  
**Security**: Authorization and concurrency protection implemented

---

## Pre-Deployment Checklist

### 1. API-Sports Credentials

**Status**: ✅ Configured in Supabase Secrets  
**Secret Name**: `API_SPORTS_API_KEY`

Verify in Supabase Dashboard:
```
Dashboard → Edge Functions → Secrets → API_SPORTS_API_KEY
```

### 2. Cron Secret

**Status**: ❌ NOT YET CONFIGURED  
**Secret Name**: `CRON_SECRET`

**Action Required**:
1. Generate a secure random secret:
   ```bash
   openssl rand -hex 32
   ```

2. Add to Supabase Edge Functions Secrets:
   ```
   Dashboard → Edge Functions → Secrets → New Secret
   Name: CRON_SECRET
   Value: <generated-secret>
   ```

3. **IMPORTANT**: Save this value for step 5 below

### 3. Required Extensions

**Status**: ✅ Already enabled in Supabase

Verify in Supabase Dashboard:
```
Dashboard → Database → Extensions
```

Required extensions:
- ✅ `pg_cron` (for scheduled jobs)
- ✅ `pg_net` (for HTTP requests from cron)
- ✅ `supabase_vault` (for secure secret storage, schema: `vault`)

**Verification**:
```sql
SELECT extname, extversion FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net', 'supabase_vault');
```

Expected: 3 rows returned

---

## Deployment Steps

### Step 1: Apply Database Migration 009.0

**File**: `supabase/009.0-auto-results-sync.sql`

**Action**:
1. Open Supabase SQL Editor
2. Copy contents of `009.0-auto-results-sync.sql`
3. Execute the migration

**What this creates**:
- `sync_runs` table for observability
- `auto_update_results` column in `leagues`
- External ID columns in `master_games`
- RLS policies for `sync_runs`

**Verification**:
```sql
-- Check leagues column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leagues' 
  AND column_name = 'auto_update_results';

-- Check master_games columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'master_games' 
  AND column_name IN ('provider', 'external_game_id', 'external_competition_id', 'mapping_status');

-- Check sync_runs table
SELECT COUNT(*) FROM sync_runs;
```

### Step 2: Deploy Edge Function

**Command**:
```bash
supabase functions deploy results-sync
```

**Verification**:
```bash
supabase functions list
```

Expected output:
```
results-sync
```

### Step 3: Configure Vault Secret for Cron

**IMPORTANT**: The Vault secret must be created MANUALLY in Supabase Dashboard.

**Action**:
1. Navigate to:
   ```
   Dashboard → Database → Vault
   ```

2. Click "New Secret"

3. Configure:
   - **Name**: `cron_secret`
   - **Value**: The SAME value as `CRON_SECRET` from Edge Functions Secrets
   - **Description**: "Secret for cron job authentication with Edge Functions"

4. Click "Save"

**Verification**:
```sql
SELECT name FROM vault.decrypted_secrets WHERE name = 'cron_secret';
```

Expected: 1 row returned

### Step 4: Apply Database Migration 009.1

**File**: `supabase/009.1-cron-vault-config.sql`

**Action**:
1. Open Supabase SQL Editor
2. Copy contents of `009.1-cron-vault-config.sql`
3. Execute the migration

**What this does**:
- Verifies that the Vault secret `cron_secret` exists
- Creates cron job `auto-sync-nfl-results` (runs every 5 minutes)

**IMPORTANT**: This migration will FAIL if the Vault secret doesn't exist. Make sure you completed Step 3 first.

**Verification**:
```sql
-- Check cron job
SELECT jobname, schedule FROM cron.job WHERE jobname = 'auto-sync-nfl-results';
```

Expected: 1 row returned

### Step 5: Verify Deployment

**Test Manual Sync**:

1. Create a test league:
```sql
INSERT INTO leagues (name, sport, league_mode, auto_update_results)
VALUES ('Test NFL League', 'NFL', 'regular', true)
RETURNING id;
```

2. Note the league ID

3. Test the Edge Function manually:
```bash
curl -X POST https://yzssihtflqmgolyajhvb.supabase.co/functions/v1/results-sync \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"manual": true, "league_id": "YOUR_LEAGUE_ID"}'
```

4. Check sync_runs:
```sql
SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 5;
```

**Test Cron Execution**:

Wait 5-10 minutes, then check:
```sql
-- Check cron job execution history
SELECT * FROM cron.job_run_details 
WHERE jobname = 'auto-sync-nfl-results' 
ORDER BY start_time DESC 
LIMIT 5;

-- Check sync_runs for cron executions
SELECT * FROM sync_runs 
WHERE trigger_type = 'cron' 
ORDER BY started_at DESC 
LIMIT 5;
```

---

## Security Verification

### Manual Sync Authorization

✅ **Implemented**:
- Requires valid JWT token
- Validates user is league admin OR platform_superadmin
- Returns 401 for unauthenticated requests
- Returns 403 for unauthorized users
- Returns 404 for non-existent leagues

**Test**:
```bash
# Should fail (no auth)
curl -X POST https://yzssihtflqmgolyajhvb.supabase.co/functions/v1/results-sync \
  -H "Content-Type: application/json" \
  -d '{"manual": true, "league_id": "..."}'
# Expected: 401 Unauthorized

# Should fail (wrong user)
curl -X POST https://yzssihtflqmgolyajhvb.supabase.co/functions/v1/results-sync \
  -H "Authorization: Bearer WRONG_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"manual": true, "league_id": "..."}'
# Expected: 403 Forbidden

# Should succeed (league admin)
curl -X POST https://yzssihtflqmgolyajhvb.supabase.co/functions/v1/results-sync \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"manual": true, "league_id": "..."}'
# Expected: 200 OK
```

### Cron Sync Authentication

✅ **Implemented**:
- Requires `X-Cron-Secret` header
- Validates against `CRON_SECRET` environment variable
- Returns 403 for invalid/missing secret

**Test**:
```bash
# Should fail (no secret)
curl -X POST https://yzssihtflqmgolyajhvb.supabase.co/functions/v1/results-sync \
  -H "Content-Type: application/json" \
  -d '{"manual": false}'
# Expected: 403 Forbidden

# Should succeed (valid secret)
curl -X POST https://yzssihtflqmgolyajhvb.supabase.co/functions/v1/results-sync \
  -H "X-Cron-Secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"manual": false}'
# Expected: 200 OK
```

### Concurrency Protection

✅ **Implemented**:
- Prevents simultaneous sync executions
- Returns 409 if sync already running
- Uses 5-minute timeout for stale locks

**Test**:
```bash
# Execute two syncs rapidly
curl -X POST ... & curl -X POST ...
# Expected: One succeeds (200), one fails (409)
```

---

## Monitoring

### Sync Runs Dashboard

```sql
-- Recent sync runs
SELECT 
  id,
  trigger_type,
  status,
  started_at,
  finished_at,
  records_fetched,
  records_updated,
  error_message
FROM sync_runs
ORDER BY started_at DESC
LIMIT 20;

-- Error rate
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM sync_runs
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Average duration
SELECT 
  trigger_type,
  AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) as avg_duration_seconds
FROM sync_runs
WHERE status = 'completed'
  AND started_at > NOW() - INTERVAL '7 days'
GROUP BY trigger_type;
```

### Cron Job Health

```sql
-- Check if cron is running
SELECT * FROM cron.job WHERE jobname = 'auto-sync-nfl-results';

-- Check recent executions
SELECT 
  jobname,
  status,
  start_time,
  end_time,
  return_message
FROM cron.job_run_details
WHERE jobname = 'auto-sync-nfl-results'
ORDER BY start_time DESC
LIMIT 10;
```

---

## Troubleshooting

### Issue: Edge Function returns 500

**Possible causes**:
1. `API_SPORTS_API_KEY` not configured
2. `CRON_SECRET` not configured (for cron)
3. Database connection issue

**Solution**:
```bash
# Check Edge Function logs
supabase functions logs results-sync --all
```

### Issue: Cron job not executing

**Possible causes**:
1. Extensions not enabled
2. Vault secret not configured
3. Cron job not created

**Solution**:
```sql
-- Verify extensions
SELECT extname FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net', 'supabase_vault');

-- Verify Vault secret
SELECT name FROM vault.decrypted_secrets WHERE name = 'cron_secret';

-- Verify cron job
SELECT * FROM cron.job WHERE jobname = 'auto-sync-nfl-results';
```

### Issue: Authorization failures

**Possible causes**:
1. User is not league admin
2. JWT token expired
3. League does not exist

**Solution**:
```sql
-- Check user membership
SELECT * FROM league_members 
WHERE league_id = 'YOUR_LEAGUE_ID' 
  AND user_id = 'YOUR_USER_ID';

-- Check league exists
SELECT * FROM leagues WHERE id = 'YOUR_LEAGUE_ID';
```

### Issue: Migration 009.1 fails with "Vault secret not found"

**Cause**: The Vault secret `cron_secret` doesn't exist

**Solution**:
1. Navigate to: `Dashboard → Database → Vault`
2. Click "New Secret"
3. Create secret with name `cron_secret` and the same value as `CRON_SECRET` in Edge Functions Secrets
4. Re-run migration 009.1

---

## Rollback Plan

If deployment fails:

### 1. Disable Cron Job
```sql
SELECT cron.unschedule('auto-sync-nfl-results');
```

### 2. Delete Edge Function
```bash
supabase functions delete results-sync
```

### 3. Revert Database Changes (if needed)
```sql
-- Remove auto_update_results column
ALTER TABLE leagues DROP COLUMN IF EXISTS auto_update_results;

-- Remove external ID columns
ALTER TABLE master_games DROP COLUMN IF EXISTS provider;
ALTER TABLE master_games DROP COLUMN IF EXISTS external_game_id;
ALTER TABLE master_games DROP COLUMN IF EXISTS external_competition_id;
ALTER TABLE master_games DROP COLUMN IF EXISTS mapping_status;

-- Drop sync_runs table
DROP TABLE IF EXISTS sync_runs;
```

---

## Post-Deployment Tasks

1. **Monitor first 24 hours**: Check sync_runs for errors
2. **Verify data accuracy**: Compare API-Sports data with master_games
3. **Check performance**: Monitor Edge Function execution times
4. **User feedback**: Enable for beta users and collect feedback
5. **Gradual rollout**: Enable auto_update_results for more leagues

---

## Success Criteria

- ✅ All 56 tests passing
- ✅ Manual sync works with proper authorization
- ✅ Cron sync executes every 5 minutes
- ✅ No data corruption or duplicates
- ✅ Error rate < 1%
- ✅ Average sync duration < 30 seconds
- ✅ Concurrency protection prevents race conditions

---

## Support

For issues or questions:
1. Check Edge Function logs: `supabase functions logs results-sync`
2. Check sync_runs table for error details
3. Review this deployment guide
4. Contact: [Add support contact]

---

**Document Version**: 1.1  
**Last Updated**: 2026-08-20  
**Next Review**: After first week of production
