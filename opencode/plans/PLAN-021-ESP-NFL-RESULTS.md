# PLAN-021 — Migrar resultados automáticos de API-Sports (free, sin 2026) a scraper ESPN NFL

## Contexto

La temporada de la plataforma es **2026**. El pipeline de resultados (results-sync + reconcile)
consulta `https://v1.american-football.api-sports.io/games?league=1&season=2026&date=...`
con la key `API_SPORTS_API_KEY` (plan free).

### Root cause hallada (validada en producción)
- API-Sports responde al mismo request: `"Free plans do not have access to this season, try from 2022 to 2024."`
- La key free **no cubre la temporada 2026**. No es bug de código.
- El `errors` viene como **objeto** (`{"token": ...}`), no array; el check `d.errors?.length`
  sobre objeto daba `undefined` → silencio → `total_candidates=0`. YA CORREGIDO (diagnóstico).
- UI: `Edge Function returned a non-2xx` ahora expone el error real vía `context.json.error` (YA CORREGIDO).

### Decisión del PO: Scrapping de resultados (elegido)
Reemplazar la fuente API-Sports por el **scoreboard público de ESPN** que ya estaba previsto
en el blueprint como provider real (`espnProvider`), sin key y con datos 2026 presentes.

## Fuente ESPN — endpoint validado hoy
- `GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
- Parámetros: `dates=YYYYMMDD`, `week=1&seasonType=2` (regular), `season=YYYY`
- Respuesta 200. **13 juegos** para 2026-09-13 (Semana 1), estados reales (`STATUS_FINAL`,
  `STATUS_IN_PROGRESS`), scores reales, `week.number`, `season.year/type`.
- Shape observado:
  - `event.id` (string), `event.date` (ISO), `event.week.number`, `event.season.{year,type}`
  - `event.competitions[0].competitors[]`: `{ homeAway, team.abbreviation, team.displayName, score }`
  - `event.competitions[0].status.type.name`: `STATUS_SCHEDULED` / `STATUS_IN_PROGRESS` / `STATUS_FINAL` / etc.

## Decisiones del PLAN
1. **Provider label**: nuevo valor canónico `espn`. Razón: honesto para datos en BD,
   relacional y consultable. Impacto: un cambio aditivo en SQL (CHECK `reconciliation_source`
   incluye `espn`), filtros `.eq('provider','espn')` en edge functions, índice partial.
   Alternativa (rechazada): reusar label `api-sports` con fuente ESPN → fricción 0 pero
   deuda técnica / datos engañosos.
2. **Budget** (`api_budget`, `reserve_api_request`, `check_budget`): se conservan como
   salvaguarda de rate limiting (son parametrizados por `p_provider`, sin acoplar a fuente).
3. **Matching/normalize/reconcile**: shape NormalizedGame idéntico; `matchGame`, dry-run,
   apply, rollback NO cambian de lógica. Solo cambia el fetch provider + `externalGameId`
   (`String(event.id)`) + `externalCompetitionId`.
4. **API_SPORTS_API_KEY**: deja de usarse. Se elimina la dependencia en ambas edge functions
   (el secret puede quedar en Vault sin uso; documentado).

## Alcance / archivos a modificar

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `supabase/functions/_shared/espn-nfl.ts` | **NUEVO**: TEAM_MAP (por `team.displayName`), STATUS_MAP (STATUS_* → scheduled/live/final/...), `normalize(event)`, `fetchScoreboard(params)`, `fetchGamesByDate(keyless)`, `fetchGamesBySeason(season, phase)` (loop week 1..N), log de respuesta. Sin key. |
| 2 | `supabase/functions/results-sync/index.ts` | Usar `_shared/espn-nfl.ts`; provider `espn`; eliminar `API_SPORTS_API_KEY`; `fetchGames` fallback→`fetchGamesBySeason`. |
| 3 | `supabase/functions/reconcile/index.ts` | Usar `_shared/espn-nfl.ts`; provider default `espn`; eliminar key. |
| 4 | `supabase/019.0-espn-provider.sql` | **NUEVO** migración aditiva: CHECK `reconciliation_source` IN (...) + `'espn'`; índice `idx_master_games_game_time` incluye `provider='espn'`; REINDEX. |
| 5 | `src/domains/sports/providers/espn.js` | Implementar adapter real (contrato SportsDataProvider) usando ESPN sin key; exportar `espnProvider`. |
| 6 | `src/domains/sports/providers/apiSportsNfl.js` | Marcar como deprecated (no eliminar; sigue exportado por compat). |
| 7 | `src/domains/sports/index.js` | Exportar `espnProvider`; mantener apiSportsNfl. |
| 8 | `src/pages/PlatformReconciliation.jsx` | scope default provider `espn`; label "ESPN". |
| 9 | `tests/espn-nfl.test.js` **NUEVO** + ajustes existentes que hardcodean `api-sports` (provider label en assertions de tests reconcile/sync) | Validar normalize/status/team map con fixtures reales capturados. |
| 10 | `DEPLOYMENT.md`, `openCode/plans` | Actualizar guía (sin key), procedimiento dry run → apply → sync. |

## Secuencia BUILD (una vez aprobado)
1. Migración SQL `019.0` (PO la aplica en Dashboard, o yo vía link si tiene permisos).
2. `_shared/espn-nfl.ts` + refactor de ambas edge functions + tests locales (node --test).
3. Deploy `reconcile` y `results-sync` por CLI a `yzssihtflqmgolyajhvb`.
4. Frontend: espn.js real + PlatformReconciliation default provider.
5. QA + Handoff.

## QA / validación (mínima para hoy)
- `node --test tests/` (353 existentes + nuevos) y `npm run build`.
- Dry Run provider `espn` fecha `2026-09-13` → `total_candidates ~13`, sin error.
- Apply season → roadmap como era: verificar `master_games.provider='espn'` + `external_game_id`.
- Sync manual → `sync_runs` completed + propagación a `league_games` (scores/finished).
- Cron: verificar secret (sigue igual) y que el job dispare con `provider='espn'`.

## Riesgos residuales
- ESPN escrapea su JSON público: rate limits amigables, sin SLA formal ni key. Es la fuente
  ya contemplada por el blueprint; si un día cambia el shape, normalize se actualiza.
- `fetchGamesBySeason` (loop en semanas 1..18 + preseason/postseason) = N requests; mitigado
  por budget diario existente.
- Cache de estados ESPN: no es un feedstock oficial; `status.type.name` gobierna la lógica.
- Decisión pendiente: verificar que la migración 019 sea aplicable por el PO (permisos) y
  confirmar label provider `espn`.

## Pendiente antes de BUILD
- Aprobación del PLAN por PO.
- (PO) Aplicar migración `019.0` cuando exista, o autorizar que la aplique vía CLI.