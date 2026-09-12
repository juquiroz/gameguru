-- ============================================================================
-- BUILD-TC-005.4 — Roster lock (cierre de invitaciones al inicio)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores.
--
-- Regla de producto: las invitaciones están abiertas desde League Created →
-- TC WAITING → TC COUNTDOWN y se cierran cuando el Training Camp entra
-- oficialmente en START (`training_started` o cualquier estado posterior, o
-- cualquier evento no-TC como fixture_generation / game_week).
--
-- 1) `public.league_roster_open(league_id)` → decisión de dominio en SQL,
--    espejo de `canJoinLeague()` en
--    src/domains/league/services/leagueService.js (fuente única de verdad).
--    Modelo v2 (BUILD-TC-V2-001): una sesión `training_camp_v2` mantiene el
--    roster abierto hasta que el flag `started` sea true (requiere previo
--    despliegue de 014.0); setup e inviting no congelan invitaciones.
-- 2) Política de INSERT sobre `league_members` con la guarda → el backend
--    rechaza nuevos miembros cuando el roster está cerrado (defensa en
--    profundidad; la app ya rechaza en la capa de servicio joinByCode).
-- 3) `lm_update USING (true)` → RESTAURA el UPDATE sobre league_members
--    (el nickname del BUILD-AUTH-NICK-001 se persiste porque la membresía
--    propia es actualizable).
--
-- NOTA: si en la consola existe una política de INSERT anterior y permisiva
-- sobre `league_members` con otro nombre, eliminala para que esta guarda sea
-- la única vía de inserción (las políticas de INSERT se combinan con OR).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.league_roster_open(p_league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN ts.event_type = 'training_camp' AND ts.state = 'training_camp_v2' THEN
        -- Modelo v2: abierto hasta que el campamento arranca (started, 014.0).
        NOT COALESCE(ts.started, false)
      ELSE (ts.event_type = 'training_camp'
            AND ts.state IN ('created', 'waiting_players', 'countdown'))
    END
    FROM public.training_sessions ts
    WHERE ts.league_id = p_league_id
    ORDER BY ts.session_no DESC
    LIMIT 1
  ), true);
$$;

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lm_roster_insert ON public.league_members;
DROP POLICY IF EXISTS lm_read          ON public.league_members;
DROP POLICY IF EXISTS lm_update        ON public.league_members;
DROP POLICY IF EXISTS lm_delete        ON public.league_members;

CREATE POLICY lm_roster_insert ON public.league_members
  FOR INSERT
  WITH CHECK (public.league_roster_open(league_id));

CREATE POLICY lm_read   ON public.league_members FOR SELECT USING (true);
CREATE POLICY lm_update ON public.league_members FOR UPDATE USING (true);
CREATE POLICY lm_delete ON public.league_members FOR DELETE USING (true);
