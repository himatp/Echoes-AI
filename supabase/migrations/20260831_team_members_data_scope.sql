-- ====================================================================
-- ADD DATA_SCOPE TO TEAM_MEMBERS & UPDATE PER-PERSON INVITE ACCEPTANCE
-- Date: 2026-08-31
-- Features:
--   1. Add data_scope ('full' | 'assigned_only') to public.team_members
--   2. Update accept_person_invite RPC to inherit team_members.data_scope
-- ====================================================================

-- 1. Add data_scope column to team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS data_scope TEXT NOT NULL DEFAULT 'assigned_only'
  CHECK (data_scope IN ('full', 'assigned_only'));

-- 2. Update RLS update policy for team_members to allow owners/admins to update team_members.data_scope
DROP POLICY IF EXISTS "Team members update policy" ON public.team_members;
DROP POLICY IF EXISTS "Team members write policy" ON public.team_members;

CREATE POLICY "Team members write policy"
  ON public.team_members FOR ALL
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
  )
  WITH CHECK (
    organization_id IN (SELECT public.get_user_organization_ids())
  );

-- 3. Update accept_person_invite RPC to inherit team_members.data_scope
CREATE OR REPLACE FUNCTION public.accept_person_invite(p_token TEXT)
RETURNS public.organization_members AS $$
DECLARE
  v_tm public.team_members;
  v_member public.organization_members;
  v_scope TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to accept an invite.';
  END IF;

  SELECT * INTO v_tm FROM public.team_members WHERE invite_token = trim(p_token);
  IF v_tm.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite link.';
  END IF;

  v_scope := COALESCE(v_tm.data_scope, 'assigned_only');

  -- 1. Direct Binding: Tie user_id directly to the team_member record
  UPDATE public.team_members 
  SET user_id = auth.uid(), email = COALESCE(auth.jwt() ->> 'email', email)
  WHERE id = v_tm.id;

  -- 2. Add user to organization_members with the team_member's data_scope
  INSERT INTO public.organization_members (organization_id, user_id, role, data_scope)
  VALUES (v_tm.organization_id, auth.uid(), 'member', v_scope)
  ON CONFLICT (organization_id, user_id) DO UPDATE 
  SET data_scope = EXCLUDED.data_scope
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
