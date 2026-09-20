-- ============================================================================
-- BUILD-017 — Borrado de participante por el admin (Quitar participante)
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores.
--
-- Regla de producto: cualquier administrador de la liga (leagues.admin_id o
-- membresía con role='admin', espejo de canManageLeague) puede quitar a un
-- participante. Queda prohibido:
--   - quitar al dueño de la liga (leagues.admin_id);
--   - que un miembro se quite a sí mismo por esta vía.
-- Al quitar a un participante se borran sus `picks` y su fila en
-- `league_members` (los listados de participantes/Training Camp derivan de
-- league_members, así que se limpia todo en un solo paso).
--
-- 1) `public.league_can_manage_members(league_id, actor)`: ¿el actor gestiona
--    la liga? (mismo criterio que canManageLeague en la app).
-- 2) RPC `public.league_remove_member(league_id, p_target)` SECURITY DEFINER:
--    valida lo anterior contra auth.uid() (NO confía en parámetros del
--    cliente — sin riesgo de suplantación), luego borra picks + membresía.
--    Único punto de borrado de miembros; el navegador no borra tablas
--    directamente.
-- 3) Endurece `lm_delete` (005.4 la dejó en `USING (true)`: cualquier usuario
--    autenticado podía borrar cualquier membresía):
--      - solo admins de la liga pueden borrar membresías;
--      - se permite borrar la propia fila (no rompe `leagues.delete`, que
--        limpia TODAS las membresías incl. la del admin al eliminar la liga);
--      - un co-admin NO puede borrar al dueño.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.league_can_manage_members(p_league_id uuid, p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT l.admin_id = p_actor
           OR EXISTS (
             SELECT 1 FROM public.league_members lm
             WHERE lm.league_id = l.id AND lm.user_id = p_actor AND lm.role = 'admin'
           )
    FROM public.leagues l
    WHERE l.id = p_league_id
  ), false)
$$;

DROP POLICY IF EXISTS lm_delete ON public.league_members;
CREATE POLICY lm_delete ON public.league_members
  FOR DELETE USING (
    public.league_can_manage_members(league_id, auth.uid())
    AND (
      auth.uid() = user_id
      OR NOT EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE l.id = league_id AND l.admin_id = user_id
      )
    )
  );

CREATE OR REPLACE FUNCTION public.league_remove_member(p_league_id uuid, p_target uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner uuid;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Se requiere sesión iniciada';
  END IF;
  IF p_league_id IS NULL OR p_target IS NULL THEN
    RAISE EXCEPTION 'Faltan parámetros (liga o participante)';
  END IF;

  SELECT admin_id INTO v_owner FROM public.leagues WHERE id = p_league_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Liga no encontrada';
  END IF;

  -- Solo un admin de la liga puede quitar participantes.
  IF v_actor <> v_owner
     AND NOT EXISTS (
       SELECT 1 FROM public.league_members
       WHERE league_id = p_league_id AND user_id = v_actor AND role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Solo un administrador puede quitar participantes';
  END IF;

  IF p_target = v_owner THEN
    RAISE EXCEPTION 'El dueño de la liga no se puede quitar';
  END IF;

  IF p_target = v_actor THEN
    RAISE EXCEPTION 'No podés quitarte a vos mismo';
  END IF;

  DELETE FROM public.picks
    WHERE league_id = p_league_id AND user_id = p_target;
  DELETE FROM public.league_members
    WHERE league_id = p_league_id AND user_id = p_target;

  RETURN format('Miembro %s removido de la liga %s', p_target, p_league_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.league_remove_member(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.league_remove_member(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.league_remove_member(uuid, uuid) FROM PUBLIC;