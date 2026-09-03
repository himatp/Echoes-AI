-- Migration: Database-Level Defense in Depth for Organization Member Data Scope
-- 1. Alter DEFAULT on organization_members.data_scope to 'assigned_only'
ALTER TABLE public.organization_members 
  ALTER COLUMN data_scope SET DEFAULT 'assigned_only';

-- 2. Update existing non-owner/non-admin members to assigned_only if data_scope is NULL or 'full' (unless explicitly set in team_members)
UPDATE public.organization_members
SET data_scope = 'assigned_only'
WHERE role NOT IN ('owner', 'admin')
  AND (data_scope IS NULL OR data_scope = 'full')
  AND user_id NOT IN (
    SELECT tm.user_id 
    FROM public.team_members tm 
    WHERE tm.user_id IS NOT NULL AND tm.data_scope = 'full'
  );
