-- ====================================================================
-- RECURSION FIX FOR ORGANIZATION MEMBERS RLS POLICIES (SECURITY DEFINER)
-- Date: 2026-08-31
-- Error Fixed: 42P17 (infinite recursion detected in policy for relation "organization_members")
-- Solution: SECURITY DEFINER helper function `is_org_admin_or_owner(p_org_id)`
-- ====================================================================

-- 1. Create SECURITY DEFINER Helper Function (Bypasses RLS to prevent 42P17 recursion)
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;


-- 2. Drop policies on organization_members
DROP POLICY IF EXISTS "Members can view co-members in their org" ON public.organization_members;
DROP POLICY IF EXISTS "Organization members select policy" ON public.organization_members;
DROP POLICY IF EXISTS "Organization members insert policy" ON public.organization_members;
DROP POLICY IF EXISTS "Organization members update policy" ON public.organization_members;
DROP POLICY IF EXISTS "Organization members delete policy" ON public.organization_members;


-- 3. Re-create RLS Policies using SECURITY DEFINER helper function

-- SELECT Policy (Teammates in the organization can view co-members)
CREATE POLICY "Organization members select policy"
  ON public.organization_members FOR SELECT
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
  );

-- INSERT Policy (Owners and Admins can add members directly)
CREATE POLICY "Organization members insert policy"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    public.is_org_admin_or_owner(organization_id)
  );

-- UPDATE Policy (Owners and Admins can update member roles and data_scope)
CREATE POLICY "Organization members update policy"
  ON public.organization_members FOR UPDATE
  USING (
    public.is_org_admin_or_owner(organization_id)
  )
  WITH CHECK (
    public.is_org_admin_or_owner(organization_id)
  );

-- DELETE Policy (Owners and Admins can remove non-owner members)
CREATE POLICY "Organization members delete policy"
  ON public.organization_members FOR DELETE
  USING (
    role <> 'owner'
    AND public.is_org_admin_or_owner(organization_id)
  );
