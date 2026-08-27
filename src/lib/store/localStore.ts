import { Meeting, ActionItem } from '@/types';
import { 
  syncMeetingToSupabase, syncTaskStatusToSupabase, deleteMeetingFromSupabase, 
  getActiveOrgId, fetchMeetingsFromSupabase 
} from '@/lib/supabase/client';
import { calculateMeetingHealthScore } from '@/lib/scoring/healthScoreEngine';

const STORAGE_KEY_MEETINGS = 'echoes_meetings_v1';
const LEGACY_STORAGE_KEY = 'nexus_flow_meetings_v1';

export function getStoredMeetings(): Meeting[] {
  if (typeof window === 'undefined') return [];
  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) return [];

  try {
    let data = localStorage.getItem(STORAGE_KEY_MEETINGS);
    if (!data) {
      data = localStorage.getItem(LEGACY_STORAGE_KEY);
    }
    if (!data) {
      return [];
    }
    const parsed: Meeting[] = JSON.parse(data);

    // Filter meetings belonging to active organization
    const orgMeetings = parsed.filter((m) => {
      return m.organizationId === activeOrgId;
    });

    // Re-calculate dynamic health score for org meetings
    return orgMeetings.map((m) => ({
      ...m,
      healthScore: calculateMeetingHealthScore(m),
    }));
  } catch (err) {
    console.error('Error reading meetings from local storage:', err);
    return [];
  }
}

// Fetch meetings from Supabase DB as absolute Source of Truth for active organization
export async function fetchAndHydrateMeetingsFromSupabase(organizationId?: string): Promise<Meeting[]> {
  if (typeof window === 'undefined') return [];
  const activeOrgId = organizationId || getActiveOrgId();
  if (!activeOrgId) return [];

  try {
    const remoteMeetings = await fetchMeetingsFromSupabase(activeOrgId);
    console.log(`[Hydration] Supabase fetched ${remoteMeetings.length} meetings for org ${activeOrgId}`);

    // Read all existing local meetings
    const raw = localStorage.getItem(STORAGE_KEY_MEETINGS);
    const allStored: Meeting[] = raw ? JSON.parse(raw) : [];

    // Keep meetings belonging to OTHER organizations intact in local storage cache
    const otherOrgMeetings = allStored.filter((m) => {
      return m.organizationId !== activeOrgId;
    });

    const updatedList: Meeting[] = [...remoteMeetings, ...otherOrgMeetings];
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(updatedList));

    // Return meetings specifically for active organization
    return getStoredMeetings();
  } catch (err) {
    console.error('[Hydration Exception]:', err);
    return getStoredMeetings();
  }
}

export function getMeetingById(id: string): Meeting | undefined {
  const meetings = getStoredMeetings();
  return meetings.find((m) => m.id === id);
}

export function saveMeeting(meeting: Meeting): void {
  if (typeof window === 'undefined') return;
  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) return;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEETINGS);
    const existingMeetings: Meeting[] = raw ? JSON.parse(raw) : [];
    const existingMtg = existingMeetings.find((m) => m.id === meeting.id);

    const scopedMeeting: Meeting = {
      ...meeting,
      organizationId: meeting.organizationId || activeOrgId,
      createdAt: existingMtg ? existingMtg.createdAt : (meeting.createdAt || new Date().toISOString()),
      healthScore: calculateMeetingHealthScore(meeting),
      actionItems: (meeting.actionItems || []).map((item) => ({
        ...item,
        organizationId: item.organizationId || meeting.organizationId || activeOrgId,
      })),
    };

    const updated = [scopedMeeting, ...existingMeetings.filter((m) => m.id !== meeting.id)];
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(updated));
    
    // Wire real Supabase Table persistence
    syncMeetingToSupabase(scopedMeeting, scopedMeeting.organizationId);
  } catch (err) {
    console.error('Error saving meeting to local storage:', err);
  }
}

export function getStoredTasks(): ActionItem[] {
  const meetings = getStoredMeetings();
  return meetings.flatMap((m) => m.actionItems || []);
}

export function updateTaskStatus(taskId: string, newStatus: ActionItem['status']): void {
  if (typeof window === 'undefined') return;
  const activeOrgId = getActiveOrgId();
  const raw = localStorage.getItem(STORAGE_KEY_MEETINGS);
  const existingMeetings: Meeting[] = raw ? JSON.parse(raw) : [];
  let updated = false;

  const newMeetings = existingMeetings.map((meeting) => {
    const taskIndex = (meeting.actionItems || []).findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      updated = true;
      const newItems = [...meeting.actionItems];
      newItems[taskIndex] = { ...newItems[taskIndex], status: newStatus };
      
      const updatedMtg = { ...meeting, actionItems: newItems };
      return {
        ...updatedMtg,
        healthScore: calculateMeetingHealthScore(updatedMtg),
      };
    }
    return meeting;
  });

  if (updated) {
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(newMeetings));
    syncTaskStatusToSupabase(taskId, newStatus);
  }
}

export function addTaskToMeeting(meetingId: string, task: ActionItem): void {
  if (typeof window === 'undefined') return;
  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) return;

  const meetings = getStoredMeetings();
  const targetMeeting = meetings.find((m) => m.id === meetingId) || meetings[0];
  
  if (targetMeeting) {
    const scopedTask: ActionItem = {
      ...task,
      organizationId: task.organizationId || activeOrgId,
    };
    const updatedMeeting = {
      ...targetMeeting,
      actionItems: [scopedTask, ...(targetMeeting.actionItems || [])],
    };
    saveMeeting(updatedMeeting);
  }
}

export function deleteMeeting(meetingId: string): void {
  if (typeof window === 'undefined') return;
  const activeOrgId = getActiveOrgId();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEETINGS);
    const existingMeetings: Meeting[] = raw ? JSON.parse(raw) : [];
    const updated = existingMeetings.filter((m) => m.id !== meetingId);
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(updated));
    deleteMeetingFromSupabase(meetingId);
  } catch (err) {
    console.error('Error deleting meeting from local storage:', err);
  }
}
