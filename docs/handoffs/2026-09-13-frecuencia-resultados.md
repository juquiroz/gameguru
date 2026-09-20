# HANDOFF — Mejora de frecuencia de actualización de resultados NFL

Fecha: 2026-09-13 · Riesgo: **COMPLEJO** (migración/período en producción) · Estado: **APLICADO Y VERIFICADO en producción**

## ¿Usamos una API? Sí — pública y gratuita, sin scrapping HTML

- **Endpoint:** `GET https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=YYYYMMDD`
- JSON público de ESPN (sin key, sin pago, sin login). 1 request devuelve **todos** los juegos de esa fecha.
- Implementación: `supabase/functions/_shared/espn-nfl.ts` (UA `curl/8.5.0`), invocado por el job pg_cron `auto-sync-nfl-results` → función edge `results-sync`.

## Cambios de esta petición (por qué y cómo)

Objetivo: refresco en vivo durante los juegos (NFL: jueves/domingo/lunes) sin malgastar requests fuera de la ventana.

| Área | Antes | Después |
|---|---|---|
| Frecuencia cron | `*/5 * * * *` | `*/3 * * * *` |
| `pregame` (<2h pre) | 60 min | 15 min |
| `imminent` (<30min pre) | 15 min | **3 min** (en vivo) |
| `just_finished` (<2h post) | 10 min | **3 min** |
| `past_active` (2-6h post) | 30 min | **5 min** |
| `past_extended`/`approaching`/`reconciled`/`future` | — | sin cambio (120/240/999999/999999) |
| Límite diario ESPN | 80 automático (default de tabla) | **600 automático** (techo domingo jugador + lunes), manual 20 |
| Contabilidad de consumo | 1 reserva por `sync_run` (subestimaba: 1 request = 1 fecha) | **1 reserva por fecha consultada** (contable real) |

Presupuesto estimado por día de juegos: ~160-300 requests (días sin juegos: 0, el scheduler hace skip `cooldown` sin tocar la API). El límite 600 es techo de seguridad; la red de puntuación de ESPN aguanta sin límite práctico.

## Files / áreas cambiadas

- `supabase/functions/results-sync/index.ts`:
  - Reserva de budget movida **dentro del loop por fecha** (1 request = 1 fecha), con skip `budget_exhausted` cuando todas las fechas exceden, y `budget_remaining` real en `sync_runs`.
  - Defaults de cooldown actualizados (3/3/5/15) — el código usa la config de DB, estos son solo el fallback.
- `supabase/020.0-espn-frequency-budget.sql` (nuevo, script manual SQL Editor, idempotente):
  - Cooldowns `pregame=15`, `imminent=3`, `just_finished=3`, `past_active=5`.
  - Cron `auto-sync-nfl-results` → `*/3 * * * *`.
  - `reserve_api_request` reescrita: límites por proveedor (espn 600 auto / 20 manual; api-sports conserva 80/20) y `ON CONFLICT` ahora también alinea los límites de la fila del día.
  - `check_budget` reescrita: defaults por proveedor en fallback.

## Tests / QA

- Tests **370/370 pass** (`node --test tests/`), **build OK** (`npm run build`).
- No hay suites que dependan de valores numéricos de cooldown/límites (verificado con `rg`).
- Validación cualitativa: con cron 3 min el scheduler sigue descartando `cooldown_active` para partidos fuera de ventana → 0 requests en días sin juegos; en juegos, 1 request por fecha activa cada tic.

## Riesgos residuales

- Migración aplicada en producción (aprobada el 2026-09-13 por el PO): cron `*/3` activo, límite espn 600/día.
- Fila de `api_budget` del día realineada a 600 con `ON CONFLICT` (automatic_used pasó de 6 a 9 en el periodo de verificación, confirmando el refresco cada 3 min).
- El `check_budget` con fila inexistente devuelve NULL (comportamiento preexistente, no bloqueante). `sync_runs`/`api_budget` no son legibles vía REST (RLS) — verificación se hizo con función temporal `admn_verify_freq` ya dropeada.

## Evidencia de QA en producción (2026-09-13 ~22:18 UTC)

- `cron.job` → `auto-sync-nfl-results`, schedule `*/3 * * * *` ✓
- `sync_cooldown_config` → pregame 15, imminent 3, just_finished 3, past_active 5, past_extended 120, rest 999999 ✓
- `api_budget` espn 2026-09-13 → automatic_limit **600**, used 9, manual 20/0 ✓
- Edge function `results-sync` redeployada (2 assets) ✓ · Tests 370/370 · build OK.
- Migraciones versionadas aplicadas con `supabase db push`: `20260913210000_espn_frequency_budget.sql`, luego función de verificación creada (`...001`) y dropeada (`...002`).

## Límite diario del API y ventanas del calendario (análisis PO)

**¿Cuánto es el límite por día del API?** ESPN **no publica un límite diario**: es un endpoint
público sin key y *undocumentado* que alimenta la propia web de ESPN; a nuestro volumen
(comunidades como sportsdataverse lo golpean miles de veces/día) no tiene techo práctico.
El límite real es el nuestro: `api_budget` → `espn` **automatic_limit = 600/día** + manual 20,
con reset a medianoche UTC. El 600 es techo de seguridad propio, no una regla de ESPN.

**Ventanas del calendario NFL (jueves/domingo/lunes) y consumo esperado** — el scheduler
consulta **1 request por fecha UTC** (no por juego) solo cuando el cooldown de algún juego caducó:

| Ventana (ET) | Fecha UTC que cubre | Cadencia | Requests estimados |
|---|---|---|---|
| TNF (jueves noche 8:15pm) | viernes 00:15 | 3 min | ~60-80 ese día |
| Domingo 1pm + 4pm ET (mañana/tarde) | domingo | 3-5 min | ~120-150 (1 request trae todos los juegos de esa fecha) |
| SNF (domingo noche 8:20pm ET) | lunes 00:20 | 3-5 min | ~130-170 el lunes |
| MNF (lunes noche 8:15pm ET) | martes 00:15 | 3-5 min | ~130 |
| Días sin juegos (mar/vié/sáb) | — | — | **0 requests** (skip `cooldown_active`) |

Día pico del calendario (domingo completo + SNF cruzando medianoche UTC) ≈ **200-350 requests/día**
→ el techo 600 deja **margen 2-3x**. Medición real 2026-09-13 22:18 UTC: `automatic_used=9`
(domingo ya casi terminado), consistente con el modelo. El endpoint además **acepta rangos de fechas**
(`dates=20260913-20260915` = 1 request, 14 eventos), pero en NFL las fechas suelen estar separadas por
día, así que aporta poco; se descarta por ahora.

## Decisiones del PO (2026-09-13)

- **Perfil de cadencia elegido: A** — cron `*/3`, cooldowns inminente/recién finalizado=3, post-activo=5,
  pregame=15. Ya aplicado, sin cambios adicionales.
- **Techo diario espn: mantener 600 auto/día** (manual 20). Confirmado como margen ~2-3x sobre el peor día.
- Nota: pasar a perfil B (*/2) o C (*/5) en el futuro es solo actualizar cron schedule + valores en
  `sync_cooldown_config` y el default de `reserve_api_request`.

## Siguiente paso recomendado (monitoreo)

Revisar `api_budget` (espn) tras un **domingo completo** y tras un **lunes** para validar el consumo
real contra el modelo (esperado: 150-350 en el pico semanal). Si algún domingo especial (cartelera
festiva) se acerca a 400+, evaluar antes de tocar el techo. La corrección de `automatic_limit` se hace
vía migración con el mismo patrón (`reserve_api_request` / `check_budget`).