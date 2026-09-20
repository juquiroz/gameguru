-- ============================================================================
-- BUILD-TZ-001 — League Timezone
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores ni duplicados.
--
-- Alcance (PLAN TZ §TZ-001):
--   1) `leagues.timezone` → IANA timezone de la liga (display-only; los
--      timestamps de `game_time` siguen siendo instantes absolutos UTC).
--      Default `America/Panama` para ligas existentes (no se infiere
--      retrospectivamente otra timezone).
--
-- Sin cambios en: scores, game_time, locking, deadlines absolutos.
-- ============================================================================

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Panama';
