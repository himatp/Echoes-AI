export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed';

export type DataScope = 'full' | 'assigned_only';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  role?: 'owner' | 'admin' | 'member';
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  dataScope?: DataScope;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  organizationId?: string;
  userId?: string;
  name: string;
  email: string;
  role?: string;
  inviteToken?: string;
  dataScope?: DataScope;
  isDemo?: boolean;
  createdAt: string;
}

export interface MeetingGroup {
  id: string;
  organizationId?: string;
  name: string;
  memberIds: string[];
  isDemo?: boolean;
  createdAt: string;
}

export interface SpeakerSegment {
  id: string;
  speaker: string; // e.g. "Sarah Chen", "Alex Kumar", "Speaker 1"
  timestamp: string; // e.g. "01:24"
  text: string;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  organizationId?: string;
  title: string;
  assignee: string; // e.g. "Alex Kumar" (static snapshot)
  assigneeAvatar?: string;
  linkedMemberId?: string;
  unlinkedSpeaker?: string;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  isCarriedOver?: boolean;
  speakerSource?: string;
}

export interface MeetingHealthScore {
  score: number; // 0 - 100
  talkTimeBalance: number; // 0 - 100
  decisionDensity: number; // 0 - 100
  unassignedPenalty: number;
  suggestions: string[];
}

export type MeetingStatus = 'uploaded' | 'transcribed' | 'draft' | 'completed';

export interface Meeting {
  id: string;
  organizationId?: string;
  title: string;
  date: string;
  duration: string; // e.g. "34 min"
  sentiment: 'positive' | 'neutral' | 'action-oriented' | 'critical';
  summary: string;
  keyDecisions: string[];
  actionItems: ActionItem[];
  speakerSegments: SpeakerSegment[];
  healthScore: MeetingHealthScore;
  language: string; // e.g. "en", "gu", "hi"
  originalLanguage?: string;
  audioUrl?: string;
  attendeeIds?: string[];
  status?: MeetingStatus;
  createdAt: string;
}
