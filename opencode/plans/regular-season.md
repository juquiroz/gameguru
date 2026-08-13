# Regular Season Experience (🏆)

**Estado**: Diseño (referencia oficial de experiencia — PLAN-004). **Solo arquitectura — sin implementar.**

## Visión

La experiencia **🏆 Temporada Oficial** es la experiencia completa de GameGuru: calendario oficial de temporada regular (fases `regular`, semanas 1–18), resultados automáticos por proveedor, dashboard, posiciones y estadísticas. Es el objetivo final del producto; 🎓 Training Camp (aprender) y 🏈 Pretemporada (practicar con calendario oficial) alimentan esta experiencia.

## Modelo de datos (PLAN-004, BUILD-004.1)

- `leagues.league_mode = 'regular'` (default).
- `leagues.season` (default `'2026'`): elimina el hardcode de `'2026'` en `useLeague`, `SuperAdmin`, `LeagueGamesManager`, `useDashboardData`.
- `master_games.phase = 'regular'` (default).
- `leagues.simulation` se mantiene para compatibilidad temporal; se deprecará en BUILD-004.7.
- Clave canónica `(sport, season, phase)` ya existente → multi-deporte/multi-año sin cambios estructurales.
- **Identidad visual (decisión 2026-08-04)**: color dorado `#F5A623` (accent del producto, token `--mode-rs`), ícono 🏆, banner "Temporada Oficial", mensajes de experiencia completa. Ver índice de experiencias en `blueprint.md`.

## Comportamiento

| Funcionalidad | 🏆 Temporada |
|---|---|
| Importar del calendario maestro | ✅ fase `regular` |
| Agregar juego manual | ❌ |
| Captura manual de resultados | ⚠ solo provider offline (con aviso `manager.manualResultWarning`) |
| Resultados por proveedor | ✅ (Official Provider Engine) |
| Dashboard completo | ✅ |
| Leaderboards (semanal + general) | ✅ |
| Estadísticas | ✅ |
| Noticias (futuro) | ✅ (BUILD-004.8) |
| PRIVACY-001 | ✅ aplica (picks privados hasta el cierre) |

## Integración con proveedores

`espnProvider (regular) → adapter.mapProviderGame → sportsRepository.getSchedule/getScoreboard → sportsService.syncSeason({ sport, season, phase: 'regular' })`
- `sportsService.syncSeason` hace upsert en `master_games` (fuente canónica) y propaga scores a `league_games` por `master_game_id`.
- **SuperAdmin** = hub de sincronización ("Sincronizar NFL 2026"). Futuro: Edge Function + cron (Fase 3 de PLAN-001) + noticias (BUILD-004.8).
- Deadline de picks: semanal (1h antes del primer partido de la semana), vía `getWeekDeadline`/`isWeekLocked` de `src/utils/dates.js`.

## Roadmap por BUILD (BUILD-RS)

| BUILD | Contenido | Resultado |
|---|---|---|
| **RS-001** | Fase `regular` + selector de temporada (`league.season` centralizado; reemplaza `TOTAL_WEEKS=18` por semanas de la fase) | Temporada legible/importable |
| **RS-002** | Provider real con fase `regular` (`espnProvider` + adapter + `syncSeason`) + botón Sync en SuperAdmin | Calendario regular real |
| **RS-003** | Resultados automáticos de temporada (propagación a `league_games`); deshabilitar "Editar resultado" en oficiales (aviso ⚠ en contingencia) | Sin captura manual |
| **RS-004** (futuro) | Noticias, estadísticas avanzadas, Edge Function + cron | Experiencia completa y automatizada |

Depende de BUILD-004.4 (gating por modo) y BUILD-004.5/004.6 (provider + resultados automáticos) del roadmap de PLAN-004.

## Riesgos

1. Doble escritura `league_games` vs `master_games` → mitigado haciendo `master_games` la única fuente en oficiales (no captura manual con provider online).
2. Sin datos de temporada completa en el JSON actual → el provider real (RS-002) es la fuente; riesgo API/rate limits.
3. Colisión de `week` entre fases → mitigado con `phase`.
4. PRIVACY-001 aplica aquí: nunca agregar picks de la semana abierta (el dashboard usa `lastLockedWeek`).
