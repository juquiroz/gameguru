-- ============================================================================
-- PLAN-LEAGUE-CONTEXT-01.1 — Aislamiento de picks por liga (fix multi-liga)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL) o vía
-- Management API. Idempotente: puede ejecutarse varias veces sin errores.
--
-- Problema (QA-MULTI-LEAGUE-DIAGNOSTIC, bug latente HIGH):
--   `picks_user_id_week_game_id_key UNIQUE(user_id, week, game_id)` aísla por
--   usuario SEMANA y GAME, sin league_id ni training_session_id. Como los
--   `game_id` se reutilizan entre ligas (calendario estático `w1g1`, TC
--   `tc-<sessionNo>-<n>` con session_no POR liga), el mismo usuario con picks
--   en 2 ligas que comparten un game_id hacía que el segundo upsert
--   SOBRESCRIBIERA la fila de la primera liga (corrupción silenciosa; el fix
--   23505 de TC-006.4 cambió el error 23505 por pérdida de datos).
--
-- Fix:
--   - Quitar la constraint GLOBAL `picks_user_id_week_game_id_key`.
--   - Asegurar las dos constraints POR LIGA (ya existentes, verificadas en
--     `pg_constraint` el 2026-08-09):
--       * `picks_session_game_unique`    UNIQUE(user_id, league_id, training_session_id, game_id)
--         → flujo Training Camp / Game Week (PicksService).
--       * `picks_user_league_week_game_key` UNIQUE(user_id, league_id, week, game_id)
--         → flujo Season / Regular (training_session_id NULL; usePicks).
--   - Índices de apoyo para las lecturas de standings por liga.
--
-- Orden del script (obligatorio):
--   1) detectar duplicados            → aborta si hay (no se puede migrar)
--   2) resolver/registrar duplicados  → reporte; nada que reparar aquí
--   3) asegurar constraints por liga  → IF NOT EXISTS
--   4) eliminar constraint global     → DROP IF EXISTS
--   5) índices                        → IF NOT EXISTS
--   6) validar                        → reporte de pg_constraint + duplicados
--
-- Contrato nuevo (forward-looking): un pick por `(user_id, league_id, week,
-- game_id)` en season y por `(user_id, league_id, training_session_id,
-- game_id)` en Training Camp. Las filas históricas ya colapsadas por la UK
-- global NO son recuperables (el dato de la liga perdedora se perdió al
-- sobrescribirse); el fix aplica en adelante.
-- ============================================================================

-- 1) DETECTAR DUPLICADOS ──────────────────────────────────────────────────────
-- Con la UK global vigente no debería haber pares (user_id, week, game_id)
-- repetidos. Si los hay (p. ej. por datos insertados a mano), la migración
-- aborta y deja el listado para resolver manualmente.
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT user_id, week, game_id
    FROM public.picks
    GROUP BY user_id, week, game_id
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION '006.2 ABORTADO: % pares (user_id, week, game_id) duplicados en public.picks. Revisar y resolver antes de quitar la constraint global.', dup_count;
  END IF;

  RAISE NOTICE '006.2 paso 1: sin duplicados (user_id, week, game_id) — OK (% filas en picks).', dup_count;
END $$;

-- 2) RESOLVER / REGISTRAR DUPLICADOS ─────────────────────────────────────────
-- Nada que resolver: el paso 1 aborta ante duplicados. Las filas ya colapsadas
-- (1 sola por (user, week, game) con la liga del ÚLTIMO escritor) son un
-- residual histórico documentado; no se reescriben.

-- 3) ASEGURAR CONSTRAINTS POR LIGA (idempotente) ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'picks_session_game_unique'
  ) THEN
    ALTER TABLE public.picks
      ADD CONSTRAINT picks_session_game_unique
      UNIQUE (user_id, league_id, training_session_id, game_id);
    RAISE NOTICE '006.2: picks_session_game_unique creada.';
  ELSE
    RAISE NOTICE '006.2: picks_session_game_unique ya existe.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'picks_user_league_week_game_key'
  ) THEN
    ALTER TABLE public.picks
      ADD CONSTRAINT picks_user_league_week_game_key
      UNIQUE (user_id, league_id, week, game_id);
    RAISE NOTICE '006.2: picks_user_league_week_game_key creada.';
  ELSE
    RAISE NOTICE '006.2: picks_user_league_week_game_key ya existe.';
  END IF;
END $$;

-- 4) ELIMINAR LA CONSTRAINT GLOBAL (único cambio estructural) ─────────────────
-- Bloquea la separación por liga; es la causa raíz de la corrupción silenciosa.
ALTER TABLE public.picks DROP CONSTRAINT IF EXISTS picks_user_id_week_game_id_key;

-- 5) ÍNDICES DE APOYO (lecturas de standings/picks por liga) ─────────────────
CREATE INDEX IF NOT EXISTS picks_league_idx      ON public.picks (league_id);
CREATE INDEX IF NOT EXISTS picks_league_week_idx ON public.picks (league_id, week);

-- 6) VALIDAR ─────────────────────────────────────────────────────────────────
SELECT conname, contype, pg_get_constraintdef(con.oid) AS def
FROM pg_constraint con
JOIN pg_class t ON con.conrelid = t.oid
WHERE t.relname = 'picks'
  AND con.contype IN ('p', 'u')
ORDER BY conname;

SELECT
  count(*) AS total,
  count(*) FILTER (WHERE training_session_id IS NULL) AS season_picks,
  count(*) FILTER (WHERE training_session_id IS NOT NULL) AS session_picks
FROM public.picks;
