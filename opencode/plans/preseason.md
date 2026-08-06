# Preseason Experience (🏈)

**Estado**: Diseño (referencia oficial de experiencia — PLAN-004). **Solo arquitectura — sin implementar.**

## Visión

La experiencia **🏈 Pretemporada** es una liga **exclusiva** de calendario oficial. Enseña a los usuarios cómo jugar GameGuru en un entorno con el calendario real de pretemporada (fases `preseason`, semanas 1–4), con resultados provistos por el motor oficial (no manuales). Es el paso intermedio entre el 🎓 Training Camp (aprendizaje simulado) y la 🏆 Temporada Regular (la experiencia completa).

## Modelo de datos (PLAN-004, BUILD-004.1)

- `leagues.league_mode = 'preseason'`.
- `leagues.season` (default `'2026'`).
- `master_games.phase = 'preseason'` desambigua la colisión de `week` con la regular (semanas 1–4 de pretemporada vs 1–18 de regular).
- Clave canónica `(sport, season, phase)` ya existente.
- **Identidad visual (decisión 2026-08-04)**: color teal `#14B8A6` (token `--mode-ps`), ícono 🏈, banner "Pretemporada", mensajes de puesta a punto. Ver índice de experiencias en `blueprint.md`.

## Comportamiento

| Funcionalidad | 🏈 Pretemporada |
|---|---|
| Importar del calendario maestro | ✅ fase `preseason` |
| Agregar juego manual | ❌ |
| Captura manual de resultados | ⚠ solo provider offline (con aviso `manager.manualResultWarning`) |
| Resultados por proveedor | ✅ (Official Provider Engine) |
| Dashboard completo | ✅ |
| Leaderboards (semanal + general) | ✅ |
| Estadísticas | ✅ |
| Noticias (futuro) | ❌ |
| PRIVACY-001 | ✅ aplica (picks privados hasta el cierre) |

## Integración con proveedores

`espnProvider (preseason) → adapter.mapProviderGame → sportsRepository.getSchedule/getScoreboard → sportsService.syncSeason({ sport, season, phase: 'preseason' })`
- `sportsService.syncSeason` hace upsert en `master_games` y propaga scores a `league_games` por `master_game_id` de ligas oficiales de esa fase.
- **SuperAdmin** = hub de sincronización ("Sincronizar NFL 2026", incluye pretemporada).
- Deadline de picks: semanal (1h antes del primer partido de la semana de la fase), igual que Regular — `getWeekDeadline`/`isWeekLocked` de `src/utils/dates.js`.

## Roadmap por BUILD (BUILD-PS)

| BUILD | Contenido | Resultado |
|---|---|---|
| **PS-001** | Derivar semanas de la fase de la liga (`Picks`/`PublicPicks` reemplazan `TOTAL_WEEKS=18`); filtro por fase en import de `LeagueGamesManager` | Pretemporada legible/importable |
| **PS-002** | Provider real con fase `preseason` (`espnProvider` + adapter + `syncSeason` con fase) + botón Sync en SuperAdmin | Calendario de pretemporada real |
| **PS-003** | Resultados automáticos de pretemporada (propagación a `league_games`); deshabilitar "Editar resultado" en oficiales (con aviso ⚠ en contingencia) | Sin captura manual |
| **PS-004** | Pulido: badges, copy de fases, empty states | Experiencia completa |

Depende de BUILD-004.4 (gating por modo) y BUILD-004.5/004.6 (provider + resultados automáticos) del roadmap de PLAN-004.

## Riesgos

1. Sin datos de pretemporada hoy (`nflSchedule2026.json` solo trae regular) → depende del proveedor real (PS-002); riesgo API/rate limits.
2. Colisión de `week` entre fases → mitigado con `phase` (`(sport, season, phase)` como filtro).
3. Bloqueo prematuro de resultados manuales → regla de contingencia (provider offline = manual permitido con aviso ⚠).
4. PRIVACY-001 aplica aquí: nunca agregar picks de la semana abierta (el dashboard usa `lastLockedWeek`).
