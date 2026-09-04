# BUILD-AUTH-NICK-001: Email/Google auth + nickname por liga + revelar nombres - Handoff

## Resumen
Se implementó el sistema de autenticación por email + Google, la captura **única del
nickname por liga** (modal al primer acceso), y el mecanismo de administrador
**"Finalizar liga" / "Revelar nombres"**. El nombre real es privado (incluso para la
consola platform) hasta que el admin finaliza la liga (`finished=true`) y luego
revela (`revealed=true`, irreversible; no puede revelar sin finalizar). La vista tras
revelar muestra `real_name (nickname)`.

## Nivel de Riesgo
- **CRITICO** (data model + migración + OAuth externo + multi-dominio).
- Modelo de BUILD: `opencode-go/gpt-5.6-luna`, razonamiento `high`.

## Reglas de producto (confirmadas por el PO en PLAN)
- Nickname **por liga**, requerido, inmutable una vez fijado, único dentro de la liga,
  reutilizable entre ligas.
- Nombre real siempre privado hasta `finished=true` + `revealed=true`.
- Captura del nickname al **primer acceso** de la liga (cubre flow nuevo y legado).

## Archivos y áreas modificadas

### Datos (migración — NO APLICADA aún)
- `supabase/012.0-auth-nickname-reveal.sql` (NUEVO): ALTER a `profiles`
  (`real_name`, `avatar_url`), `league_members` (`nickname`), `leagues`
  (`finished`/`revealed`); índice único por liga `(league_id, nickname)
  WHERE nickname IS NOT NULL`; triggers `protect_league_member_nickname`
  (bloquea UPDATE si `OLD.nickname NOT NULL`) y `protect_league_reveal_lifecycle`
  (finished false→true, revealed false→true y requiere finished); reescritura de
  `handle_new_user` para poblar `real_name`/`avatar_url` desde meta de Google.

### Dominio puro (lógica testeada)
- `src/domains/league/models/identity.js` (NUEVO): `resolveDisplayName`,
  `isNicknameUnique`, `buildLeagueIdentityMap`, `revealLifecycle`,
  `IDENTITY_FALLBACK`.
- `src/domains/league/hooks/useLeagueIdentity.js` (NUEVO): hook memoizado del mapa de
  display que respeta `league.revealed` (nickname antes de revelar; `real_name
  (nickname)` después).
- `src/domains/league/index.js`: export del modelo de identidad.

### Infraestructura de datos cliente
- `src/supabase.js`: `authApi.signUp` pasa `{username, realName}`; nuevo
  `authApi.signInWithGoogle(redirectTo)`; `membersApi.join` acepta `nickname`;
  `leaguesApi.getMembers` selecciona `user_id, role, nickname`; nuevos
  `leaguesApi.getLeadLifecycle`/`updateLeadLifecycle`, `membersApi.getMyMembership`/
  `setNickname`; `profilesApi.getMany` selecciona `id, username, real_name, avatar_url`.
- `src/hooks/useAuth.js`: `signUp(email,password,realName)`; nuevo `signInWithGoogle`.

### UI
- `src/App.jsx`: render `NicknameModal` en `<main>` para rutas de liga y legado.
- `src/pages/Auth.jsx` + `Auth.module.css`: botón Google, divisor "— o —", campo
  `realName` (registro), sin campo de nickname global, i18n con `useLanguage()`.
- `src/league/components/NicknameModal.jsx` (NUEVO): captura modal, se auto-oculta si
  ya hay nickname o la liga está finalizada/revelada.
- `src/pages/LeaguePage.jsx`: carga de lifecycle, botones "Finalizar liga" y
  "Revelar nombres" con flujo de confirmación.
- Propagación de identidad: `Leaderboard.jsx`, `Picks.jsx` (audit), `PublicPicks.jsx`,
  `useDashboardData.js`, `useTrainingSession.js`.
- `src/i18n/es.js` y `src/i18n/en.js`: bloques `auth.*`, `league.*`, `nickname.*`.

## Tests y evidencia de QA
- **Harness completo**: `node --test tests/` → **251 tests, 0 fallos** (incluye 9 tests
  nuevos de `tests/identity.test.js` para `resolveDisplayName`, `isNicknameUnique`,
  `buildLeagueIdentityMap`, `revealLifecycle`).
- **Build**: `npm run build` → ✅ exitoso (solo advertencia de chunk > 500 kB, preexistente).

### Pruebas de unidad cubiertas (identity.test.js)
- Visible antes de revelar → nickname; después → `real_name (nickname)`.
- Sin nickname → username global como fallback; sin nada → uuid abreviado.
- `isNicknameUnique` (iguales/vacíos/otros con mapa).
- `buildLeagueIdentityMap` refleja member-id → display con revealed.
- `revealLifecycle` rechaza: finalized por admin no-admin, false→true sin previo,
  reveal sin finish, revertir un flag ya true, finish/action sin `id`/`userId`.

## Riesgos residuales
1. **Migración 012.0 NO aplicada** — las features runtime fallarán (columnas/triggers
   ausentes) hasta aplicarla manualmente en el SQL Editor de Supabase.
2. **Config externa pendiente (fuera de código, obligatoria)**: credenciales OAuth en
   Google Cloud (Client ID/Secret), habilitar provider en Supabase, redirects
   `https://juquiroz.github.io/gameguru/**` y `http://localhost:5173/**`, callback
   `https://yzssihtflqmgolyajhvb.supabase.co/auth/v1/callback`. Sin esto el botón
   Google no completa el redirect.
3. **Reveal no actualiza context en vivo**: tras revelar, otros usuarios (y el admin
   en otras vistas) verán el cambio solo al refrescar, porque `league.revealed` del
   contexto no se recarga automáticamente. Es aceptable por ser acción puntual e
   irreversible.
4. **Ventana transitoria de fallback**: si un miembro entra a una liga y ve el
   leaderboard antes de guardar su nickname, el fallback global `username` podría
   mostrar su nombre real brevemente. Minimizado porque el modal fuerza captura.
5. **`userDetail` de platform devuelve `profiles.*`** (incluye `real_name` en el
   payload, aunque **no se renderiza** en `PlatformUserDetail`). De momento no hay
   fuga visual; opcional endurecer el select para excluir `real_name`.

## Decisiones pendientes
- Aplicar la migración `012.0` (manual, requiere autorización del PO/operador).
- Completar la configuración externa de OAuth (Google + Supabase).
- Verificación runtime del redirect de Google y del flujo completo email/Google.

## Próximo paso recomendado
1. Aplicar `supabase/012.0-auth-nickname-reveal.sql` en el SQL Editor de Supabase.
2. Configurar las credenciales/redirects de OAuth (paso manual fuera de código).
3. QA manual en localhost: registro email, registro con realName, botón Google,
   primer acceso a liga → modal nickname, admin finalizar + revelar, y verificación
   de que el nombre real no se ve antes de revelar.
4. (Diferido/opcional) endurecer `platformApi.userDetail` para excluir `real_name`.

## Estado Final
BUILD **completo en código** (tests 251 ✅, build ✅). **Pendiente**: migración SQL y
config OAuth externa (requieren acción manual del operador/PO) antes de que las
features funcionen en runtime.
