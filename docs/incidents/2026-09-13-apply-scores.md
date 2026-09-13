# HANDOFF — Incidente: "Apply borró resultados" (producción)

Fecha: 2026-09-13 · Riesgo: **CRITICO** · Estado: **documentado, sin ejecución de cambios**

## Resumen

El 2026-09-13 el PO corrió el **Apply (reconcile, backfill)** desde la UI de *Platform
Reconciliation* para mapear la Semana 1 a ESPN. Reporta que en **My League** (sección
inferior donde el admin guarda scores) quedaron vacíos casi todos los marcadores —
solo NE-SEA retiene datos. **No hay backup** y **`admin_audit_log` está vacío**, así
que no existe vía de rollback por auditoría. La recuperación solo es posible desde
ESPN en vivo (fuente de verdad pendiente de aprobación). Se documenta sin ejecutar cambios.

## Hallazgos verificados (solo lecturas)

- `master_games` Semana 1: 13 juegos mapeados a ESPN (`provider=espn`,
  `external_game_id` 4018…, `mapping_status=mapped`, `reconciliation_source=backfill`)
  con **scores NULL** — el Apply mapea, nunca escribe scores.
- `league_games` **NflMasters2026** (7ed658fb): Semana 1 **conserva scores+result en DB**
  (SEA-NE 13-10, CAR-CHI 37-59, DET-NO 31-30, HOU-BUF 31-36, CIN-TB 33-27, TEN-NYJ 10-23, …),
  `finished=false` en casi todas aunque tengan score.
- `league_games` **Momios2026** (479e5955): `home_score/away_score` **NULL en todas las
  semanas**; `result` parcialmente preservado (TEN-NYJ→"NYJ").
- **Discrepancia UI vs DB por confirmar**: la DB muestra más scores que los que el
  usuario ve en My League; falta ver qué filtra la UI (league/week/`finished`).

## Causa raíz confirmada: cron `results-sync` falla "ESPN 400"

- Los `master_games` preexistentes guardan `game_time` con formato `"2026-09-11 00:35:00Z"`
  (espacio, sin `T`), mientras los creados por sync/API usan ISO con `T`.
- `results-sync/index.ts` (`schedulerDecision`) arma fechas con `game_time.split('T')[0]`;
  con el formato sin `T`, el `dates` resultante queda corrupto (`20260911 00:35:00Z`)
  y ESPN responde **HTTP 400**. Reproducido: request correcto `20260911` → 200; corrupto → 400.
- Hay **212** `master_games` con `provider=espn` (el Apply mapeó fechas 09-11, 09-13, 09-14, 09-15
  y Semana 2, no solo 13 juegos). El cron no puede sincronizar nada hasta arreglar esto.
- Antes del Apply, el cron hacía skip `no_games` (no existían masters espn); tras el Apply,
  intenta sincronizar y falla `ESPN 400` cada 5 min (21:25+).

## Causa raíz (código)

- `supabase/functions/reconcile/index.ts` (~líneas 232-246) propaga
  `newVal = after[field] ?? pg[game_time?'gameTime':field]`. El adapter ESPN emite
  camelCase (`homeScore`), y `master_games` tiene scores NULL → `newVal`≈`undefined`
  → **el Apply por código no escribe ni borra scores**. Por eso NflMasters2026 conserva datos.
- El estado "vacío" que ve el usuario no está explicado por el Apply; la causa exacta
  **NO está confirmada** (posible render/lectura de otra columna o de otro league).
- Cron `results-sync`: pre-Apply skip `no_games`; post-Apply **failed `ESPN 400`**
  cada 5 min (21:25+). Causa del 400 sin confirmar (requiere log de parámetros).

## Riesgo

**CRITICO** — producción, pérdida potencial de datos de usuario, sin backup, causa raíz parcial.

## Agente / Modelo

OpenCode (big-pickle) · trabajo de investigación, re-plan y QA, sin BUILD de datos.

## Archivos y áreas tocadas (sesión previa, ya desplegados)

- `supabase/functions/_shared/espn-nfl.ts` — fix UA (`curl/8.5.0`) + logging
  `[ESPN] scoreboard respond` / NON-JSON.
- `src/pages/PlatformReconciliation.jsx` — handler de errores 401/sesión expirada.
- Incidente actual: **0 cambios de código/DB** (solo queries de lectura).

## Evidencia de QA

- ESPN: 200 con 13 eventos tras el fix UA; normalize local OK (13). Tests **370/370**
  y build OK (sesión previa).
- Verificado en producción: mapping OK, `sync_runs` (skips→failed), audit vacío
  (0 filas), scores NflMasters vs Momios.

## Riesgos residuales

1. Sin backup ni auditoría del Apply → irreversibilidad total.
2. Cron activo fallando (`ESPN 400`) cada 5 min mientras se decide la recuperación;
   si se repara el sync, **ESPN podría SOBRESCRIBIR los scores manuales existentes**
   — riesgo doble.
3. `finished=false` en juegos con score: si la UI muestra según `finished`, veremos
   "vacío" pese a haber scores — hipótesis a validar.

## Decisiones del PO

1. **Fuente de verdad para recuperar**: **ESPN en vivo** — el PO confirmó que la página de
   ESPN es la fuente de scraping para los scores. *(decidido 2026-09-13)*
2. ¿Qué ve la UI de My League exactamente (league, semana, filtro de `finished`)?
   — el PO reporta que "solo el primer juego NE-SEA tiene score" en la UI; falta cerrar
   la discrepancia UI/DB.

## Siguiente paso recomendado

Revisar/clasificar **sin escribir** (README de riesgo): al aprobar el PO, redactar y
aprobar un PLAN de recuperación con snapshot previo + rollback por juego antes de
cualquier escritura.

## Resolución aplicada (2026-09-13)

Cambios de código (deployados) aprobados por el PO:

1. **Fix cron `ESPN 400`** — `supabase/functions/results-sync/index.ts`
   (`schedulerDecision`): extrae la fecha con `String(game_time).slice(0, 10)` en lugar de
   `split('T')[0]`, soportando el formato con espacio de los `master_games` preexistentes
   (`"2026-09-11 00:35:00Z"`). Test actualizado en `tests/adaptive-sync.test.js` (ISO y con
   espacio). **Cron verificable en producción: run 21:55 UTC = completed,
   records_fetched=211, records_propagated=422** (corrige el ciclo de fallos cada 5 min).
   Evidencia: request malformado → ESP 400; corregido → 200.

2. **Fix UI My League** — `src/components/LeagueGamesManager.jsx`: `hasResult` ya no exige
   `g.finished` (solo `result` o ambos scores), por lo que se muestran los marcadores de
   juegos que tienen scores aunque `finished=false` (la causa de "solo se ve el primer
   juego" era que casi todos tenían scores con `finished=false`). En My Picks ya funcionaba
   porque usa `g.result` directo. 

3. **GESTIÓN DE PARTIDOS solo-admin** — `src/pages/LeaguePage.jsx`: el bloque de
   `LeagueGamesManager` (scores, import, gestión) ahora se renderiza solo cuando
   `isAdmin`; los participantes ya no lo ven (ven resultados en Mis Picks / Tabla de
   Posiciones).

Evidencia de QA: **370/370 tests pass** (`node --test`), **build OK** (`npm run build`).
Tras el sync, ambas ligas quedaron con scores de ESPN en vivo en Semana 1
(Momios2026: 14/16 con scores; NflMasters2026: 16/16). Juegos del jueves de apertura
(SEA-NE y LAR-SF) sin marcador automático — quedarán para carga manual del admin
(flujo normal). Riesgo residual: fuentes sin respaldo de auditoría previo al fix;
cron activo cada 5 min (deseado para auto-refresco de scores en vivo).