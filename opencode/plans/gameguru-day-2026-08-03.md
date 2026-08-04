# gameguru — Resumen diario 2026-08-03 (Lun)

Rama: master. Backend: Supabase Cloud ref `yzssihtflqmgolyajhvb`. Tooling: node v20.20.2, vite 5.4.21 (sin `rg`/`gh`/Docker; usar Grep/Read/Glob).
Contexto previo: ver `opencode/plans/gameguru-day-2026-08-01.md` (BUILD-001/002/002.1, build 127 módulos, nada commiteado).

## Qué se hizo hoy (PRIVACY-001)

Nuevo principio de producto: **los picks individuales son privados hasta que la semana se bloquea**. Dashboard solo muestra métricas agregadas/anónimas; los admins incentivan con recordatorios, no con vigilancia.

### Auditoría (resultado: la app ya era mayormente conforme)
- PublicPicks solo muestra `lockedGames`; Leaderboard solo con juegos finalizados; export auditoría gated con `weekLocked`; LeagueGamesManager/LeaguePage/InviteModal sin info de picks. No hubo que tocar nada de eso.

### Cambios implementados
- **`useDashboardData.js`**: standings/posiciones ahora salen de `lastLockedWeek` (semana más reciente con deadline vencido o finalizada) — antes usaba la semana abierta (que nunca tenía resultados, dejando el MiniLeaderboard vacío). Nuevo `participation` = contador anónimo `{ submitted, total }` (distinct `user_id` de la semana abierta ÷ miembros), solo admin y solo con semana abierta. `getForWeek` (picks propios) sin cambios.
- **`CopyReminder.jsx`** (nuevo): botón admin "📣 Copiar recordatorio" que copia mensaje localizado con liga/semana/hora de cierre. Sin identidades.
- **`LeagueDashboard.jsx`**: `.participationBar` (admin) + `CopyReminder` en accesos rápidos (solo `!locked`); MiniLeaderboard recibe `week={lastLockedWeek}`.
- **`MiniLeaderboard.jsx`**: prop opcional `week` → título "Top — Semana {week}".
- **`dashboard.module.css`**: `.participationBar`.
- **i18n es/en**: `dashboard.copyReminder`, `reminderCopied`, `reminderText`, `adminParticipation`, `top3Week`.
- Docs: `gameguru.md` (sección "Privacidad — PRIVACY-001" + árbol), `blueprint.md` (sección PRIVACY-001 + decisiones).

### Decisiones del usuario
1. Recordatorio: solo admin, en el dashboard.
2. MiniLeaderboard: muestra la **última semana bloqueada**.
3. Contador anónimo de participación para admin: **sí**.

## Datos/estado
- `npm run build` ✅ 127 módulos (warning chunk >500 kB pre-existente).
- Dev server local del usuario: `http://localhost:5173/gameguru/`.

## Pendiente
1. Verificar visualmente PRIVACY-001 (sim con admin: contador "n de total" + recordatorio; MiniLeaderboard con semana cerrada; que no aparezca nada individual pre-cierre).
2. Verificar los 3 escenarios de BUILD-002.1 (usuario nuevo / con ligas sin activa / liga activa) y capturas.
3. Decidir commit (BUILD-001/002/002.1 + PRIVACY-001, todo sin commitear), deploy (CI vs manual) y limpieza del `.env`.

## Referencias
- `src/domains/dashboard/hooks/useDashboardData.js` — `lastLockedWeek` (~l.65), `participation` (~l.120).
- `src/domains/dashboard/components/{CopyReminder,LeagueDashboard,MiniLeaderboard}.jsx`.
- `src/i18n/{es,en}.js` — claves `dashboard.*` nuevas.

## Estado de git
Modificados hoy: `useDashboardData.js`, `LeagueDashboard.jsx`, `MiniLeaderboard.jsx`, `dashboard.module.css`, `i18n/{es,en}.js`, `gameguru.md`, `blueprint.md`. Nuevos: `CopyReminder.jsx`, este archivo. Todo sin commitear.
