# PLAN-004 — Sistema de Temporadas (Practice / Preseason / Regular)

**Estado**: Diseño aprobado (2026-08-03). **Solo arquitectura — sin implementar.** No modifica código, BD, componentes ni realiza migraciones.

## Contexto / problema actual

- `leagues.simulation` (boolean) es el único discriminador → solo 2 modos; se necesitan 3 experiencias.
- `season` está hardcodeado `'2026'` en 4+ lugares (`useLeague`, `SuperAdmin`, `LeagueGamesManager`, `useDashboardData`).
- `master_games`/`league_games` no tienen fase: `nflSchedule2026.json` solo trae regular season (semanas 1–18, 272 juegos). No hay pretemporada.
- Todos los resultados son manuales; "resultados automáticos" no existe.
- Dominio `sports` (Provider→Adapter→Repository→Service) es un esqueleto (`espnProvider`, `sportsRepository` = stubs).
- Creación: `CreateLeagueModal` (nombre+sport) y `CreateSimulationModal` (superadmin, builder manual) separados.

## Decisiones del usuario (2026-08-03)

1. **Captura manual = contingencia, no normal.** No dos fuentes de verdad.
   - 🎓 Práctica: manual siempre.
   - 🏈 Pretemporada / 🏆 Temporada: manual SOLO mientras el proveedor esté offline. Con provider operativo → resultados sincronizados y "Editar resultado" **deshabilitado**.
   - Al guardar manual en modo oficial → aviso: `⚠ Modo temporal. Este resultado fue ingresado manualmente. Cuando la sincronización automática esté habilitada, los resultados serán obtenidos desde el proveedor oficial.`
2. **Naming**: "Liga" en UI; "experiencia" solo dentro del wizard.
3. **Práctica — equipos**: switch `☑ Equipos NFL` / `○ Personalizado` (texto libre: "Panamá", "Empresa A", etc.). Logo custom → fallback 🏈.
4. **Backfill**: SQL manual (editor SQL de Supabase), no migración formal.

## 1. Modelo de datos recomendado

Evaluación de nombres: `experience_type` ❌ (concepto UX), `season_mode` ❌ (implica per-season), **`league_mode`** ✅ (enum de la liga, extensible).

```
leagues
  ├─ league_mode   text   'practice' | 'preseason' | 'regular'   (reemplaza simulation)
  ├─ season        text   '2026' (default)                        ← deja de hardcodearse
  └─ sport         text   NFL | MLB | NBA | Custom                (ya existe)

master_games
  └─ phase         text   'preseason' | 'regular' | 'postseason'  (default 'regular')

league_games
  └─ master_game_id  UUID nullable  (practice → null; oficial → referencia)  (ya existe)
```

- **`phase` en `master_games`** desambigua la colisión de `week` entre pretemporada (1–4) y regular (1–18). Una liga = un modo = una fase.
- **Disponibilidad del proveedor** = estado de plataforma, no columna: helper `providerAvailable(sport, season, phase)` alimentado por config (`SPORTS`/`SEASONS` con `provider: { available }`).
- Clave canónica `(sport, season, phase)` ya existente → multi-deporte/multi-año sin cambios estructurales. **No** se crea entidad `seasons`/`league_seasons` (un pool = una temporada; normalizar sería complejidad sin caso de uso hoy).
- **Transición tolerante**: `league.mode = league.league_mode || (league.simulation ? 'practice' : 'regular')`.

## 2. Wizard de creación ("elegir una experiencia")

Reemplaza `CreateLeagueModal` + `CreateSimulationModal`. Wizard de 3 pasos, cards (nunca radio buttons).

**Paso 1 — "¿Qué experiencia quieres crear?"**
```
┌──────────────────────────────────────────────────────────────┐
│ ✕  🎮 Elige una experiencia                                  │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────┐  │
│  │      🎓        │ │      🏈        │ │       🏆         │  │
│  │    PRÁCTICA    │ │  PRETEMPORADA  │ │  TEMPORADA OF.   │  │
│  │ Aprende a jugar│ │ Calendario     │ │ La experiencia   │  │
│  │ · Partidos     │ │ oficial pre    │ │ completa         │  │
│  │   propios      │ │ · Resultados   │ │ · Calendario     │  │
│  │ · Resultados   │ │   automáticos  │ │ · Resultados aut.│  │
│  │   manuales     │ │                │ │ · Dashboard/stats│  │
│  └────────────────┘ └────────────────┘ └──────────────────┘  │
│   (cards: icono + título + bullets; seleccionada = accent)   │
└──────────────────────────────────────────────────────────────┘
```
- Cards no disponibles (ej. MLB/NBA sin provider) atenuadas + badge "Próximamente".

**Paso 2 — Nombre y deporte**
```
│  1. Experiencia ✓ → 2. Nombre y deporte                       │
│  Nombre  [ Los Carnales Fantasy                    ]         │
│  Deporte [🏈 NFL] [⚾ MLB*] [🏀 NBA*] [⚙️ Custom]   (* gated) │
│                     [ Continuar ]                             │
```

**Paso 3 — Resumen y confirmación** (transparencia)
```
│  🏆 Temporada Oficial — NFL 2026                             │
│  · Calendario oficial (Semana 1–18)                          │
│  · Resultados automáticos por sincronización                 │
│  · Dashboard, posiciones y estadísticas                      │
│                    [ Crear experiencia ]                     │
```
- **Práctica** → liga vacía; el admin agrega partidos después en `LeagueGamesManager` (se elimina el builder del modal de simulación).
- **Preseason/Regular** → auto-import de `master_games (sport, season, phase)`.

## 3. Comportamiento por modo

| Funcionalidad | 🎓 Práctica | 🏈 Pretemporada | 🏆 Temporada |
|---|---|---|---|
| Importar del calendario maestro | ❌ | ✅ fase `preseason` | ✅ fase `regular` |
| Agregar juego manual (con switch NFL/Custom) | ✅ | ❌ | ❌ |
| Captura manual de resultados | ✅ siempre | ⚠ solo provider offline (con aviso) | ⚠ solo provider offline (con aviso) |
| Resultados por proveedor | ❌ | ✅ | ✅ |
| Dashboard completo | ✅ | ✅ | ✅ |
| Leaderboards (semanal + general) | ✅ | ✅ | ✅ |
| Estadísticas | ✅ básico | ✅ | ✅ |
| Noticias (futuro) | ❌ | ❌ | ✅ |
| Persistir a `master_games` | ❌ | n/a (fuente es master) | n/a |

**Gating en `LeagueGamesManager`** (`league.mode` + `providerAvailable`): sección "Calendario Maestro" solo oficiales; "Agregar manual" y 🏆/📝 solo práctica u oficial con provider offline (aviso ⚠ al guardar). `Picks`/`PublicPicks` derivan semanas de la fase de la liga (reemplaza `TOTAL_WEEKS=18`).

## 4. Integración con proveedores (arquitectura existente)

La cadena esqueletizada se concreta **sin tocar el frontend de lectura** (sigue leyendo `league_games`):

```
espnProvider (real: schedule + scoreboard por sport/season/phase)
   → adapter.mapProviderGame (normalizeScoreboard ya en models/)
   → sportsRepository.getSchedule / getScoreboard
   → sportsService.syncSeason({ sport, season, phase })
        ├─ upsert master_games (nuevos juegos)      ← fuente canónica
        └─ propagar scores a league_games (por master_game_id) de ligas oficiales de esa fase
```

- **SuperAdmin** = hub de sincronización ("Sincronizar NFL 2026"). Futuro: Edge Function + cron (Fase 3 de PLAN-001).
- **Resultados automáticos**: sync escribe `master_games` y propaga a `league_games` (evita deriva dual). Meta: lectura por join a `master_games` como única fuente.

## 5. Compatibilidad / migración segura

| Liga actual | → Target |
|---|---|
| `simulation = false` | `league_mode = 'regular'`, `season = '2026'` |
| `simulation = true` | `league_mode = 'practice'`, `season = '2026'` |

1. **Backfill SQL manual**:
   ```sql
   UPDATE leagues SET league_mode = CASE WHEN simulation THEN 'practice' ELSE 'regular' END, season = '2026';
   UPDATE master_games SET phase = 'regular';
   ```
2. **Código tolerante**: `league.mode` con fallback a `simulation` durante la transición.
3. Centralizar `'2026'` → `league.season` (elimina hardcode).
4. Limpieza final: deprecar `simulation` (BUILD-004.7).

## 6. UX

- Config `MODES`/`SEASONS` data-driven → wizard y badges reutilizables multi-deporte.
- Badge de modo en `LeaguesSummary`/`LeagueDashboard`: 🎓 Práctica / 🏈 Pretemporada / 🏆 Temporada (reemplaza 🧪 Sim).
- i18n es/en: `wizard.*` (pasos, cards, descripciones), `modes.*`, aviso de contingencia (`manager.manualResultWarning`).
- Componente reutilizable `ExperiencePicker` (cards).

## 7. Roadmap por BUILD

| BUILD | Contenido | Resultado |
|---|---|---|
| **004.1** | Modelo: `league_mode`+`season`+`phase`, config `MODES`/`SEASONS`, helper `league.mode` (fallback), backfill SQL manual | Base sin cambios visuales |
| **004.2** | Badges de modo en dashboard/summary + i18n | Identidad visual por experiencia |
| **004.3** | Wizard 3 pasos + `ExperiencePicker` (reemplaza ambos modales) | Crear = elegir experiencia |
| **004.4** | Gating por modo (`LeagueGamesManager` + aviso de contingencia ⚠, `Picks`/`PublicPicks` semanas por fase) | Comportamiento por modo |
| **004.5** | Provider real: `espnProvider` + adapter + repository + `sportsService.syncSeason` + botón Sync en SuperAdmin | Sincronización calendario (incl. pretemporada) |
| **004.6** | Resultados automáticos: sync de scores → `master_games` + propagación a `league_games`; deshabilitar "Editar resultado" en oficiales | Sin captura manual en oficiales |
| **004.7** | Limpieza: depurar `simulation`; multi-deporte (MLB/NBA providers + modelos de semanas) | Multi-deporte sostenible |
| **004.8** (futuro) | Edge Function + cron; noticias | Automatización + contenido |

## 8. Riesgos

1. `'2026'` hardcodeado en 4+ lugares → centralizar en `league.season`.
2. Doble escritura `league_games` vs `master_games` → deriva si conviven manual y sync; mitigado haciendo `master_games` la única fuente en oficiales.
3. Sin datos de pretemporada hoy → depende del proveedor real (004.5); riesgo API/rate limits.
4. Colisión de `week` entre fases → mitigado con `phase`.
5. Bloqueo prematuro de resultados manuales → regla de contingencia (provider offline = manual permitido con aviso).
6. Semántica de semanas en `Picks`/`PublicPicks` (`TOTAL_WEEKS=18`) → derivar de la fase de la liga.

## 9. Recomendaciones del Arquitecto

- `league_mode` + `season` en `leagues`, `phase` en `master_games`: cambio mínimo, clave canónica `(sport, season, phase)` ya existente, extensible a MLB/NBA y años futuros.
- Wizard y gating **data-driven** (`MODES`), no ifs dispersos.
- Un pool = una temporada: no crear entidad `seasons` hoy.
- Orden: 004.1→004.4 antes del proveedor real; el modo oficial coexiste con fallback manual (con aviso) hasta 004.6.
- El aviso de contingencia ⚠ es obligatorio: evita que "nadie se sorprenda cuando el comportamiento cambie".
