import { TeamMember, MeetingGroup } from '@/types';
import { 
  syncTeamMemberToSupabase, deleteTeamMemberFromSupabase, 
  syncMeetingGroupToSupabase, deleteMeetingGroupFromSupabase,
  getActiveOrgId, fetchTeamMembersFromSupabase, fetchMeetingGroupsFromSupabase
} from '@/lib/supabase/client';

const STORAGE_KEY_TEAM_MEMBERS = 'echoes_team_members_v1';
const STORAGE_KEY_MEETING_GROUPS = 'echoes_meeting_groups_v1';

const DEFAULT_SEED_MEMBERS: TeamMember[] = [
  { id: 'tm-1', name: 'Amit', email: 'jodhpuriharsh@gmail.com', role: 'Developer', dataScope: 'assigned_only', createdAt: new Date().toISOString() },
  { id: 'tm-2', name: 'Riya', email: 'riya@workspace.com', role: 'Product Manager', dataScope: 'assigned_only', createdAt: new Date().toISOString() },
  { id: 'tm-3', name: 'Kishan', email: 'kishan@workspace.com', role: 'Backend Lead', dataScope: 'assigned_only', createdAt: new Date().toISOString() },
  { id: 'tm-4', name: 'Neha', email: 'neha@workspace.com', role: 'UI/UX Designer', dataScope: 'assigned_only', createdAt: new Date().toISOString() },
  { id: 'tm-5', name: 'Rahul', email: 'rahul@workspace.com', role: 'QA Engineer', dataScope: 'assigned_only', createdAt: new Date().toISOString() },
];

// Read stored team members filtered by active organization
export function getStoredTeamMembers(): TeamMember[] {
  if (typeof window === 'undefined') return [];
  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEAM_MEMBERS);
    if (raw === null) {
      const seeded = DEFAULT_SEED_MEMBERS.map((m) => ({ ...m, organizationId: activeOrgId }));
      localStorage.setItem(STORAGE_KEY_TEAM_MEMBERS, JSON.stringify(seeded));
      return seeded;
    }
    const allMembers: TeamMember[] = JSON.parse(raw);
    return allMembers.filter((m) => !m.organizationId || m.organizationId === activeOrgId);
  } catch (err) {
    return [];
  }
}

const DEFAULT_SEED_GROUPS: MeetingGroup[] = [
  { id: 'grp-1', name: 'Management group', memberIds: ['tm-1', 'tm-2', 'tm-3'], createdAt: new Date().toISOString() },
  { id: 'grp-2', name: 'Sample Group', memberIds: ['tm-4', 'tm-5'], createdAt: new Date().toISOString() },
];

// Read stored meeting groups filtered by active organization
export function getStoredMeetingGroups(): MeetingGroup[] {
  if (typeof window === 'undefined') return [];
  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEETING_GROUPS);
    if (raw === null) {
      const seeded = DEFAULT_SEED_GROUPS.map((g) => ({ ...g, organizationId: activeOrgId }));
      localStorage.setItem(STORAGE_KEY_MEETING_GROUPS, JSON.stringify(seeded));
      return seeded;
    }
    const allGroups: MeetingGroup[] = JSON.parse(raw);
    return allGroups.filter((g) => !g.organizationId || g.organizationId === activeOrgId);
  } catch (err) {
    return [];
  }
}

// Fetch team members and meeting groups from Supabase DB as absolute Source of Truth
export async function fetchAndHydrateTeamFromSupabase(organizationId?: string): Promise<{ members: TeamMember[]; groups: MeetingGroup[] }> {
  if (typeof window === 'undefined') return { members: [], groups: [] };
  const activeOrgId = organizationId || getActiveOrgId();
  if (!activeOrgId) return { members: [], groups: [] };

  try {
    const remoteMembers = await fetchTeamMembersFromSupabase(activeOrgId);
    const remoteGroups = await fetchMeetingGroupsFromSupabase(activeOrgId);

    // Read stored members and groups safely
    const rawMem = localStorage.getItem(STORAGE_KEY_TEAM_MEMBERS);
    const allStoredMem: TeamMember[] = rawMem ? JSON.parse(rawMem) : [];
    const orgStoredMem = allStoredMem.filter((m) => !m.organizationId || m.organizationId === activeOrgId);
    const mergedMembersMap = new Map<string, TeamMember>();
    orgStoredMem.forEach((m) => mergedMembersMap.set(m.id, { ...m, organizationId: activeOrgId }));
    remoteMembers.forEach((m) => mergedMembersMap.set(m.id, { ...m, organizationId: activeOrgId }));
    const finalMembers = Array.from(mergedMembersMap.values());
    const otherOrgMem = allStoredMem.filter((m) => m.organizationId && m.organizationId !== activeOrgId);
    localStorage.setItem(STORAGE_KEY_TEAM_MEMBERS, JSON.stringify([...finalMembers, ...otherOrgMem]));

    const rawGrp = localStorage.getItem(STORAGE_KEY_MEETING_GROUPS);
    const allStoredGrp: MeetingGroup[] = rawGrp ? JSON.parse(rawGrp) : [];
    const otherOrgGrp = allStoredGrp.filter((g) => g.organizationId !== activeOrgId);
    const updatedGrp = remoteGroups.length > 0 ? [...remoteGroups, ...otherOrgGrp] : [...otherOrgGrp];
    localStorage.setItem(STORAGE_KEY_MEETING_GROUPS, JSON.stringify(updatedGrp));

    return {
      members: getStoredTeamMembers(),
      groups: getStoredMeetingGroups(),
    };
  } catch (err) {
    return {
      members: getStoredTeamMembers(),
      groups: getStoredMeetingGroups(),
    };
  }
}

// Save/Update team member under active organization
export async function saveTeamMember(member: TeamMember): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'SSR Environment' };
  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) return { success: false, error: 'No active organization' };

  const scopedMember: TeamMember = {
    ...member,
    organizationId: member.organizationId || activeOrgId,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEAM_MEMBERS);
    const allMembers: TeamMember[] = raw ? JSON.parse(raw) : [];
    const updated = [scopedMember, ...allMembers.filter((m) => m.id !== scopedMember.id)];
    localStorage.setItem(STORAGE_KEY_TEAM_MEMBERS, JSON.stringify(updated));
    const syncRes = await syncTeamMemberToSupabase(scopedMember, scopedMember.organizationId);
    return syncRes;
  } catch (err: any) {
    console.error('Error saving team member:', err);
    return { success: false, error: err.message };
  }
}

// Delete team member
export async function deleteTeamMember(memberId: string): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'SSR Environment' };
  const activeOrgId = getActiveOrgId();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEAM_MEMBERS);
    const allMembers: TeamMember[] = raw ? JSON.parse(raw) : [];
    const updated = allMembers.filter((m) => m.id !== memberId);
    localStorage.setItem(STORAGE_KEY_TEAM_MEMBERS, JSON.stringify(updated));
    return await deleteTeamMemberFromSupabase(memberId);
  } catch (err: any) {
    console.error('Error deleting team member:', err);
    return { success: false, error: err.message };
  }
}

// Save/Update meeting group under active organization
export async function saveMeetingGroup(group: MeetingGroup): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'SSR Environment' };
  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) return { success: false, error: 'No active organization' };

  const scopedGroup: MeetingGroup = {
    ...group,
    organizationId: group.organizationId || activeOrgId,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEETING_GROUPS);
    const allGroups: MeetingGroup[] = raw ? JSON.parse(raw) : [];
    const updated = [scopedGroup, ...allGroups.filter((g) => g.id !== scopedGroup.id)];
    localStorage.setItem(STORAGE_KEY_MEETING_GROUPS, JSON.stringify(updated));
    const syncRes = await syncMeetingGroupToSupabase(scopedGroup, scopedGroup.organizationId);
    return syncRes;
  } catch (err: any) {
    console.error('Error saving meeting group:', err);
    return { success: false, error: err.message };
  }
}

// Delete meeting group
export async function deleteMeetingGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'SSR Environment' };
  const activeOrgId = getActiveOrgId();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEETING_GROUPS);
    const allGroups: MeetingGroup[] = raw ? JSON.parse(raw) : [];
    const updated = allGroups.filter((g) => g.id !== groupId);
    localStorage.setItem(STORAGE_KEY_MEETING_GROUPS, JSON.stringify(updated));
    return await deleteMeetingGroupFromSupabase(groupId);
  } catch (err: any) {
    console.error('Error deleting meeting group:', err);
    return { success: false, error: err.message };
  }
}

// Clear all demo contacts & demo groups
export function clearDemoTeamData(): void {
  if (typeof window === 'undefined') return;
  try {
    const members = getStoredTeamMembers().filter((m) => !m.isDemo);
    const groups = getStoredMeetingGroups().filter((g) => !g.isDemo);

    localStorage.setItem(STORAGE_KEY_TEAM_MEMBERS, JSON.stringify(members));
    localStorage.setItem(STORAGE_KEY_MEETING_GROUPS, JSON.stringify(groups));
  } catch (err) {
    console.error('Error clearing demo data:', err);
  }
}
