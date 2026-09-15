-- ============================================================================
-- BUILD-SUP-000 — Audit log (infraestructura) + log_admin_action
-- Script MANUAL: ejecutar en el SQL Editor de Supabase (Dashboard > SQL).
-- Idempotente: puede ejecutarse varias veces sin errores.
--
-- Alcance (PLAN SUP §SUP-000 — audit):
--   1) `admin_audit_log` → registro inmutable de acciones de plataforma
--      (actor, acción, entidad, payload). La UI de consulta llega en SUP-005.
--   2) `log_admin_action(...)` SECURITY DEFINER → única vía de escritura
--      (actor = auth.uid() de la sesión). Sin policy de INSERT: los clientes
--      no pueden escribir directo. SELECT solo para platform admins vía JWT
--      (service_role para la consola SUP-001, que bypassa RLS).
--      Los writes de plataforma futuros (SUP-004) entrarán por Edge Functions
--      con service_role.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  entity text,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity
  ON public.admin_audit_log (entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON public.admin_audit_log (actor_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit log readable by platform admins" ON public.admin_audit_log
  FOR SELECT
  USING (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_entity text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, action, entity, entity_id, payload)
  VALUES (auth.uid(), p_action, p_entity, p_entity_id, p_payload);
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action(text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, jsonb)
  TO service_role;
