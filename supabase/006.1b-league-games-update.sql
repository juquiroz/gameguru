-- ============================================================================
-- BUILD-TC-006.1b — Simulation: UPDATE de league_games para miembros
--
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL) o
-- aplicado en la nube vía Management API. Idempotente.
--
-- Contexto: la simulación de resultados (SimulationService.setScores) se
-- orquesta desde el cliente del usuario que dispara el lock de la jornada
-- (puede ser un `member`, no necesariamente el admin). El RLS previo de
-- league_games solo permitía UPDATE a admins (`role = 'admin'`), por lo que
-- una simulación disparada por un miembro bloqueaba el UPDATE (0 filas) y el
-- batch no avanzaba ("No se encontró el juego en la base de datos").
--
-- Se mantiene el espíritu del esquema: SELECT por membresía (igual que antes);
-- se añade UPDATE por membresía para que la corrida (acción de sistema, no del
-- usuario) persista resultados en league_games desde cualquier miembro.
-- ScoreEditor (admin-only) sigue funcionando sin cambios.
-- ============================================================================

DROP POLICY IF EXISTS lg_update ON public.league_games;

CREATE POLICY lg_update
  ON public.league_games
  FOR UPDATE
  USING (
    league_id IN (
      SELECT league_id FROM public.league_members
      WHERE user_id = auth.uid()
    )
  );
