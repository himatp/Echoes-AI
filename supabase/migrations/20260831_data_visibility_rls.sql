-- ====================================================================
-- ECHOES PER-PERSON DATA VISIBILITY CONTROL & RLS MIGRATION (COMPLETE AUDIT)
-- Date: 2026-08-31
-- Features:
--   1. Add data_scope ('full' | 'assigned_only') to organization_members
--   2. Add user_id & invite_token to team_members for direct identity binding
--   3. Add linked_member_id & unlinked_speaker to action_items
--   4. Add attendee_ids (TEXT[]) to meetings
--   5. Backfill user_id on team_members & linked_member_id on action_items
--   6. Create SECURITY DEFINER helper functions:
--      - get_user_data_scope(p_org_id UUID) -> RETURNS TEXT
--      - get_user_team_member_id(p_org_id UUID) -> RETURNS TEXT
--      - is_org_admin_or_owner(p_org_id UUID) -> RETURNS BOOLEAN (Fixes 42P17 recursion)
--      - accept_person_invite(p_token TEXT)
--   7. RLS policies for organization_members (SELECT, INSERT, UPDATE, DELETE)
--   8. RLS policies for meetings and action_items
--   9. Create BEFORE UPDATE trigger on action_items for field-level immutability
-- ====================================================================

-- 1. Extend organization_members with data_scope column
ALTER TABLE public.organization_members 
  ADD COLUMN IF NOT EXISTS data_scope TEXT NOT NULL DEFAULT 'full'
  CHECK (data_scope IN ('full', 'assigned_only'));

-- Force all existing and future owners to ALWAYS have 'full' data_scope
UPDATE public.organization_members 
SET data_scope = 'full' 
WHERE role = 'owner';

-- 2. Extend team_members with user_id and invite_token for direct identity binding
ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE DEFAULT substring(md5(random()::text || clock_timestamp()::text) from 1 for 16);

-- 3. Extend action_items with linked_member_id and unlinked_speaker columns
ALTER TABLE public.action_items 
  ADD COLUMN IF NOT EXISTS linked_member_id TEXT REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unlinked_speaker TEXT;

-- 4. Extend meetings with attendee_ids column (TEXT[] matching team_members.id TEXT)
ALTER TABLE public.meetings 
  ADD COLUMN IF NOT EXISTS attendee_ids TEXT[] DEFAULT '{}'::text[];

-- 5. Backfill existing team_members user_id by matching email with auth.users
UPDATE public.team_members tm
SET user_id = u.id
FROM auth.users u
WHERE LOWER(tm.email) = LOWER(u.email)
  AND tm.user_id IS NULL;

-- 6. Backfill existing action_items linked_member_id by matching assignee text with team_members name/email
UPDATE public.action_items ai
SET linked_member_id = tm.id
FROM public.team_members tm
WHERE ai.organization_id = tm.organization_id
  AND (LOWER(TRIM(ai.assignee)) = LOWER(TRIM(tm.name)) OR LOWER(TRIM(ai.assignee)) = LOWER(TRIM(tm.email)))
  AND ai.linked_member_id IS NULL;


-- ====================================================================
-- SECURITY DEFINER HELPER & ACTION FUNCTIONS
-- ====================================================================

-- Helper Function: Returns user's data_scope for a given organization ('full' or 'assigned_only')
CREATE OR REPLACE FUNCTION public.get_user_data_scope(p_org_id UUID)
RETURNS TEXT AS $$
  SELECT data_scope 
  FROM public.organization_members 
  WHERE organization_id = p_org_id AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Drop legacy signature if previously created with UUID return type
DROP FUNCTION IF EXISTS public.get_user_team_member_id(UUID);

-- Helper Function: Returns current user's bound team_member ID (TEXT) in a given organization
CREATE OR REPLACE FUNCTION public.get_user_team_member_id(p_org_id UUID)
RETURNS TEXT AS $$
  SELECT id::text 
  FROM public.team_members 
  WHERE organization_id = p_org_id AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Helper Function: Checks if current executing user is owner/admin of a workspace (Bypasses RLS to prevent 42P17 infinite recursion)
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id 
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Function: Atomic Per-Person Invite Link Acceptance (Binds user_id to team_members directly)
CREATE OR REPLACE FUNCTION public.accept_person_invite(p_token TEXT)
RETURNS public.organization_members AS $$
DECLARE
  v_tm public.team_members;
  v_member public.organization_members;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to accept an invite.';
  END IF;

  SELECT * INTO v_tm FROM public.team_members WHERE invite_token = trim(p_token);
  IF v_tm.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite link.';
  END IF;

  -- 1. Direct Binding: Tie user_id directly to the team_member record
  UPDATE public.team_members 
  SET user_id = auth.uid(), email = COALESCE(auth.jwt() ->> 'email', email)
  WHERE id = v_tm.id;

  -- 2. Add user to organization_members with 'assigned_only' scope
  INSERT INTO public.organization_members (organization_id, user_id, role, data_scope)
  VALUES (v_tm.organization_id, auth.uid(), 'member', 'assigned_only')
  ON CONFLICT (organization_id, user_id) DO UPDATE 
  SET data_scope = EXCLUDED.data_scope
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR ORGANIZATION MEMBERS
-- ====================================================================

-- Drop legacy policies on organization_members
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
    public.is_org_admin_or_owner(organization_id)
  );

-- 3. UPDATE Policy (Owners and Admins can update member roles and data_scope)
CREATE POLICY "Organization members update policy"
  ON public.organization_members FOR UPDATE
  USING (
    public.is_org_admin_or_owner(organization_id)
  )
  WITH CHECK (
    public.is_org_admin_or_owner(organization_id)
  );

-- 4. DELETE Policy (Owners and Admins can remove non-owner members)
CREATE POLICY "Organization members delete policy"
  ON public.organization_members FOR DELETE
  USING (
    role <> 'owner'
    AND public.is_org_admin_or_owner(organization_id)
  );


-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR MEETINGS & ACTION ITEMS
-- ====================================================================

-- Drop legacy policies to ensure clean application
DROP POLICY IF EXISTS "Meetings isolation policy" ON public.meetings;
DROP POLICY IF EXISTS "Action items isolation policy" ON public.action_items;
DROP POLICY IF EXISTS "Meetings read policy" ON public.meetings;
DROP POLICY IF EXISTS "Meetings write policy" ON public.meetings;
DROP POLICY IF EXISTS "Action items read policy" ON public.action_items;
DROP POLICY IF EXISTS "Action items update policy" ON public.action_items;
DROP POLICY IF EXISTS "Action items write policy" ON public.action_items;
DROP POLICY IF EXISTS "Action items insert policy" ON public.action_items;
DROP POLICY IF EXISTS "Action items delete policy" ON public.action_items;
DROP POLICY IF EXISTS "Action items insert delete policy" ON public.action_items;

-- 1. Meetings Table RLS Policies
CREATE POLICY "Meetings read policy"
  ON public.meetings FOR SELECT
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND (
      public.get_user_data_scope(organization_id) = 'full'
      OR (
        public.get_user_data_scope(organization_id) = 'assigned_only'
        AND (
          public.get_user_team_member_id(organization_id) = ANY(attendee_ids)
          OR id IN (
            SELECT meeting_id 
            FROM public.action_items 
            WHERE linked_member_id = public.get_user_team_member_id(organization_id)
               OR (
                 linked_member_id IS NULL 
                 AND (
                   LOWER(TRIM(assignee)) = LOWER(TRIM((SELECT name FROM public.team_members WHERE id = public.get_user_team_member_id(organization_id))))
                   OR LOWER(TRIM(assignee)) = LOWER(TRIM((SELECT email FROM public.team_members WHERE id = public.get_user_team_member_id(organization_id))))
                 )
               )
          )
        )
      )
    )
  );

CREATE POLICY "Meetings write policy"
  ON public.meetings FOR ALL
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND public.get_user_data_scope(organization_id) = 'full'
  )
  WITH CHECK (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND public.get_user_data_scope(organization_id) = 'full'
  );

-- 2. Action Items Table RLS Policies
CREATE POLICY "Action items read policy"
  ON public.action_items FOR SELECT
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND (
      public.get_user_data_scope(organization_id) = 'full'
      OR (
        public.get_user_data_scope(organization_id) = 'assigned_only'
        AND (
          linked_member_id = public.get_user_team_member_id(organization_id)
          OR (
            linked_member_id IS NULL 
            AND (
              LOWER(TRIM(assignee)) = LOWER(TRIM((SELECT name FROM public.team_members WHERE id = public.get_user_team_member_id(organization_id))))
              OR LOWER(TRIM(assignee)) = LOWER(TRIM((SELECT email FROM public.team_members WHERE id = public.get_user_team_member_id(organization_id))))
            )
          )
        )
      )
    )
  );

CREATE POLICY "Action items update policy"
  ON public.action_items FOR UPDATE
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND (
      public.get_user_data_scope(organization_id) = 'full'
      OR (
        public.get_user_data_scope(organization_id) = 'assigned_only'
        AND (
          linked_member_id = public.get_user_team_member_id(organization_id)
          OR (
            linked_member_id IS NULL 
            AND (
              LOWER(TRIM(assignee)) = LOWER(TRIM((SELECT name FROM public.team_members WHERE id = public.get_user_team_member_id(organization_id))))
              OR LOWER(TRIM(assignee)) = LOWER(TRIM((SELECT email FROM public.team_members WHERE id = public.get_user_team_member_id(organization_id))))
            )
          )
        )
      )
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND (
      public.get_user_data_scope(organization_id) = 'full'
      OR (
        public.get_user_data_scope(organization_id) = 'assigned_only'
        AND (
          linked_member_id = public.get_user_team_member_id(organization_id)
          OR (
            linked_member_id IS NULL 
            AND (
              LOWER(TRIM(assignee)) = LOWER(TRIM((SELECT name FROM public.team_members WHERE id = public.get_user_team_member_id(organization_id))))
              OR LOWER(TRIM(assignee)) = LOWER(TRIM((SELECT email FROM public.team_members WHERE id = public.get_user_team_member_id(organization_id))))
            )
          )
        )
      )
    )
  );

CREATE POLICY "Action items insert policy"
  ON public.action_items FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND public.get_user_data_scope(organization_id) = 'full'
  );

CREATE POLICY "Action items delete policy"
  ON public.action_items FOR DELETE
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
    AND public.get_user_data_scope(organization_id) = 'full'
  );

-- ====================================================================
-- FIELD-LEVEL UPDATE TRIGGER FUNCTION (COMPARING OLD VS NEW)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.enforce_action_item_update_permissions()
RETURNS TRIGGER AS $$
DECLARE
  v_scope TEXT;
BEGIN
  -- Retrieve executing user's data_scope for this task's organization
  v_scope := public.get_user_data_scope(NEW.organization_id);

  -- If user has 'assigned_only' access, forbid changing any column except 'status'
  IF v_scope = 'assigned_only' THEN
    IF (OLD.title IS DISTINCT FROM NEW.title) OR
       (OLD.assignee IS DISTINCT FROM NEW.assignee) OR
       (OLD.priority IS DISTINCT FROM NEW.priority) OR
       (OLD.due_date IS DISTINCT FROM NEW.due_date) OR
       (OLD.meeting_id IS DISTINCT FROM NEW.meeting_id) OR
       (OLD.linked_member_id IS DISTINCT FROM NEW.linked_member_id) OR
       (OLD.unlinked_speaker IS DISTINCT FROM NEW.unlinked_speaker) OR
       (OLD.organization_id IS DISTINCT FROM NEW.organization_id) THEN
      RAISE EXCEPTION 'Access Denied: Restricted users (assigned_only) are only permitted to update task status.'
        USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_action_item_update ON public.action_items;

CREATE TRIGGER trg_enforce_action_item_update
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_action_item_update_permissions();
