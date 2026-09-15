# HANDOFF — Fix de scores fantasma en semanas abiertas (ESP$N scheduled → 0-0)

Fecha: 2026-09-14 · Riesgo: **COMPLEJO** (migración de datos en producción + redeploy de edge functions) · Estado: **APLICADO Y VERIFICADO en producción** (plan aprobado por el usuario: "Fix de fuente + migración")

## Síntoma y causa raíz

La semana abierta (ej. semana 2) mostraba el primer juego sin score y el resto con `0 - 0`, a pesar de no haber empezado. Causa: `normalize()` en `supabase/functions/_shared/espn-nfl.ts` persistía los campos `score` de la API de ESPN **tal cual**, y ESPN devuelve `'0'` (o `''` en el primer juego) para eventos `STATUS_SCHEDULED` → se guardaban `home_score=0/away_score=0` → la UI (`GameCard`) mostraba `0 - 0`.

Evidencia con ESPN real (curl, semana 2): `dates=20260920`/`20260921` → `STATUS_SCHEDULED` con `competitors[].score = '0'` (y `''` en el primer juego abierto).

## Cambios

| Área | Antes | Después |
|---|---|---|
| `_shared/espn-nfl.ts` (`normalize()`) | `hs`/`as_` = `score` de ESPN tal cual | `hs`/`as_` solo si `finished || isLive`; cualquier otro estado (`scheduled/pregame/postponed/cancelled/delayed/suspended`) → `null` |
| Datos persistidos | `master_games`/`league_games` no finalizados con `(0,0)` | Migración `20260914230000_clear_prekickoff_scores.sql`: `home_score=NULL, away_score=NULL WHERE finished=false AND home_score=0 AND away_score=0` (targeted; NO toca finalizados ni en vivo) |

El fix de fuente aplica a `results-sync` **y** `reconcile` (ambos importan `fetchGamesByDate`/`fetchGamesBySeason` de `_shared/espn-nfl.ts`) → se redeployaron las dos pero con los assets actualizados (`Uploading asset ... espn-nfl.ts`).

## Files / áreas cambiadas

- `supabase/functions/_shared/espn-nfl.ts` — regla de persistencia de scores en `normalize()`.
- `supabase/migrations/20260914230000_clear_prekickoff_scores.sql` — saneamiento de datos (nuevo, aplicado).
- `tests/espn-normalize-scores.test.js` — suite nueva (réplica `scoreRule` + `toNumScore`; casos: scheduled `'0'/'0'`, `''`, postponed, final, live, 0-0 en vivo real, null passthrough).
- Sin cambios en UI: `GameCard.jsx` ya renderiza `@` (sin score) cuando los scores son `null`.

## Tests / QA

- `node --test tests/` → **401/401 pass** (393 previos + 9 nuevos). El único fallo inicial fue un `SyntaxError` en el título del test (comillas simples rompían el string) → corregido.
- `npm run build` → OK.
- Migración aplicada con `supabase db push` (única pendiente en `supabase migration list`; `Finished` sin errores).
- **Verificación en BD real:**
  - `master_games` (anon REST): semana 2 no finalizados → `home_score/away_score = null`; **0 filas** restantes con `(0,0)` y `finished=false`.
  - `league_games` (opaca a anon por RLS): verificada con edge function temporal `verify-scores` (solo lectura, rol de servicio) → **`corrupt_league_games: 0`**, `corrupt_master_games: 0`, y muestra de semana 2 no finalizados con scores `null`. Función temporal **deleted** de la nube y carpeta local eliminada.

## Riesgos residuales

- Migración aplicada en producción (aprobada por el usuario vía question). Las ligas con juegos en vivo legítimos (`finished=false` con scores parciales) no se tocaron (predicado `(0,0)`).
- Queda a cargo de un snapshot de UI real: Picks página semana 2 verificada en base a datos (no con sesión de miembro real; el harness usa sesión sintética y `league_games` exige membresía RLS).

## Siguiente paso recomendado

- Un vistazo manual del usuario en `#/picks` (semana 2 abierta): las cards deben mostrar `@` en vez de `0-0` / sin score. El cron `*/3` refrescará los scores reales al iniciarse cada juego (estado `live` → HIGH) y al finalizar.

## Decisiones

- Usuario eligió la opción "Fix de fuente + migración" (ambas capas), descartando solo-migración (re-infección en la próxima sincronización) y solo-fuente (los datos ya corruptos persistían).