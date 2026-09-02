-- Migration: 20260902_org_deletion_function.sql
-- Description: SECURITY DEFINER procedure to perform cascading deletion of organizations and all child resources, bypassing client RLS constraints.

CREATE OR REPLACE FUNCTION delete_organization_by_id(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Delete action items associated with organization
  DELETE FROM public.action_items WHERE organization_id = p_org_id;

  -- 2. Delete meetings associated with organization
  DELETE FROM public.meetings WHERE organization_id = p_org_id;

  -- 3. Delete team members associated with organization
  DELETE FROM public.team_members WHERE organization_id = p_org_id;

  -- 4. Delete organization members associated with organization
  DELETE FROM public.organization_members WHERE organization_id = p_org_id;

  -- 5. Delete parent organization record
  DELETE FROM public.organizations WHERE id = p_org_id;
END;
$$;

-- Grant execution permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION delete_organization_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_organization_by_id(UUID) TO service_role;
