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
export async function uploadAudioToSupabaseStorage(audioBlob: Blob, filename: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const bucketName = 'meeting-audio';
    const filePath = `recordings/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    console.log(`[Supabase Storage] Uploading ${audioBlob.size} bytes audio payload to bucket "${bucketName}" (${filePath})...`);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, audioBlob, {
        contentType: audioBlob.type || 'audio/webm',
        upsert: true,
      });

    if (error) {
      console.warn('[Supabase Storage Upload Warning]:', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    console.log('[Supabase Storage Success] Public Audio URL:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.error('[Supabase Storage Upload Exception]:', err.message);
    return null;
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
      name: m.name,
      email: m.email,
      role: m.role || undefined,
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
      attendee_ids: meeting.attendeeIds || [],
      created_at: meeting.createdAt,
    };

    let { error: mtgErr } = await supabase.from('meetings').upsert(fullPayload);

    // Graceful Fallback: If attendee_ids column is missing in Supabase table, retry without attendee_ids
    if (mtgErr && mtgErr.message.includes('attendee_ids')) {
      console.warn('[Supabase Fallback] "attendee_ids" column missing on meetings. Retrying upsert without attendee_ids...');
      const { attendee_ids, ...legacyPayload } = fullPayload;
      const fallbackRes = await supabase.from('meetings').upsert(legacyPayload);
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
    const payload = {
      id: member.id,
      organization_id: orgId,
      name: member.name,
      email: member.email,
      role: member.role || null,
      created_at: member.createdAt,
    };

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

// Sync Task Status Update to Supabase
export async function syncTaskStatusToSupabase(taskId: string, newStatus: ActionItem['status']): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('action_items').update({ status: newStatus }).eq('id', taskId);
    if (error) {
      console.warn('[Supabase Task Status Sync Warning]:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[Supabase Task Update Error]:', err.message);
    return false;
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
