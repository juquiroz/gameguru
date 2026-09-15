-- ============================================================================
-- BUILD-PURGE-RESET-001 — Purga total de usuarios y contenido (reset de datos)
-- Script MANUAL y DESTRUCTIVO: ejecutar en el SQL Editor de Supabase
-- (Dashboard > SQL). NO es idempotente: borra datos de forma IRREVERSIBLE.
--
-- Decisión PO (PLAN aprobado 2026-09-01):
--   - Full reset de TODO el contenido: ligas, miembros, picks, partidos de
--     liga, sesiones, jornadas y auditoría.
--   - SIN backup previo (autorización explícita del PO).
--   - Se CONSERVA al(los) superadministrador(es) de plataforma
--     (profiles.platform_role = 'platform_superadmin' O is_superadmin = true).
--     Su cuenta (auth.users + profiles) queda intacta y su sesión/JWT sigue
--     siendo válida; su contenido también se borra con el full reset.
--   - Se CONSERVA `master_games` (calendario maestro de configuración); solo
--     se limpian las referencias `mapped_by`/`mapped_at` que apuntan a usuarios.
--
-- Guardas de seguridad:
--   - PRIMERA sentencia = aborto si no se detecta ningún superadministrador
--     (evita dejar la plataforma sin admin). Al correr dentro de una
--     transacción explícita, cualquier fallo posterior revierte TODO.
--   - Conteos ANTES / DESPUÉS para validar (se muestran antes del COMMIT).
--
-- Ejecución (obligatorio, en este orden):
--   1) Seleccionar TODO el script y ejecutarlo (abre transacción; nada se
--      persiste todavía).
--   2) REVISAR los conteos de validación que imprime.
--   3) Ejecutar `COMMIT;` para persistir, o `ROLLBACK;` para revertir.
--
-- Recordatorio de producto: quien crea una liga queda como admin de ella
-- automáticamente (useLeague.js setea role='admin' al crear/unirse a una liga).
-- Tras la purga, la primera liga que cree el superadmin (o cualquier usuario)
-- lo dejará como admin por diseño.
-- ============================================================================

BEGIN;

-- ── 0) ABORTO DE SEGURIDAD: debe existir al menos un superadministrador ────
DO $$
DECLARE
  v_kept int;
BEGIN
  SELECT count(*) INTO v_kept
  FROM public.profiles
  WHERE platform_role = 'platform_superadmin'
     OR COALESCE(is_superadmin, false) = true;

  RAISE NOTICE 'Superadministradores que se conservan: %', v_kept;

  IF v_kept = 0 THEN
    RAISE EXCEPTION '013.0 ABORTADO: no se detectó superadministrador. Nada se borra.';
  END IF;
END $$;

-- ── 1) CONTEOS PREVIOS (reporte) ────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM auth.users)            AS auth_users_before,
  (SELECT count(*) FROM public.profiles)       AS profiles_before,
  (SELECT count(*) FROM public.leagues)        AS leagues_before,
  (SELECT count(*) FROM public.league_members) AS members_before,
  (SELECT count(*) FROM public.picks)          AS picks_before,
  (SELECT count(*) FROM public.league_games)   AS league_games_before,
  (SELECT count(*) FROM public.training_sessions) AS training_before,
  (SELECT count(*) FROM public.game_weeks)     AS game_weeks_before,
  (SELECT count(*) FROM public.pick_submissions) AS submissions_before,
  (SELECT count(*) FROM public.admin_audit_log)   AS audit_before,
  (SELECT count(*) FROM public.master_games)   AS master_games_before;

-- ── 2) CONTENIDO: borrado completo (hijos antes que padres) ────────────────
DELETE FROM public.pick_submissions;
DELETE FROM public.picks;
DELETE FROM public.league_games;
DELETE FROM public.game_weeks;
DELETE FROM public.training_sessions;
DELETE FROM public.league_members;
DELETE FROM public.admin_audit_log;

-- ── 3) master_games: se conserva; solo se limpia la referencia a usuarios ──
UPDATE public.master_games
   SET mapped_by = NULL,
       mapped_at = NULL;

-- ── 4) LIGAS: reset completo (incluye las del superadmin; podrá crear nuevas) ──
DELETE FROM public.leagues;

-- ── 5) USUARIOS: se borran todos EXCEPTO el(los) superadministrador(es) ────
DELETE FROM auth.identities
WHERE user_id NOT IN (
  SELECT p.id FROM public.profiles p
  WHERE p.platform_role = 'platform_superadmin'
     OR COALESCE(p.is_superadmin, false) = true
);

DELETE FROM public.profiles p
WHERE NOT (
  p.platform_role = 'platform_superadmin'
  OR COALESCE(p.is_superadmin, false) = true
);

DELETE FROM auth.users u
WHERE u.id NOT IN (
  SELECT p.id FROM public.profiles p
  WHERE p.platform_role = 'platform_superadmin'
     OR COALESCE(p.is_superadmin, false) = true
);

-- ── 6) VALIDACIÓN FINAL (antes de COMMIT) ───────────────────────────────────
SELECT
  (SELECT count(*) FROM auth.users)
    AS auth_users_after,
  (SELECT count(*) FROM public.profiles)
    AS profiles_after,
  (SELECT string_agg(u.email, ', ' ORDER BY u.email)
     FROM auth.users u
     JOIN public.profiles p ON p.id = u.id
    WHERE p.platform_role = 'platform_superadmin'
       OR COALESCE(p.is_superadmin, false) = true)
    AS superadmins_kept;

SELECT
  (SELECT count(*) FROM public.leagues)        AS leagues_after,
  (SELECT count(*) FROM public.league_members) AS members_after,
  (SELECT count(*) FROM public.picks)          AS picks_after,
  (SELECT count(*) FROM public.league_games)   AS league_games_after,
  (SELECT count(*) FROM public.training_sessions) AS training_after,
  (SELECT count(*) FROM public.game_weeks)     AS game_weeks_after,
  (SELECT count(*) FROM public.pick_submissions) AS submissions_after,
  (SELECT count(*) FROM public.admin_audit_log)   AS audit_after,
  (SELECT count(*) FROM public.master_games)   AS master_games_after,
  (SELECT count(*) FROM public.master_games WHERE mapped_by IS NOT NULL)
    AS master_games_mapped_after;

-- NOTA: la transacción sigue abierta. Revisa los conteos y ejecuta
--   COMMIT;   (persiste)   o   ROLLBACK;   (revierte todo)