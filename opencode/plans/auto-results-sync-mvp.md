# Auto Results Sync — BUILD-AUTO-SYNC-001 (MVP NFL)

**Estado**: Implementado — Pendiente validación live con API key real
**Fecha**: 2026-08-20
**Risk Level**: COMPLEJO

---

## Summary

MVP de actualización automática de resultados para Gameguru. Ligas NFL oficiales (preseason/regular) sincronizan resultados reales desde API-Sports. Separación estricta con resultados simulados (Training Camp).

**Proveedor**: API-Sports (api-sports.io) — NFL
**Infraestructura**: Supabase Edge Functions
**Alcance**: Solo NFL. MLB/NBA POST-MVP.

---

## Architecture

```
pg_cron (cada 5 min) o Manual Sync
    ↓
results-sync Edge Function
    ↓
API-Sports NFL API
    ↓
normalize + validate
    ↓
UPSERT master_games (idempotente)
    ↓
PROPAGATE league_games (WHERE training_session_id IS NULL)
    ↓
log sync_runs
    ↓
Frontend refresh
```

---

## Simulation Protection

**Regla crítica**: Sync Engine NUNCA actualiza `league_games` donde `training_session_id IS NOT NULL`.

Solo ligas oficiales reciben datos del provider. Training Camp no es afectado.

---

## Deployment Checklist

1. Ejecutar migración: `supabase/009.0-auto-results-sync.sql`
2. Configurar secret: `supabase secrets set API_SPORTS_API_KEY=xxx`
3. Deploy Edge Function: `supabase functions deploy results-sync`
4. (Opcional) Configurar pg_cron

---

## Tests

```bash
node --test tests/*.test.js
```

**33 tests, 0 failures**

---

## Files Changed

**Nuevos**:
- `src/domains/sports/providers/SportsDataProvider.js`
- `src/domains/sports/providers/apiSportsNfl.js`
- `src/domains/sports/index.js`
- `supabase/functions/results-sync/index.ts`
- `supabase/009.0-auto-results-sync.sql`
- `tests/apiSportsNfl.test.js`
- `tests/normalize.test.js`
- `tests/sync.test.js`

**Modificados**:
- `src/components/SyncStatus.jsx`
- `src/components/LeagueGamesManager.jsx`

---

## Handoff

**Summary**: MVP implementado. Tests 33/33. Build exitoso. Pendiente: configurar API key, deploy Edge Function, validar con datos reales.

**Risk Level**: COMPLEJO

**Residual Risks**: API key no configurada, Edge Function no desplegada, validación live pendiente.

**Next Step**: Ejecutar migración SQL → Configurar API_SPORTS_API_KEY → Deploy Edge Function → Validar con datos reales.
