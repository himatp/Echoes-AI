import { createBrowserClient } from '@supabase/ssr';
import { Meeting, ActionItem, TeamMember, MeetingGroup } from '@/types';

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

// Fetch Team Members directly from Supabase DB for active organization
export async function fetchTeamMembersFromSupabase(organizationId: string): Promise<TeamMember[]> {
  if (!supabase || !organizationId) return [];
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('organization_id', organizationId);

    if (error || !data) return [];
    return data.map((m: any) => ({
      id: m.id,
      organizationId: m.organization_id,
      userId: m.user_id || undefined,
      name: m.name,
      email: m.email,
      role: m.role || undefined,
      inviteToken: m.invite_token || undefined,
      dataScope: m.data_scope || 'full',
      createdAt: m.created_at,
    }));
  } catch (err) {
    return [];
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
      data_scope: member.dataScope || 'full',
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
      dataScope: m.data_scope || 'full',
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
