# BUILD-PRIVACY-EMAIL-001: El correo nunca aparece en pantallas de otros jugadores - Handoff

## Resumen
Se cerró el hueco de privacidad por el cual un email (o su prefijo) podía quedar
almacenado como identidad y aparecer en pantallas visibles para **otros jugadores**
(leaderboard, miembros, picks, training camp). Ahora el mail es solo contacto
para futuras notificaciones; la única identidad pública en contexto de liga es el
**nickname por liga**, y el nombre real solo se muestra tras el reveal y **nunca**
si tiene forma de email.
Además se aclaró y verificó que el registro **no pide nickname** (solo email +
password + "Nombre real (opcional)"), y este campo ahora muestra una pista visible:
*"Privado: solo se revela a los demás jugadores cuando el admin finaliza y revela
la liga."*

## Nivel de Riesgo
- **CRITICO** (data model + privacidad + producción).
- Modelo de BUILD: `opencode-go/gpt-5.6-luna`, razonamiento `high`.

## Reglas de producto (confirmadas por el PO/operador)
- El correo no debe aparecer en pantallas donde **otros jugadores** puedan verlo;
  se usará solo para notificaciones.
- El nickname **NO** se pide al registrarse (verificado: 0 usos en `Auth.jsx`);
  se captura por liga al primer acceso vía `NicknameModal`. Comportamiento ya
  correcto — sin cambios de código en ese flujo.
- El campo "Nombre real (opcional)" en el registro **se mantiene** con label claro
  de que solo se revela al final de la liga.

## Archivos y áreas modificadas

### Datos (migración — sigue NO APLICADA; actualizada con el hardening)
- `supabase/012.0-auth-nickname-reveal.sql`:
  - `handle_new_user` reescrito: `real_name` se toma SOLO de meta explícita
    (`real_name`/`realName`/`name`/`full_name`), **nunca** de `NEW.email`, y se
    neutraliza si contiene `@`. `username` solo si el usuario lo escribió (nunca el
    prefijo del email).
  - **Nuevo backfill (sección 6)**: `UPDATE profiles SET real_name = NULL WHERE
    real_name LIKE '%@%'` y `UPDATE ... SET username = NULL` donde `username` =
    prefijo del email (limpia datos creados por el fallback viejo).

### Dominio puro (lógica testeada)
- `src/domains/league/models/identity.js`: nuevo export `isEmailLike(v)` (regex de
  email válido). `resolveDisplayName` ahora:
  - En pantallas de liga: `nick → IDENTITY_FALLBACK ('Jugador')`; **eliminado** el
    fallback a `username` global (podía ser el prefijo del email).
  - Tras revelar: `real (nick)` / `real` / `nick` / fallback, donde `real` se
    descarta si `isEmailLike(real)` (un correo como nombre real jamás se muestra).
  - `buildLeagueIdentityMap` ya no envía `username` al display.
- `src/domains/league/index.js`: export de `isEmailLike`.

### Infraestructura de datos cliente
- `src/supabase.js`: `authApi.signUp(email, password, meta)` pasa `meta` tal cual
  (`{ username, real_name }`) a `options.data`.
- `src/hooks/useAuth.js`: `signUp` guarda `real_name` **solo** si el usuario lo
  escribió (nunca `email.split('@')[0]`); el upsert defensivo igual.

### UI
- `src/pages/Auth.jsx`: al registrar ya no se envía el prefijo del email como
  nombre; se renderiza `auth.realNameHint` bajo el campo.
- `src/pages/Auth.module.css`: estilo `.hint` (texto pequeño, `--text3`).
- `src/i18n/es.js` y `src/i18n/en.js`: `realNameOptional` simplificado y nuevo
  `auth.realNameHint` ("Privado: solo se revela a los demás jugadores cuando el
  admin finaliza y revela la liga." / "Private: only revealed to other players
  once the admin finishes and reveals the league.").
- `src/components/LeaderboardTable.jsx`: eliminados los fallbacks
  `row.email`/`row.email?.split('@')[0]` (initials y nombre → '??'/'Jugador').
- `src/domains/training/hooks/useTrainingSession.js`: los participantes del
  training camp se identifican por nickname de liga o 'Jugador'; se eliminó el
  fallback a `p.username` global (podía ser el prefijo del email).

## Tests y evidencia de QA
- **Harness completo**: `node --test tests/` → **254 tests, 0 fallos** (antes 251;
  +3 casos netos: `isEmailLike`, reveal con `real_name` tipo email, deny en
  `buildLeagueIdentityMap`; 2 casos actualizados de fallback → `IDENTITY_FALLBACK`).
- **Build**: `npm run build` → ✅ exitoso (solo advertencia de chunk > 500 kB,
  preexistente).

### Pruebas de unidad cubiertas/actualizadas (tests/identity.test.js)
- Sin nickname en una liga → 'Jugador', **incluso** cuando el username global es un
  prefijo de email (antes caía al username).
- Reveal con `real_name` tipo email → muestra solo el nick (o fallback si no hay).
- `isEmailLike`: emails válidos (incluidos subdominos y espacios) vs nombres.
- `buildLeagueIdentityMap`: display por userId sin fuga; deny cuando el profile
  real_name es un email incluso revelado.

## Riesgos residuales
1. **Migración 012.0 NO aplicada** — hasta aplicarla, el runtime no tiene
   `nickname`/`real_name`/`finished`/`revealed` y el hardening queda solo en el
   dominio cliente. Aplicarla manualmente en el SQL Editor de Supabase.
2. **Prefijos de email sin `@` ya guardados como `real_name`** (p.ej. el fallback
   viejo de `username` guardado en otra columna) no se detectan con
   `isEmailLike`/`LIKE '%@%'`. Mitigado en origen (nada nuevo se deriva del email),
   y el backfill limpia los casos con `@`.
3. **Pantallas de consola platform** (`PlatformUsers`, `PlatformUserDetail`,
   `PlatformLeagueDetail`) siguen mostrando `profiles.username` (prefijo de email
   posible) — es área admin (no la ven otros jugadores); fuera de alcance.
4. **Deploy pendiente**: producción sigue corriendo el build viejo (con nickname en
   el registro). Hasta el deploy, el usuario seguirá viendo el comportamiento
   antiguo.

## Decisiones pendientes
- Aplicar la migración `012.0` actualizada (manual, requiere operador/PO).
- Ejecutar el deploy a GitHub Pages (autorizado) y el smoke test de privacidad.
- (Diferido) endurecer `platformApi.userDetail` para excluir `real_name`. Hasta
  ahora no fuga visual; opcional.

## Próximo paso recomendado
1. Aplicar `supabase/012.0-auth-nickname-reveal.sql` en el SQL Editor de Supabase
   (idempotente; incluye el backfill de limpieza de emails).
2. Deploy a GH Pages: antes verificar **Settings → Pages → Source** (rama
   `gh-pages` vs GitHub Actions); el fix real de "registro sin nickname" que ve el
   usuario en producción llega con este deploy.
3. QA manual de privacidad: registrar con email (sin realName) → entrar a una liga
   → el modal pide nick → verificar Leaderboard/Miembros/Picks/Training camp y que
   el email no aparece en ninguna pantalla compartida; revelar → sin email como
   nombre.

## Estado Final
BUILD **completo en código** (tests 254 ✅, build ✅, diff de 12 archivos).
**Pendiente (manual, operador)**: aplicar la migración + deploy GH Pages + smoke
test de privacidad.