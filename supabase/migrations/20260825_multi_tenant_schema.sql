-- ====================================================================
-- ECHOES MULTI-TENANT DATABASE MIGRATION & ROW LEVEL SECURITY (RLS)
-- Stage 1: Tables, SECURITY DEFINER Functions, RLS Policies, Legacy Backfill
-- ====================================================================

-- 1. Create Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text || clock_timestamp()::text) from 1 for 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Organization Members Table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- 3. Add organization_id column to existing data tables
ALTER TABLE public.meetings 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.action_items 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.meeting_groups 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 4. Create Legacy/Demo Organization for existing un-scoped data
INSERT INTO public.organizations (id, name, slug, invite_code)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Legacy Demo Organization',
  'legacy-demo-org',
  'DEMO123456'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Backfill existing un-scoped records
UPDATE public.meetings SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.action_items SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.team_members SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.meeting_groups SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;


-- ====================================================================
-- SECURITY DEFINER HELPER & ACTION FUNCTIONS
-- ====================================================================

-- Helper Function: Returns array of organization IDs the current auth user belongs to
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id 
  FROM public.organization_members 
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Function 1: Atomic Organization Creation (Creates org & sets user as Owner)
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_name TEXT,
  p_slug TEXT
)
RETURNS public.organizations AS $$
DECLARE
  v_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to create an organization.';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (p_name, p_slug)
  RETURNING * INTO v_org;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org.id, auth.uid(), 'owner');

  RETURN v_org;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function 2: Secure Invite-Code Joining (Validates invite code server-side)
CREATE OR REPLACE FUNCTION public.join_organization_with_code(
  p_invite_code TEXT
)
RETURNS public.organizations AS $$
DECLARE
  v_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to join an organization.';
  END IF;

  SELECT * INTO v_org
  FROM public.organizations
  WHERE invite_code = trim(p_invite_code);

  IF v_org.id IS NULL THEN
    RAISE EXCEPTION 'Invalid organization invite code.';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org.id, auth.uid(), 'member')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN v_org;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function 3: Legacy Demo Org Claiming (Ensures existing data remains accessible to authenticated user)
CREATE OR REPLACE FUNCTION public.claim_legacy_demo_org()
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES ('00000000-0000-0000-0000-000000000000', auth.uid(), 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on all public tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_groups ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can view co-members in their org" ON public.organization_members;
DROP POLICY IF EXISTS "Meetings isolation policy" ON public.meetings;
DROP POLICY IF EXISTS "Action items isolation policy" ON public.action_items;
DROP POLICY IF EXISTS "Team members isolation policy" ON public.team_members;
DROP POLICY IF EXISTS "Meeting groups isolation policy" ON public.meeting_groups;

-- 1. Organizations Policies
CREATE POLICY "Users can view their organizations"
  ON public.organizations FOR SELECT
  USING (id IN (SELECT public.get_user_organization_ids()));

-- 2. Organization Members Policies (SELECT restricted to org teammates, INSERT prohibited directly)
CREATE POLICY "Members can view co-members in their org"
  ON public.organization_members FOR SELECT
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- 3. Business Data Policies (meetings, action_items, team_members, meeting_groups)
CREATE POLICY "Meetings isolation policy"
  ON public.meetings FOR ALL
  USING (organization_id IN (SELECT public.get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Action items isolation policy"
  ON public.action_items FOR ALL
  USING (organization_id IN (SELECT public.get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Team members isolation policy"
  ON public.team_members FOR ALL
  USING (organization_id IN (SELECT public.get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "Meeting groups isolation policy"
  ON public.meeting_groups FOR ALL
  USING (organization_id IN (SELECT public.get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));
