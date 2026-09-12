# BUILD-PURGE-RESET-001: Purga total de usuarios y contenido (conservando el superadmin) - Handoff

## Resumen
Se creó el script MANUAL y destructivo `supabase/013.0-purge-users-reset.sql`
para reiniciar la plataforma: se borran TODOS los usuarios (auth.users +
profiles) y TODO el contenido (ligas, miembros, picks, partidos de liga,
sesiones, jornadas, auditoría), **conservando únicamente al(los)
superadministrador(es) de plataforma** y el calendario maestro `master_games`.
El objetivo es que todos se registren con el flujo nuevo (email + password +
"Nombre real (opcional)") y el nickname se pida solo al crear una liga o ser
invitado (captura por liga vía NicknameModal).

## Nivel de Riesgo
- **CRITICO** (borrado irreversible en producción, multi-tabla, auth incluida).
- Modelo de BUILD: `opencode-go/gpt-5.6-luna`, razonamiento `high`.

## Decisiones del PO (PLAN aprobado 2026-09-01)
- Full reset de todo el contenido.
- **Sin backup** (autorización explícita del PO; dato no recuperable).
- Conservar el(los) superadministrador(es) de plataforma
  (`platform_role = 'platform_superadmin'` o `is_superadmin = true`).
- Recordatorio registrado: quien crea una liga queda **admin automáticamente**
  (verificado en `src/hooks/useLeague.js`: `role: 'admin'` en create/join).

## Archivo creado
- `supabase/013.0-purge-users-reset.sql` (NUEVO): script manual destructivo con:
  - **Transacción explícita** (`BEGIN`...COMMIT/ROLLBACK manual): cualquier
    fallo revierte todo; nada se persiste hasta que el operador ejecute
    `COMMIT;`.
  - **Aborto de seguridad como PRIMERA sentencia**: si no hay ningún
    superadministrador detectado → `RAISE EXCEPTION` y no se borra nada.
  - Orden de borrado respetando FKs: contenidos (hijos) → `master_games`
    (solo `mapped_by`/`mapped_at` = NULL, FK a auth.users sin cascade) →
    `leagues` → `auth.identities`/`profiles`/`auth.users` excluyendo kept.
  - Conteos ANTES y DESPUÉS de validación + reporte de los emails
    superadmin conservados.

## Tests y evidencia de QA
- **Harness completo**: `node --test tests/` → **254 tests, 0 fallos**
  (sin cambios de código runtime en este BUILD; solo el script SQL nuevo).
- **Build**: `npm run build` → ✅ exitoso (solo advertencia de chunk > 500 kB,
  preexistente).
- **Revisión estática del script**: sql verificado manualmente (abortos,
  subselects de kept reutilizados de forma consistente, `COALESCE` en
  `is_superadmin` para evitar fugas de NULL en `NOT(...)`).

## Riesgos residuales
1. **Irreversible sin backup** (decisión del PO). Si algo se ve mal, el
   operador puede `ROLLBACK` MÁXIMO hasta que ejecute `COMMIT`.
2. **Superadmin mal detectado**: si la cuenta real no está marcada como
   `platform_superadmin`/`is_superadmin`, sería borrada. Mitigación: el script
   imprime `superadmins_kept` en la validación ANTES del COMMIT; si no aparece
   el email esperado → `ROLLBACK`.
3. **JWT/sesiones activas**: los tokens de otros usuarios siguen válidos hasta
   expirar (refresh fallará); para un arranque limpio conviene logout/cambio de
   pestañas. La sesión del superadmin conservado no se ve afectada.
4. **Migración 012.0 sigue sin aplicarse**: imprescindible aplicarla ANTES del
   nuevo flujo (columnas/triggers de nickname/reveal). 
5. **Deploy pendiente**: producción corre el build viejo (con nickname en el
   registro); la purga + flujo nuevo recién se ven con el deploy de
   `development` → `master`.

## Próximo paso recomendado (orden estricto)
1. Aplicar `supabase/012.0-auth-nickname-reveal.sql` en el SQL Editor de
   Supabase (idempotente) — prepara el esquema del nuevo flujo.
2. Ejecutar `supabase/013.0-purge-users-reset.sql`: correr TODO el script,
   REVISAR conteos/`superadmins_kept`, y solo entonces `COMMIT;`
   (o `ROLLBACK;` ante cualquier duda).
3. QA inmediato: registrar con email+password+realName (sin nick); crear liga →
   modal nick + creador admin; unirse por código/invitación → modal nick;
   verificar que ningún email aparece en Leaderboard/Miembros/Picks/Training.
4. Coordinar commit + push + PR `development`→`master` para desplegar el
   código nuevo (autorización git del PO).

## Estado Final
BUILD **completo en código** (script 013.0 listo; tests 254 ✅, build ✅).
**Pendiente (manual, operador)**: aplicar 012.0 → ejecutar/confirmar 013.0 →
deploy → QA smoke.