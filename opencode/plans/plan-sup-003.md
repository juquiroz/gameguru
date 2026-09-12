# PLAN-SUP-003 — Platform User Management (diseño, READ-ONLY)

**Estado**: PLAN aprobado en sesión (2026-08-13/14, modo PLAN). **Decisiones de alcance tomadas**: ✅ migración `profiles.created_at` incluida; ✅ sin email en MVP (backlog RPC); ✅ card "Usuarios" en `PlatformOverview`. **Nada implementado**: no se tocó código, BD, RLS, roles, migraciones ni usuarios.
**Dependencias previas verificadas**: SUP-000/001 (roles + RLS por JWT), SUP-002 (consola de ligas read-only). SuperAdmin operativo: `bambino29` (`jquiroz2983@gmail.com`, `platform_superadmin`). Preseason GO/FROZEN. Training Camp HOLD (TC-006.3).
**Fuente de los datos**: auditoría read-only en BD viva (`/tmp/opencode/qae2e/audit-sup003*.mjs`, Management API `/database/query`). Git: sin tocar.

---

## 1. Modelo real (auditado, no asumido)

Tablas relevantes y columnas REALES:

| Tabla | Columnas relevantes | Acceso frontend (PostgREST + JWT) |
|---|---|---|
| `auth.users` (208) | `id, email, created_at, updated_at, last_sign_in_at, banned_until, deleted_at, is_super_admin, is_sso_user, is_anonymous, raw_app_meta_data, raw_user_meta_data, encrypted_password, tokens…` | **NO accesible**: 0 grants a `anon`/`authenticated` (verificado `role_table_grants`). Es el muro de seguridad. |
| `profiles` (207) | `id, username, is_superadmin, updated_at, platform_role` — **NO tiene `created_at`** | SELECT público (RLS `true`). |
| `league_members` (49) | `league_id, user_id, role ('member'/'admin'), joined_at` — no tiene `created_at` | SELECT público (`qual=true`). |
| `leagues` (35) | `id, name, code, sport, season, league_mode, simulation, deadline_mode, admin_id, timezone, created_at` | SELECT público. |
| `picks` (288) | `id, user_id, week, game_id, pick, created_at, league_id, training_session_id, submitted_at` | SELECT solo members de su liga + **platform admins (incluye superadmin)** vía `is_platform_admin()`. |

Distribución real:
- `platform_role`: `user` 206, `platform_superadmin` 1 (`bambino29`), `platform_admin` **0** (tier dormante).
- Registros: 8 en 2026-05, 200 en 2026-08. Picks: 288, todos 2026-08 (123 con `submitted_at`, 165 sin).
- **Órfanos**: `auth_sin_profile = 1` (`tc0051-1786159729@gameguru.test`, creado 2026-08-08, sin username ni claim) y `profiles_sin_auth = 0`.
- **Consistencia**: 0 usernames vacíos; 0 inconsistencias `is_superadmin`↔`platform_role`; 35/35 ligas con su admin presente como `league_members.role='admin'`.
- Actividad por usuario calculable (verificado): `GREATEST(max picks.submitted_at/created_at, max leagues.created_at donde admin, max league_members.joined_at)`. Usuarios reales con picks: JAGS/Messias/arparedes05/ing.juan.quiroz.trevia (16), andres19 (48), bambino29 (16).

Índices reales: `profiles(pkey)` único (sin índice de username); `league_members` PK `(league_id, user_id)` — **no hay índice por `user_id` solo** (el detalle de usuario haría full-scan al buscar sus ligas); `picks` con `user_league_week_game_key (user_id,…)` (bien para counts por usuario); `leagues` con `league_mode_idx` (sin índice por `admin_id`).

## 2. Privacidad / data minimization

- **SÍ mostrar**: `username`, `id`, `platform_role`, `is_superadmin` (legacy), `created_at` (registración, vía migración propuesta §20), counts agregados (ligas/picks), `joined_at`, fechas de actividad. Todo desde `profiles`/`league_members`/`leagues`/`picks` (patrón seguro existente, RLS ya lo permite para superadmin).
- **NO mostrar NUNCA**: passwords, hashes, tokens, refresh tokens, `encrypted_password`, secrets, service_role. Inaccesibles de todos modos (auth no leíble).
- **Email**: NO disponible sin infra nueva (auth no accesible). **Decisión MVP: NO mostrar email.** Es legítimo para soporte pero no indispensable; requiere RPC SECURITY DEFINER o Edge Function → **backlog** (no crear mecanismo inseguro).
- **last_sign_in_at / banned_until / deleted_at / is_anonymous**: auth-only → **backlog** (RPC). El superadmin NO necesita hoy controlar bans.

## 3. User List — `#/platform/users`

Columnas MVP (leer con una sola query de PostgREST, sin N+1):

| Columna | Fuente | Notas |
|---|---|---|
| Username | `profiles.username` | link al detalle; `ilike` searchable |
| Platform Role | `profiles.platform_role` | badge; distingue `user`/`platform_admin`/`platform_superadmin` |
| Registrado | `profiles.created_at` (nuevo) | orden default `created_at desc` |
| Ligas | `league_members(count)` | participa (cualquier rol) |
| Administra | `league_members.role=eq.admin` count | rol de LIGA, ≠ platform_role |
| Picks | `picks(count)` | lectura permitida (superadmin vía `is_platform_admin()`) |
| Última actividad | agregado `GREATEST(...)` | derivado, en el dominio |

Sin email, sin last_login, sin password. No sobrecargar.

## 4. Search

- **username**: `ilike '%term%'` (case-insensitive) sobre `profiles.username`. Filtro server-side real.
- **id**: si el término parece UUID → `id=eq.<uuid>` (útil para soporte).
- **email**: NO disponible (sin columna en public) → backlog.
- Evitar cargar toda la tabla: `ilike` + `count: 'exact'` + `range` (patrón SUP-002 ya validado).

## 5. Filters (todos con columnas reales; PostgREST embedded filters)

| Filtro | Expresión PostgREST real |
|---|---|
| `platform_role` | `platform_role=eq.user` / `=eq.platform_admin` / `=eq.platform_superadmin` |
| Con ligas / sin ligas | `league_members.count=gt.0` / `=eq.0` |
| Con picks / sin picks | `picks.count=gt.0` / `=eq.0` |
| League Admin (rol de LIGA) | `league_members.role=eq.admin` |
| Participa en practice/preseason/regular | `league_members.league.league_mode=eq.<mode>` |
| Simulación | `league_members.league.simulation=eq.true` |

**Distinción clave (explícita en la UI)**: `platform_role` (capacidades de plataforma) vs `league_members.role` (administración de UNA liga). Un League Admin NO es Platform Admin. El filtro "platform_admin" devuelve 0 hoy (tier dormante) — se muestra pero vacío.

## 6. User Metrics (por usuario, agregados, sin cargar historial)

- `ligas` = count memberships; `administra` = count memberships `role='admin'`; `esDueño` = count `leagues.admin_id = user`; `picks` = count.
- `ultimaActividad` = `GREATEST(max picks.submitted_at/created_at, max leagues.created_at (admin), max league_members.joined_at)` — verificado calculable.
- `activo` = derivado (§8).
- No cargar el historial completo: solo counts + máximos (una query de membresías + una de picks por usuario en el detalle).

## 7. User Detail — `#/platform/users/:id` (read-only)

1. **Overview**: username, id (UUID, copiable), platform_role badge, registrado (`created_at`), última actualización de profile (`profiles.updated_at`), flags de salud (§ Health).
2. **League Participation**: tabla con `league name` (link → `#/platform/leagues/:id`), `league_mode`, `sport`, `season`, `simulation`, rol en la liga, `joined_at`. Una query: `league_members?user_id=eq.X&select=role,joined_at,league(id,name,code,league_mode,sport,season,simulation,timezone)`.
3. **Activity**: ligas administradas (nombres), total de picks, última actividad (fecha), picks recientes (últimos ~5 con fecha — NO un dashboard de picks).
4. **Platform Role**: muestra `user`/`platform_admin`/`platform_superadmin` con explicación; deja claro que `platform_admin` está dormante y es distinto del league admin.
5. **Health / Flags** (ver § siguiente): sin mutar nada.

## 8. Active User (definición derivada y explícita)

No existe `last_login`/estado de cuenta en public. Definición derivada (MVP), con columnas reales:
- **Activo** = tiene ≥1 pick **o** ≥1 liga administrada (`leagues.admin_id`) **o** ≥1 membresía de liga.
- Complemento visual: `últimaActividad` (fecha) en lista y detalle.
- `last_login`/`last_seen`: **backlog** (requiere RPC o Edge Function; no se inventa una columna ni se agrega telemetría ahora).

## 9. Platform Roles

Estricto `user` / `platform_admin` / `platform_superadmin` (de `profiles.platform_role`, fuente del claim JWT por trigger 007.0). Separado de `league_members.role`. **Sin asignación desde la UI**: nada de promote/demote/make-superadmin/make-platform-admin en SUP-003.

## 10. League Relationship

Por usuario: `league_members` (rol + `joined_at`) → `leagues` (name/mode/sport/season/sim). Links hacia `#/platform/leagues/:id`. No duplicar el contenido de SUP-002 (solo encabezado + link).

## 11. Platform Overview (`#/platform`)

Propuesta: agregar una **card "Usuarios"** en `PlatformOverview` (misma arquitectura de 8 selects paralelos de SUP-001; sin arquitectura nueva). Métricas: total usuarios, con actividad (≥1 pick), en ≥1 liga, sin ligas, plataforma (superadmin). Estas métricas pertenecen al **módulo Users** (`users.js`) y se renderizan en la página existente. Alternativa (si se prefiere menos scope): omitir en MVP y dejar solo la lista/detalle.

## 12. Performance

- Volumen actual: 207 profiles / 49 memberships / 288 picks / 35 leagues (mínimo).
- Diseño para 1k/10k/100k:
  - Paginación server-side (size ~25) + `count: 'exact'` = 1 COUNT (barato).
  - Nested counts (`league_members(count)`, `picks(count)`): PostgREST embeve por fila retornada (10–25 laterales por página) — OK a 100k.
  - `ilike '%..%'` = seq scan sobre `profiles` (tabla angosta); a 100k es de decenas de ms → aceptable; índice `lower(username)` opcional para prefix.
  - **Dependencia de índice**: `league_members(user_id)` para el detalle (hoy PK es `(league_id, user_id)` → full-scan al invertir). Con 49 filas da igual; a escala es necesario.
  - `picks` por usuario: cubierto por `picks_user_league_week_game_key (user_id,…)`.
- Sin sobrearquitectar: NADA de colas/cache/materialización en MVP.

## 13. Auth data (cómo se consulta de forma segura)

- El frontend usa el patrón seguro existente (client anónimo + JWT del superadmin): `profiles`, `leagues`, `league_members` (SELECT público) y `picks` (solo platform admin, y el superadmin cumple `is_platform_admin()`). Verificado en SUP-002.
- `auth.users` NO se consulta desde el navegador (0 grants) y NO se expone service_role.
- **Dependencia única propuesta (migración idempotente, BUILD)**: `profiles.created_at` backfilled desde `auth.users.created_at` (§20). Sin RPC, sin Edge Function.
- Email / last_sign_in: requieren RPC SECURITY DEFINER o Edge Function → **backlog** (documentado como dependencia futura; NO se implementa en SUP-003).

## 14. Authorization

- Gate: `isSuperAdmin` (claim JWT `platform_role='platform_superadmin'`), igual que SUP-002.
- Normal User → `PlatformDenied`; League Admin (aunque sea admin de ligas) → `PlatformDenied`; `platform_admin` → **no activar todavía** (0 usuarios; gate sigue siendo superadmin).
- **Sin cambios de RLS**: las lecturas ya las permite RLS para el superadmin. Este PLAN no modifica RLS.

## 15. Read-only (confirmación de alcance)

SUP-003 NO modifica `profiles`, `auth.users`, `league_members`, `leagues`, `picks`. NO implementa: delete/disable user, change email, reset password, promote/demote, remove membership. Todo eso queda fuera.

## 16. Responsive

Mismo patrón que `PlatformOverview`/`PlatformLeagues`: tabla en contenedor scroll-x en mobile, grids auto-fit, sin UI desktop-only. Verificado en SUP-002 con viewport 390px.

## 17. Empty / Loading / Error

- `loading`: skeleton/estado "Cargando usuarios…".
- `empty`: "No hay usuarios" (tabla vacía real).
- `no-results`: "Sin resultados para '<término>'" (búsqueda/filtros).
- `error`: mensaje genérico + botón reintentar; **sin** SQL, stack traces, tokens ni detalles internos.

## 18. Routing

- Nuevas: `#/platform/users` y `#/platform/users/:id` (parse/build en `hashRouter.js`, helpers en `routes.js`).
- Se conservan: `#/platform`, `#/platform/leagues`, `#/platform/leagues/:id`.
- Gate de `App.jsx` se extiende a 6 tipos de ruta plataforma (mismo `PlatformDenied`).

## 19. Domain — `src/domains/platform/models/users.js` (puro)

Funciones propuestas (solo las necesarias):
- `DEFAULT_PAGE_SIZE` (o reusar el de leagues, extrayendo shared `paginate`).
- `applyUserFilters(filters)` → mapa de filtros PostgREST (§5).
- `searchUsers(term)` → `{username: ilike}` o `{id: eq}` si el término es UUID.
- `paginateUsers(page, pageSize)`.
- `computeUserMetrics(profile, memberships, picksAgg)` → ligas/administra/own/picks/ultimaActividad/activo.
- `userActive(metrics)` → definición §8.
- `computeUserHealth(profile, memberships)` → flags (§ Health).
- `buildLeagueParticipation(rows)` → normaliza `league_members`+`league` para el detalle.

## 20. API — `platformApi.usersList(...)` / `platformApi.userDetail(id)`

- `usersList({page, pageSize, filters, search})`: una query `profiles?select=id,username,platform_role,is_superadmin,created_at,league_members(count),picks(count)&count=exact&range=...&order=created_at.desc` + filtros/search aplicados. Sin N+1.
- `userDetail(id)`: 3 queries paralelas: (1) perfil; (2) membresías+ligas (§7.2); (3) actividad (`picks?user_id=eq.X&select=submitted_at,created_at&order=submitted_at.desc&limit=5` + counts). Máximo 3 requests.
- **Dependencia estructural**: `profiles.created_at` (migración `supabase/008.0-profiles-created-at.sql`, idempotente): `ADD COLUMN created_at timestamptz` → `UPDATE profiles SET created_at = u.created_at FROM auth.users u WHERE u.id = profiles.id` → `SET NOT NULL` + `DEFAULT now()`. **Cuidado**: NO usar `ADD COLUMN DEFAULT now()` (estamparía `now()` en las 207 filas); el backfill debe ocurrir antes del `SET NOT NULL`. Cobertura de nuevos signups: default `now()` (el `handle_new_user` inserta sin created_at → toma default).
- Índices opcionales del BUILD: `league_members(user_id)` (recomendado) y `profiles(lower(username))` (opcional).

## 21. Tests (harness `regression.mjs`)

- `applyUserFilters` (cada filtro → expresión PostgREST correcta, incl. embedded).
- `searchUsers` (ilike + detección UUID).
- `paginateUsers`.
- `computeUserMetrics` / `userActive` (definición de activo: picks-only, league-only, ningún footprint, liga administrada).
- `computeUserHealth` (flags: username vacío, legacy inconsistente).
- `buildLeagueParticipation` (normalización).
- Routing: round-trip `parse(build(usersRoute))` y `userRoute(id)`.
- Authorization: gate devuelve deny para normal/league-admin, allow para superadmin (espejo de SUP-002).

## 22. Browser QA — `qa-platform-users.mjs`

Setup (receta SUP-002): crear superadmin QA por SQL en `auth.users` + 2 PATCH a `profiles.platform_role` (sincroniza claim); crear 2-3 usuarios QA con ligas/picks (service_role) para ejercitar counts/filtros; limpiar al final (cascade) y verificar superadmin real intacto (`bambino29` count=1).
Verifica: 1) superadmin accede; 2) listado (columnas); 3) count exact UI=BD; 4) paginación; 5) búsqueda username + por id; 6) filtros (platform_role, con/sin ligas, con picks, league admin); 7) detalle (Overview, League Participation con links a `#/platform/leagues/:id`, Activity, Platform Role, Health); 8) responsive 390px sin overflow; 9) 0 console errors; 10) 0 HTTP 4xx/5xx; 11) **0 writes**; 12) usuario normal → `PlatformDenied` en ambas rutas; 13) League Admin → `PlatformDenied`; 14) cleanup + superadmin real intacto.

## 23. Regression (en BUILD)

Ejecutar: harness, `qa-platform.mjs`, `qa-platform-leagues.mjs`, `qa-platform-users.mjs`, `qa-preseason.mjs`, `qa-tc0063.mjs`, `qa-league-smoke.mjs`, `qa-multileague-picks.mjs`, `qa-timezone.mjs`, `qa-weekactions.mjs`, `qa-scoreeditor.mjs`, `npm run build`. No tocar Training Camp ni Preseason.

## 24. Documentation (en BUILD)

Actualizar: `opencode/plans/superadmin.md` (sección SUP-003), `opencode/architecture/superadmin.md` (o crear si no existe), `gameguru.md`, `opencode/plans/gameguru-day-2026-08-13.md`. Registrar `SUP-003 PLANNED` ahora y `SUP-003 DONE` al finalizar.

## 25. Git

Sin comandos git (pull/fetch/merge/rebase/checkout/commit/push). Árbol a cargo del usuario.

---

# HANDOFF OBLIGATORIO

- **Modelo**: §1 (auth.users NO leíble; profiles sin created_at; league_members público; picks solo platform admin).
- **Auth data**: §2/§13 (solo via migración `profiles.created_at`; email/last_login → backlog RPC).
- **User List**: §3 (Username, Role, Registrado, Ligas, Administra, Picks, Última actividad).
- **Search**: §4 (username ilike, id eq si UUID; email backlog).
- **Filters**: §5 (platform_role, con/sin ligas, con/sin picks, league admin, participation por mode, sim — todos embedded, columnas reales).
- **User Detail**: §7 (Overview, League Participation con links, Activity, Platform Role, Health).
- **League Participation**: §7.2 (una query `league_members?user_id=eq.X&select=role,joined_at,league(...)`).
- **Activity**: §6 (GREATEST de picks/leagues/memberships; verificado calculable).
- **Active User**: §8 (≥1 pick o ≥1 liga admin o ≥1 membresía; last_login backlog).
- **Platform Roles**: §9 (estricto, separado de league role; sin asignación).
- **Privacy**: §2 (username/id/role/fechas/counts sí; email/last_login NO en MVP; secrets nunca).
- **Performance**: §12 (paginación + count exact + nested counts por página; dependencia índice `league_members(user_id)`; ilike OK a 100k; sin cache).
- **Authorization**: §14 (gate `isSuperAdmin`; normal y League Admin → deny; sin cambios RLS).
- **Read-only**: §15 (cero escrituras; cero acciones administrativas).
- **Tests**: §21. **QA**: §22. **Documentation**: §24.
- **Proposed BUILD**: BUILD-SUP-003 (ver abajo).
- **Risks**: ver abajo.
- **Questions**: solo 2 (bloqueantes de alcance, ver abajo).

## Proposed BUILD-SUP-003

1. **Migración** `supabase/008.0-profiles-created-at.sql` (idempotente, vía Management API): `profiles.created_at` con backfill desde `auth.users.created_at` (antes de `SET NOT NULL`), default `now()`; índice `league_members(user_id)`; (opcional) índice `lower(username)`. Sin RLS.
2. **Dominio** `src/domains/platform/models/users.js` + export en `index.js`.
3. **Rutas/App**: `usersRoute()`/`userRoute(id)` en `routes.js` + parse/build en `hashRouter.js` + gate a 6 tipos en `App.jsx`.
4. **UI**: `src/pages/PlatformUsers.jsx` + `.module.css`, `src/pages/PlatformUserDetail.jsx` + `.module.css`, card "Usuarios" en `PlatformOverview.jsx` (métricas §11), botones de navegación "Usuarios →".
5. **API**: `platformApi.usersList`/`userDetail` en `src/supabase.js` (§20).
6. **Harness**: ~50 tests nuevos (esperado ~485/485) + `npm run build`.
7. **QA**: `qa-platform-users.mjs` (§22) y regresión completa (§23).
8. **Docs** (§24) + limpieza de scripts de auditoría temporales (`audit-sup003*.mjs`).

## Risks

- **Blocker**: ninguno.
- **High**: ninguno.
- **Medium**:
  1. Backfill de `profiles.created_at`: `ADD COLUMN DEFAULT now()` estamparía `now()` en las 207 filas (fecha de registro incorrecta). Mitigación: columna nullable → UPDATE desde `auth.users.created_at` → recién ahí `SET NOT NULL DEFAULT now()`. Verificable en QA (comparar count UI vs BD).
  2. Correctness de embedded filters/search (sintaxis PostgREST con `picks.count=gt.0`, `league_members.role=eq.admin`): patrón ya validado en SUP-002 (nested counts + count exact); mitigación con QA.
  3. Usuario huérfano (`tc0051…`, auth sin profile, 1 fila) es **invisible** en un listado driven por `profiles` (auth no leíble). Se documenta como limitación; exponerlo requiere RPC → backlog.
- **Low**:
  1. Orden default del listado depende de la migración `created_at`; si se descarta la migración, ordenar por username.
  2. `ilike '%..%'` full-scan a 100k (decenas de ms; índice opcional).
  3. Tier `platform_admin` dormante: el filtro/badge existe pero devuelve 0 (comportamiento esperado, no error).

## Questions (resueltas 2026-08-13/14)

1. **Migración `profiles.created_at`** → **SÍ aprobada** (columna + backfill desde `auth.users.created_at`, sin RLS; para fecha de registro y orden del listado).
2. **Email visible al superadmin en el detalle** → **NO en MVP** (data minimization; requiere RPC SECURITY DEFINER o Edge Function → **backlog**).
3. **Card "Usuarios" con métricas en `#/platform`** → **SÍ aprobada** (en `PlatformOverview`, reusando el patrón de selects paralelos).
