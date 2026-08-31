-- ====================================================================
-- ORGANIZATION MEMBERS COMPLETE RLS POLICY AUDIT & FIX
-- Date: 2026-08-31
-- Features:
--   Complete policy set for public.organization_members:
--   - SELECT: Workspace teammates can view co-members
--   - INSERT: Workspace Owners/Admins can add new members
--   - UPDATE: Workspace Owners/Admins can update roles and data_scope
--   - DELETE: Workspace Owners/Admins can remove non-owner members
-- ====================================================================

-- Drop legacy/partial policies on organization_members
DROP POLICY IF EXISTS "Members can view co-members in their org" ON public.organization_members;
DROP POLICY IF EXISTS "Organization members select policy" ON public.organization_members;
DROP POLICY IF EXISTS "Organization members insert policy" ON public.organization_members;
DROP POLICY IF EXISTS "Organization members update policy" ON public.organization_members;
DROP POLICY IF EXISTS "Organization members delete policy" ON public.organization_members;

-- 1. SELECT Policy (Teammates in the organization can view co-members)
CREATE POLICY "Organization members select policy"
  ON public.organization_members FOR SELECT
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
  );

-- 2. INSERT Policy (Owners and Admins can add members directly)
CREATE POLICY "Organization members insert policy"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- 3. UPDATE Policy (Owners and Admins can update member roles and data_scope)
CREATE POLICY "Organization members update policy"
  ON public.organization_members FOR UPDATE
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- 4. DELETE Policy (Owners and Admins can remove non-owner members)
CREATE POLICY "Organization members delete policy"
  ON public.organization_members FOR DELETE
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND role <> 'owner'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
