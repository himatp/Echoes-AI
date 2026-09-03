import { createBrowserClient } from '@supabase/ssr';
import { Meeting, ActionItem, TeamMember, MeetingGroup, OrganizationMember } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to get stored active organization ID from localStorage
export function getActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('echoes_active_org_id');
}

// Upload Audio File/Blob to Supabase Storage bucket "meeting-audio"
export async function uploadAudioToSupabaseStorage(
  audioBlob: Blob, 
  filename: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client is not initialized.' };
  }
  try {
    const bucketName = 'meeting-audio';
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `recordings/${Date.now()}-${cleanFilename}`;

    console.log(`[Supabase Storage] Direct browser upload of ${audioBlob.size} bytes to bucket "${bucketName}" (${filePath})...`);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, audioBlob, {
        contentType: audioBlob.type || 'audio/webm',
        upsert: true,
      });

    if (error) {
      console.warn('[Supabase Storage Upload Warning]:', error.message);
      return { 
        success: false, 
        error: `Supabase Storage Upload Error: ${error.message} (Bucket: ${bucketName})` 
      };
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    console.log('[Supabase Storage Success] Public Audio URL:', publicUrlData.publicUrl);
    return { success: true, publicUrl: publicUrlData.publicUrl };
  } catch (err: any) {
    console.error('[Supabase Storage Upload Exception]:', err.message);
    return { success: false, error: `Supabase Storage Upload Exception: ${err.message}` };
  }
}

// Fetch Meetings and Action Items directly from Supabase DB for active organization
export async function fetchMeetingsFromSupabase(organizationId: string): Promise<Meeting[]> {
  if (!supabase || !organizationId) return [];
  try {
    console.log(`[Supabase Remote Fetch] Querying meetings table for organization_id = ${organizationId}...`);
    const { data: mtgRows, error: mtgErr } = await supabase
      .from('meetings')
      .select('*')
      .eq('organization_id', organizationId);

    if (mtgErr) {
      console.warn('[Supabase Remote Fetch Warning] Failed to fetch meetings:', mtgErr.message);
      return [];
    }

    const { data: itemRows, error: itemErr } = await supabase
      .from('action_items')
      .select('*')
      .eq('organization_id', organizationId);

    if (itemErr) {
      console.warn('[Supabase Remote Fetch Warning] Failed to fetch action_items:', itemErr.message);
    }

    const allItems = itemRows || [];

    const meetings: Meeting[] = (mtgRows || []).map((m: any) => {
      const mtgItems: ActionItem[] = allItems
        .filter((i: any) => i.meeting_id === m.id)
        .map((i: any) => ({
          id: i.id,
          meetingId: i.meeting_id,
          organizationId: i.organization_id,
          title: i.title,
          assignee: i.assignee,
          linkedMemberId: i.linked_member_id || undefined,
          unlinkedSpeaker: i.unlinked_speaker || undefined,
          dueDate: i.due_date || new Date().toISOString().split('T')[0],
          priority: i.priority || 'medium',
          status: i.status || 'todo',
          speakerSource: i.speaker_source || undefined,
        }));

      return {
        id: m.id,
        organizationId: m.organization_id,
        title: m.title,
        date: m.date,
        duration: m.duration,
        sentiment: m.sentiment || 'action-oriented',
        summary: m.summary || '',
        keyDecisions: m.key_decisions || [],
        actionItems: mtgItems,
        speakerSegments: m.speaker_segments || [],
        healthScore: m.health_score || { score: 90, talkTimeBalance: 85, decisionDensity: 88, unassignedPenalty: 5, suggestions: [] },
        language: m.language || 'en',
        originalLanguage: m.original_language,
        audioUrl: m.audio_url,
        status: m.status || 'completed',
        attendeeIds: m.attendee_ids || [],
        createdAt: m.created_at,
      };
    });

    console.log(`[Supabase Remote Fetch Success] Retrieved ${meetings.length} meetings from Supabase for org ${organizationId}`);
    return meetings;
  } catch (err: any) {
    console.error('[Supabase fetchMeetings Exception]:', err.message);
    return [];
  }
}

// Fetch Team Members directly from Supabase DB for active organization with fallback for unassigned/legacy members
export async function fetchTeamMembersFromSupabase(organizationId: string): Promise<TeamMember[]> {
  if (!supabase || !organizationId) return [];
  try {
    // 1. Fetch team members matching org OR with null/empty org_id
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .or(`organization_id.eq.${organizationId},organization_id.is.null`);

    let members: TeamMember[] = [];
    if (!error && data) {
      members = data.map((m: any) => ({
        id: m.id,
        organizationId: m.organization_id || organizationId,
        userId: m.user_id || undefined,
        name: m.name,
        email: m.email,
        role: m.role || undefined,
        inviteToken: m.invite_token || undefined,
        dataScope: m.data_scope || 'full',
        createdAt: m.created_at,
      }));
    }

    // 2. Also fetch organization_members to ensure any newly joined teammate via Google Auth is included (excluding Workspace Owner)
    const { data: omData } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId);

    if (omData && omData.length > 0) {
      omData.forEach((om: any) => {
        if (om.role === 'owner') return; // Skip workspace owner duplicate card
        const exists = members.some((m) => m.userId === om.user_id || (om.email && m.email === om.email));
        if (!exists && om.user_id) {
          members.push({
            id: `tm-${om.user_id}`,
            organizationId: organizationId,
            userId: om.user_id,
            name: om.email ? om.email.split('@')[0] : 'Teammate',
            email: om.email || '',
            role: om.role || 'Member',
            dataScope: om.data_scope || 'assigned_only',
            createdAt: om.created_at || new Date().toISOString(),
          });
        }
      });
    }

    // 3. Filter out any legacy dummy "Teammate" owner cards
    return members.filter((m) => m.name !== 'Teammate' && m.role !== 'owner');
  } catch (err) {
    return [];
  }
}

// Fetch single meeting by ID from Supabase DB with its action items
export async function fetchMeetingByIdFromSupabase(meetingId: string): Promise<Meeting | null> {
  if (!supabase || !meetingId) return null;
  try {
    const { data: mtg, error: mtgErr } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .limit(1)
      .maybeSingle();

    if (mtgErr || !mtg) {
      console.warn('[fetchMeetingByIdFromSupabase Warning]:', mtgErr?.message || 'Meeting not found');
      return null;
    }

    // Fetch action items for this meeting
    const { data: tasks } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', meetingId);

    const actionItems: ActionItem[] = (tasks || []).map((i: any) => ({
      id: i.id,
      meetingId: i.meeting_id,
      organizationId: i.organization_id,
      title: i.title,
      assignee: i.assignee,
      priority: i.priority,
      status: i.status,
      dueDate: i.due_date,
      speakerSource: i.speaker_source,
      linkedMemberId: i.linked_member_id,
      unlinkedSpeaker: i.unlinked_speaker,
    }));

    return {
      id: mtg.id,
      organizationId: mtg.organization_id,
      title: mtg.title,
      date: mtg.date,
      duration: mtg.duration,
      sentiment: mtg.sentiment,
      summary: mtg.summary,
      keyDecisions: mtg.key_decisions || [],
      actionItems,
      speakerSegments: mtg.speaker_segments || [],
      healthScore: mtg.health_score || { score: 90, talkTimeBalance: 90, decisionDensity: 90, unassignedPenalty: 0, suggestions: [] },
      language: mtg.language,
      status: mtg.status || 'completed',
      audioUrl: mtg.audio_url,
      attendeeIds: mtg.attendee_ids || [],
      createdAt: mtg.created_at,
    };
  } catch (err: any) {
    console.error('[fetchMeetingByIdFromSupabase Error]:', err.message);
    return null;
  }
}

// Fetch Meeting Groups directly from Supabase DB for active organization
export async function fetchMeetingGroupsFromSupabase(organizationId: string): Promise<MeetingGroup[]> {
  if (!supabase || !organizationId) return [];
  try {
    const { data, error } = await supabase
      .from('meeting_groups')
      .select('*')
      .eq('organization_id', organizationId);

    if (error || !data) return [];
    return data.map((g: any) => ({
      id: g.id,
      organizationId: g.organization_id,
      name: g.name,
      memberIds: g.member_ids || [],
      createdAt: g.created_at,
    }));
  } catch (err) {
    return [];
  }
}

// Sync Meeting to Supabase Remote Tables with Organization Scoping & Fallback
export async function syncMeetingToSupabase(meeting: Meeting, organizationId?: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase client is not initialized' };
  
  const orgId = organizationId || meeting.organizationId || getActiveOrgId();
  if (!orgId) return { success: false, error: 'No active organization ID' };

  try {
    const fullPayload: any = {
      id: meeting.id,
      organization_id: orgId,
      title: meeting.title,
      date: meeting.date,
      duration: meeting.duration,
      sentiment: meeting.sentiment,
      summary: meeting.summary,
      key_decisions: meeting.keyDecisions,
      health_score: meeting.healthScore,
      language: meeting.language,
      original_language: meeting.originalLanguage,
      speaker_segments: meeting.speakerSegments,
      audio_url: meeting.audioUrl || null,
      status: meeting.status || 'uploaded',
      attendee_ids: meeting.attendeeIds || [],
      created_at: meeting.createdAt,
    };

    let { error: mtgErr } = await supabase.from('meetings').upsert(fullPayload);

    // Graceful Fallback: If status, audio_url, or attendee_ids columns are missing in Supabase schema cache
    if (mtgErr && (mtgErr.message.includes('status') || mtgErr.message.includes('audio_url') || mtgErr.message.includes('attendee_ids') || mtgErr.message.includes('schema cache'))) {
      console.warn('[Supabase Fallback] Schema cache missing new columns. Retrying upsert with compatible legacy payload:', mtgErr.message);
      const fallbackPayload = { ...fullPayload };
      delete fallbackPayload.status;
      delete fallbackPayload.audio_url;
      delete fallbackPayload.attendee_ids;

      const fallbackRes = await supabase.from('meetings').upsert(fallbackPayload);
      mtgErr = fallbackRes.error;
    }

    if (mtgErr) {
      console.error('[Supabase Meeting Sync Error]:', mtgErr.message);
      return { success: false, error: mtgErr.message };
    }

    // Sync Action Items
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      const itemsPayload = meeting.actionItems.map((item) => ({
        id: item.id,
        meeting_id: meeting.id,
        organization_id: orgId,
        title: item.title,
        assignee: item.assignee,
        priority: item.priority,
        status: item.status,
        due_date: item.dueDate,
        speaker_source: item.speakerSource,
        linked_member_id: item.linkedMemberId || null,
        unlinked_speaker: item.unlinkedSpeaker || null,
      }));

      let { error: taskErr } = await supabase.from('action_items').upsert(itemsPayload);

      if (taskErr && (taskErr.message.includes('linked_member_id') || taskErr.message.includes('unlinked_speaker'))) {
        console.warn('[Supabase Fallback] Retrying basic action item payload...');
        const basicTasks = meeting.actionItems.map((item) => ({
          id: item.id,
          meeting_id: meeting.id,
          organization_id: orgId,
          title: item.title,
          assignee: item.assignee,
          priority: item.priority,
          status: item.status,
          due_date: item.dueDate,
          speaker_source: item.speakerSource,
        }));
        const fallbackTaskRes = await supabase.from('action_items').upsert(basicTasks);
        taskErr = fallbackTaskRes.error;
      }

      if (taskErr) {
        console.warn('[Supabase Task Sync Warning]:', taskErr.message);
      }
    }

    console.log(`[Supabase Sync Success] Meeting ${meeting.id} persisted under org ${orgId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Sync Error]:', err.message);
    return { success: false, error: err.message };
  }
}

// Sync Team Member to Supabase
export async function syncTeamMemberToSupabase(member: TeamMember, organizationId?: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase environment variables not configured' };
  const orgId = organizationId || member.organizationId || getActiveOrgId();
  if (!orgId) return { success: false, error: 'No active organization ID' };
  
  try {
    const payload: any = {
      id: member.id,
      organization_id: orgId,
      name: member.name,
      email: member.email,
      role: member.role || null,
      data_scope: member.dataScope || 'assigned_only',
      created_at: member.createdAt,
    };
    if (member.userId) payload.user_id = member.userId;
    if (member.inviteToken) payload.invite_token = member.inviteToken;

    console.log(`[Supabase API Call] Calling team_members.upsert() for member "${member.name}" in org ${orgId}...`);
    const { data, error } = await supabase.from('team_members').upsert(payload).select();

    if (error) {
      console.error('[Supabase Error Response] team_members upsert failed:', error);
      return { success: false, error: `[Supabase Table Error] ${error.message}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Team Member Exception]:', err.message);
    return { success: false, error: err.message };
  }
}

// Delete Team Member from Supabase
export async function deleteTeamMemberFromSupabase(memberId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase client unavailable' };
  try {
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) {
      console.error('[Supabase Team Member Delete Error]:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Sync Meeting Group to Supabase
export async function syncMeetingGroupToSupabase(group: MeetingGroup, organizationId?: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase environment variables not configured' };
  const orgId = organizationId || group.organizationId || getActiveOrgId();
  if (!orgId) return { success: false, error: 'No active organization ID' };

  try {
    const payload = {
      id: group.id,
      organization_id: orgId,
      name: group.name,
      member_ids: group.memberIds,
      created_at: group.createdAt,
    };

    console.log(`[Supabase API Call] Calling meeting_groups.upsert() for group "${group.name}" in org ${orgId}...`);
    const { data, error } = await supabase.from('meeting_groups').upsert(payload).select();

    if (error) {
      console.error('[Supabase Error Response] meeting_groups upsert failed:', error);
      return { success: false, error: `[Supabase Table Error] ${error.message}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Meeting Group Exception]:', err.message);
    return { success: false, error: err.message };
  }
}

// Delete Meeting Group from Supabase
export async function deleteMeetingGroupFromSupabase(groupId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase client unavailable' };
  try {
    const { error } = await supabase.from('meeting_groups').delete().eq('id', groupId);
    if (error) {
      console.warn('[Supabase Meeting Group Delete Warning]:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Meeting Group Delete Error]:', err.message);
    return { success: false, error: err.message };
  }
}

// Sync Task Status Update to Supabase with 42501 Error Handling
export async function syncTaskStatusToSupabase(taskId: string, newStatus: ActionItem['status']): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase client is not available' };
  try {
    const { error } = await supabase.from('action_items').update({ status: newStatus }).eq('id', taskId);
    if (error) {
      if (error.code === '42501' || error.message.includes('42501') || error.message.includes('Restricted users')) {
        console.warn('[Supabase RLS Error 42501]: Restricted users are only permitted to update task status.');
        return { success: false, error: 'Access Denied: You can only update your assigned task status.' };
      }
      console.warn('[Supabase Task Status Sync Warning]:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Task Update Error]:', err.message);
    return { success: false, error: err.message };
  }
}

// Fetch Organization Members with data_scope from Supabase
export async function fetchOrganizationMembersFromSupabase(organizationId: string): Promise<any[]> {
  if (!supabase || !organizationId) return [];
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('id, organization_id, user_id, role, data_scope, created_at')
      .eq('organization_id', organizationId);

    if (error || !data) return [];
    return data.map((m: any) => ({
      id: m.id,
      organizationId: m.organization_id,
      userId: m.user_id,
      role: m.role,
      dataScope: m.data_scope || (m.role === 'owner' || m.role === 'admin' ? 'full' : 'assigned_only'),
      createdAt: m.created_at,
    }));
  } catch (err) {
    return [];
  }
}

// Update Team Member & Organization Member Data Scope in Supabase
export async function updateTeamMemberDataScope(
  teamMemberId: string,
  dataScope: 'full' | 'assigned_only',
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase client is not available' };
  try {
    // 1. Update team_members data_scope
    const { error: tmErr } = await supabase
      .from('team_members')
      .update({ data_scope: dataScope })
      .eq('id', teamMemberId);

    if (tmErr) {
      console.error('[Supabase Update team_members DataScope Error]:', tmErr.message);
      return { success: false, error: tmErr.message };
    }

    // 2. If user_id exists, update organization_members data_scope as well
    if (userId) {
      const { error: omErr } = await supabase
        .from('organization_members')
        .update({ data_scope: dataScope })
        .eq('user_id', userId);

      if (omErr) {
        console.warn('[Supabase Update organization_members Warning]:', omErr.message);
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Update Organization Member Data Scope in Supabase
export async function updateOrganizationMemberDataScope(
  memberId: string, 
  dataScope: 'full' | 'assigned_only'
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase client is not available' };
  try {
    const { error } = await supabase
      .from('organization_members')
      .update({ data_scope: dataScope })
      .eq('id', memberId);

    if (error) {
      console.error('[Supabase Update DataScope Error]:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Accept Per-Person Invite Token via RPC (Binds user_id to team_members directly)
export async function acceptPerPersonInviteToken(token: string): Promise<{ success: boolean; organizationMember?: any; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase client is not available' };
  try {
    const { data, error } = await supabase.rpc('accept_person_invite', { p_token: token.trim() });
    if (error) {
      console.error('[Supabase Accept Person Invite Error]:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, organizationMember: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Delete Meeting and associated action items from Supabase database tables
export async function deleteMeetingFromSupabase(meetingId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    await supabase.from('action_items').delete().eq('meeting_id', meetingId);
    const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
    if (error) {
      console.warn('[Supabase Delete Warning]:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[Supabase Delete Error]:', err.message);
    return false;
  }
}

// Fetch Personal Member Workspace Data for Restricted Portal View
export async function fetchPersonalMemberWorkspaceData(
  userId: string, 
  targetOrgId?: string,
  userEmail?: string
): Promise<{
  teamMember?: TeamMember;
  organizationMember?: OrganizationMember;
  meetings: Meeting[];
  actionItems: ActionItem[];
  dataScope: 'full' | 'assigned_only';
  accessRevoked?: boolean;
}> {
  if (!supabase || !userId) {
    return { meetings: [], actionItems: [], dataScope: 'assigned_only', accessRevoked: false };
  }

  const activeOrgId = targetOrgId || getActiveOrgId();

  try {
    // Get user email from parameter or Auth user if available
    let currentUserEmail = userEmail;
    if (!currentUserEmail && supabase) {
      const { data: authData } = await supabase.auth.getUser();
      currentUserEmail = authData?.user?.email || undefined;
    }
    const cleanEmail = (currentUserEmail || '').trim().toLowerCase();

    // 1. Fetch organization member specifically for activeOrgId
    let omQuery = supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', userId);

    if (activeOrgId) {
      omQuery = omQuery.eq('organization_id', activeOrgId);
    }

    const { data: omRows } = await omQuery.limit(1);
    const omData = omRows && omRows.length > 0 ? omRows[0] : null;

    const isOwnerOrAdmin = omData?.role === 'owner' || omData?.role === 'admin';
    const orgId = activeOrgId || omData?.organization_id;

    // 2. Fetch linked team_member record specifically for activeOrgId
    let tmQuery = supabase
      .from('team_members')
      .select('*');

    if (cleanEmail) {
      tmQuery = tmQuery.or(`user_id.eq.${userId},email.eq.${cleanEmail}`);
    } else {
      tmQuery = tmQuery.eq('user_id', userId);
    }

    if (orgId) {
      tmQuery = tmQuery.eq('organization_id', orgId);
    }

    const { data: tmRows } = await tmQuery.limit(1);
    const tmData = tmRows && tmRows.length > 0 ? tmRows[0] : null;

    // Auto-link user_id on team_members if matched by email
    if (tmData && !tmData.user_id && userId) {
      console.log(`[fetchPersonalMemberWorkspaceData] Auto-linking user_id ${userId} to team_members record ${tmData.id} (${tmData.email})...`);
      await supabase.from('team_members').update({ user_id: userId }).eq('id', tmData.id);
      tmData.user_id = userId;
    }

    // Auto-sync organization_members data_scope to tmData.data_scope if tmData exists
    if (tmData && tmData.data_scope && !isOwnerOrAdmin) {
      if (omData && omData.data_scope !== tmData.data_scope) {
        console.log(`[fetchPersonalMemberWorkspaceData] Syncing organization_members.data_scope for user ${userId} to ${tmData.data_scope}...`);
        await supabase.from('organization_members').update({ data_scope: tmData.data_scope }).eq('id', omData.id);
        omData.data_scope = tmData.data_scope;
      }
    }

    const effectiveDataScope: 'full' | 'assigned_only' = isOwnerOrAdmin
      ? 'full'
      : (tmData?.data_scope || omData?.data_scope || 'assigned_only');

    const isAccessRevoked = !omData && !tmData;

    const teamMember: TeamMember | undefined = tmData ? {
      id: tmData.id,
      organizationId: tmData.organization_id,
      name: tmData.name,
      email: tmData.email,
      role: tmData.role,
      dataScope: tmData.data_scope || 'assigned_only',
      inviteToken: tmData.invite_token,
      userId: tmData.user_id,
      createdAt: tmData.created_at,
    } : undefined;

    const memberName = teamMember?.name || omData?.name || '';
    const memberId = teamMember?.id || '';
    const memberEmail = teamMember?.email || cleanEmail || '';

    // 3. Fetch meetings for this organization
    let meetings: Meeting[] = [];
    if (orgId) {
      const { data: mtgData } = await supabase
        .from('meetings')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (mtgData) {
        meetings = mtgData
          .map((m: any) => ({
            id: m.id,
            organizationId: m.organization_id,
            title: m.title,
            date: m.date,
            duration: m.duration,
            sentiment: m.sentiment,
            summary: m.summary,
            keyDecisions: m.key_decisions || [],
            actionItems: [],
            speakerSegments: m.speaker_segments || [],
            healthScore: m.health_score || { score: 90, talkTimeBalance: 90, decisionDensity: 90, unassignedPenalty: 0, suggestions: [] },
            language: m.language,
            status: m.status || 'completed',
            audioUrl: m.audio_url,
            attendeeIds: m.attendee_ids || [],
            createdAt: m.created_at,
          }))
          .filter((m: Meeting) => {
            if (effectiveDataScope === 'full') return true;
            // Filter by attendee_ids OR matching speaker name in speakerSegments
            const isAttendee = memberId && m.attendeeIds?.includes(memberId);
            const isSpeaker = memberName && m.speakerSegments?.some((s) => s.speaker?.toLowerCase().includes(memberName.toLowerCase()));
            return isAttendee || isSpeaker;
          });
      }
    }

    // 4. Fetch action items assigned to this member
    let actionItems: ActionItem[] = [];
    if (orgId) {
      let query = supabase.from('action_items').select('*').eq('organization_id', orgId);
      const { data: itemData } = await query;

      if (itemData) {
        actionItems = itemData
          .map((i: any) => ({
            id: i.id,
            meetingId: i.meeting_id,
            organizationId: i.organization_id,
            title: i.title,
            assignee: i.assignee,
            priority: i.priority,
            status: i.status,
            dueDate: i.due_date,
            speakerSource: i.speaker_source,
            linkedMemberId: i.linked_member_id,
            unlinkedSpeaker: i.unlinked_speaker,
          }))
          .filter((i: ActionItem) => {
            if (effectiveDataScope === 'full') return true;
            const isLinked = memberId && i.linkedMemberId === memberId;
            const isNameMatch = memberName && (
              i.assignee?.toLowerCase() === memberName.toLowerCase() ||
              i.unlinkedSpeaker?.toLowerCase() === memberName.toLowerCase()
            );
            const isEmailMatch = userEmail && (
              i.assignee?.toLowerCase() === userEmail.toLowerCase()
            );
            return isLinked || isNameMatch || isEmailMatch;
          });
      }
    }

    return {
      teamMember,
      organizationMember: omData ? {
        id: omData.id,
        organizationId: omData.organization_id,
        userId: omData.user_id,
        role: omData.role,
        dataScope: omData.data_scope || 'assigned_only',
        createdAt: omData.created_at,
      } : undefined,
      meetings,
      actionItems,
      dataScope: effectiveDataScope,
      accessRevoked: isAccessRevoked,
    };
  } catch (err) {
    console.error('[fetchPersonalMemberWorkspaceData Error]:', err);
    return { meetings: [], actionItems: [], dataScope: 'assigned_only', accessRevoked: false };
  }
}

// Revoke Teammate Access & Delete Invite Token from Supabase
export async function revokeTeammateAccessFromSupabase(
  teamMemberId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase client is not available' };
  try {
    // 1. Delete team_members record
    const { error: tmErr } = await supabase
      .from('team_members')
      .delete()
      .eq('id', teamMemberId);

    if (tmErr) {
      console.error('[Supabase Delete team_members Error]:', tmErr.message);
      return { success: false, error: tmErr.message };
    }

    // 2. If user_id is bound, delete organization_members record to cut off workspace access
    if (userId) {
      const { error: omErr } = await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', userId);

      if (omErr) {
        console.warn('[Supabase Delete organization_members Warning]:', omErr.message);
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Join Organization by Code from Supabase
export async function joinOrganizationByCodeFromSupabase(
  inviteCode: string,
  userId: string
): Promise<{ success: boolean; organizationId?: string; orgName?: string; error?: string; diagnosticDetails?: string }> {
  if (!supabase || !inviteCode || !userId) {
    return { 
      success: false, 
      error: 'Missing parameters or Supabase client unavailable.',
      diagnosticDetails: `Client State: Supabase=${!!supabase}, inviteCode=${inviteCode}, userId=${userId}`
    };
  }

  const rawCode = inviteCode.trim();
  const cleanSearch = rawCode.toLowerCase().replace(/-/g, '');

  try {
    // 1. First try RPC join_organization_with_code (bypasses RLS SELECT filters)
    const { data: rpcData, error: rpcErr } = await supabase.rpc('join_organization_with_code', {
      p_invite_code: rawCode,
    });

    if (!rpcErr) {
      console.log('[joinOrganizationByCodeFromSupabase] RPC succeeded:', rpcData);
      return { success: true, organizationId: rpcData?.id || rpcData, orgName: rpcData?.name || 'Workspace' };
    }

    console.warn('[joinOrganizationByCodeFromSupabase] RPC join_organization_with_code returned:', rpcErr.message);

    // 2. Fallback: Query organizations table
    const { data: orgs, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name, invite_code');

    if (orgErr) {
      return { 
        success: false, 
        error: `Database RLS Restriction: ${orgErr.message}`,
        diagnosticDetails: `Query: organizations.select. RLS Error: ${orgErr.message} (Code: ${orgErr.code})`
      };
    }

    if (!orgs || orgs.length === 0) {
      return { 
        success: false, 
        error: `No accessible workspaces found. RLS policy restricted view.`,
        diagnosticDetails: `Query returned 0 rows. RLS Policy active on organizations table for user ${userId}.`
      };
    }

    const matchedOrg = orgs.find((o) => {
      const orgIdClean = o.id.toLowerCase().replace(/-/g, '');
      const inviteClean = o.invite_code ? o.invite_code.toLowerCase().replace(/-/g, '') : '';
      return (
        orgIdClean.startsWith(cleanSearch) ||
        (inviteClean && inviteClean.startsWith(cleanSearch)) ||
        o.id.toLowerCase() === rawCode.toLowerCase() ||
        (o.invite_code && o.invite_code.toLowerCase() === rawCode.toLowerCase())
      );
    });

    if (!matchedOrg) {
      const availableCodes = orgs.map(o => `${o.name} (${o.id.slice(0, 10)})`).join(', ');
      return { 
        success: false, 
        error: `No workspace found matching code "${rawCode}".`,
        diagnosticDetails: `Searched for "${cleanSearch}". Visible Orgs: ${availableCodes || 'None (RLS Hidden)'}. RPC error: ${rpcErr.message}`
      };
    }

    // 3. Insert organization_member row
    const { error: insErr } = await supabase.from('organization_members').insert({
      organization_id: matchedOrg.id,
      user_id: userId,
      role: 'member',
      data_scope: 'assigned_only',
    });

    if (insErr && !insErr.message.includes('duplicate')) {
      return { 
        success: false, 
        error: `Failed to insert membership: ${insErr.message}`,
        diagnosticDetails: `insert into organization_members failed: ${insErr.message}`
      };
    }

    // 4. Link team_members entry if present
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.email) {
      await supabase
        .from('team_members')
        .update({ user_id: userId })
        .or(`email.eq.${userData.user.email},invite_token.eq.${rawCode}`)
        .eq('organization_id', matchedOrg.id);
    }

    return { success: true, organizationId: matchedOrg.id, orgName: matchedOrg.name };
  } catch (err: any) {
    return { 
      success: false, 
      error: err.message || 'An unexpected exception occurred.',
      diagnosticDetails: `Exception caught: ${err.toString()}`
    };
  }
}

// Leave Organization from Supabase
export async function leaveOrganizationFromSupabase(
  organizationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !organizationId || !userId) return { success: false, error: 'Missing parameters or Supabase unavailable' };

  try {
    const { error: delErr } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', userId);

    if (delErr) {
      console.error('[leaveOrganizationFromSupabase Error]:', delErr.message);
      return { success: false, error: delErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Delete Organization from Supabase
export async function deleteOrganizationFromSupabase(
  organizationId: string,
  userId: string
): Promise<{ success: boolean; error?: string; diagnosticDetails?: string }> {
  console.group('%c[Workspace Deletion] Server Endpoint Trace', 'color: #8B5CF6; font-weight: bold; font-size: 13px;');
  console.log(`🔍 Target Organization ID: "${organizationId}"`);
  console.log(`👤 Requesting User ID: "${userId}"`);

  if (!organizationId || !userId) {
    console.error('❌ Missing parameters.');
    console.groupEnd();
    return { success: false, error: 'Missing parameters' };
  }

  try {
    // 1. Invoke Server Endpoint /api/organizations/delete
    console.log('📌 Invoking /api/organizations/delete endpoint...');
    const apiRes = await fetch('/api/organizations/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    });

    const apiJson = await apiRes.json();
    console.log('📊 Server API Response:', apiJson);

    if (!apiRes.ok || !apiJson.success) {
      console.error('❌ Workspace deletion server RPC verification failed:', apiJson);
      console.groupEnd();
      return {
        success: false,
        error: apiJson.error || 'Server error during workspace deletion',
        diagnosticDetails: apiJson.details || apiJson.error || `HTTP ${apiRes.status}`,
      };
    }

    // 2. Clear local storage caches upon verified deletion
    try {
      const cachedOrgs = localStorage.getItem('user_organizations');
      if (cachedOrgs) {
        const parsed = JSON.parse(cachedOrgs);
        const filtered = parsed.filter((o: any) => o.id !== organizationId);
        localStorage.setItem('user_organizations', JSON.stringify(filtered));
      }
      const activeOrgId = localStorage.getItem('echoes_active_org_id');
      if (activeOrgId === organizationId) {
        localStorage.removeItem('echoes_active_org_id');
      }
    } catch (e) {}

    console.log('✅ Workspace deletion verified and cleared.');
    console.groupEnd();

    return {
      success: true,
      diagnosticDetails: apiJson.message || 'Workspace record purged & verified from Supabase DB.',
    };
  } catch (err: any) {
    console.error('💥 Exception caught during workspace deletion:', err);
    console.groupEnd();
    return {
      success: false,
      error: err.message || 'Exception during workspace deletion request.',
      diagnosticDetails: err.toString(),
    };
  }
}

