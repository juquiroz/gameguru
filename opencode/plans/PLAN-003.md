# PLAN-003 — Rediseño UX de captura de resultados

**Estado**: Implementado (2026-08-03). Diseño aprobado: **Opción A (fila expandida)** + i18n solo en el editor.

## Problema original

En `LeagueGamesManager` los dos inputs de score estaban agrupados al extremo derecho de la fila (`[17] – [24]`), desconectados visualmente de sus equipos. El admin debía deducir qué input correspondía a qué equipo; la hora y el toggle de habilitar competían con el marcador.

## Alternativas evaluadas

| Opción | Descripción | Veredicto |
|--------|-------------|-----------|
| **A. Score por equipo (fila expandida)** | La fila se expande: meta arriba (hora + toggle), columnas VISITANTE/LOCAL con logo + abbr + input debajo de cada equipo, barra Guardar/Cancelar full-width. | **Elegida** — máxima claridad (score anclado + etiqueta), Mobile First, reutilizable multi-deporte |
| **B. Game Card vertical** | Tarjeta estilo GameCard con cada score a la derecha de su equipo y divisor `@`. | Descartada para el listado: footprint demasiado alto en listas largas |
| **C. Estilo ESPN/Flashscore** | Input adyacente a cada equipo en la misma línea (`IND [17] @ [24] LV`). | Futuro "modo edición rápida"; demasiado ajustada en pantallas angostas |

## Decisión de diseño

- **Opción A en modo fila expandida**: al tocar 🏆/📝 la fila cambia a layout columnar (`.editing`); la meta (hora + toggle) queda arriba y el editor ocupa todo el ancho.
- **`ScoreEditor` como componente universal**: `src/components/ScoreEditor.jsx` — recibe `away`/`home` (`{abbr}`), scores iniciales, `saving`, `onSave(awayScore, homeScore)`, `onCancel`. Sirve para cualquier deporte (NFL/MLB/NBA): solo son dos equipos + dos scores + guardar/cancelar.
- **i18n acotado**: solo las etiquetas del editor (`manager.away`, `manager.home`, `manager.save`, `manager.cancel`). El resto del manager sigue hardcodeado en español.

## Implementación

### Nuevos archivos
- `src/components/ScoreEditor.jsx` — estado interno de inputs, autofocus en away, Enter → Guardar, Esc → Cancelar, `aria-label` por columna.
- `src/components/ScoreEditor.module.css` — Mobile First (tokens de `global.css`), barra de acciones full-width, columnas `flex: 1` con `@` centrado; media query ≥480px.

### Archivos modificados
- `src/components/LeagueGamesManager.jsx`:
  - Eliminado estado local `homeScore`/`awayScore` y `handleOpenResult`.
  - `handleSetScores(game, awayValue, homeValue)` — cambia de firma; la persistencia a `league_games` + `master_games` queda **idéntica** (validación de vacíos, refresh `loadData(true)`, mensajes).
  - Render: `editing = resultForm === g.id`; si edita → `editMeta` (hora + toggle) + `<ScoreEditor>`; si no → `teamsRow` + `rowMeta` (hora + botón resultado + toggle) como antes.
- `src/components/LeagueGamesManager.module.css`:
  - Nuevos `.gameRow.editing` (columna) y `.editMeta` (hora/toggle en extremos, full-width).
  - Eliminados `.scoreForm`, `.scoreInput`, `.saveScoreBtn`, `.cancelScoreBtn` (CSS muerto).
- `src/i18n/es.js` / `en.js` → nueva sección `manager.*` (4 claves).

### Sin cambios
GameCard, Picks, PublicPicks, Leaderboard y el dashboard (displays de solo lectura). El comportamiento de persistencia de `handleSetScores` no cambió.

## Verificación

- `npm run build` ✅ (130 módulos, warning chunk >500 kB pre-existente).
- Manual pendiente: guardar resultado nuevo, editar uno existente (pre-fill), cancelar sin guardar, toggle habilitar/inhabilitar, en móvil (barra full-width).
