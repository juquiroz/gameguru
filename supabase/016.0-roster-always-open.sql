-- ============================================================================
-- BUILD-016 — Roster siempre abierto (invitaciones sin límite por inicio)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores.
--
-- Regla de producto: las ligas aceptan nuevos participantes con el código de
-- invitación en CUALQUIER momento del ciclo (regular, Training Camp, Game
-- Week…), aunque ya hayan comenzado. Reemplaza el comportamiento de
-- 005.4-roster-lock.sql, que cerraba el roster apenas el evento superaba START.
--
-- Espejo de `canJoinLeague()`/`getRosterStatus()` en
-- src/domains/league/services/leagueService.js (fuente única de verdad).
--
-- La política `lm_roster_insert` (005.4) ya consulta
-- `public.league_roster_open(league_id)`, así que solo con redefinir la
-- función a `true` el INSERT sobre `league_members` queda habilitado en
-- cualquier estado de la liga. No hacen falta cambios de política.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.league_roster_open(p_league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT true;
$$;