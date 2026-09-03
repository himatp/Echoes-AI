"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PillBadge } from '@/components/ui/PillBadge';
import { getMeetingById, updateTaskStatus, deleteMeeting, saveMeeting, updateMeetingStatus } from '@/lib/store/localStore';
import { getStoredTeamMembers } from '@/lib/store/teamStore';
import { Meeting, ActionItem, SpeakerSegment, TeamMember } from '@/types';
import { 
  ArrowLeft, ArrowRight, Calendar, Clock, UserCheck, Play, Pause, 
  Volume2, FastForward, Rewind, Sparkles, Mail, FileText, Video,
  CheckCircle2, Activity, Download, Send, RefreshCw, AlertTriangle, CalendarPlus, ExternalLink, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { safeParseJsonResponse } from '@/lib/api/safeFetch';
import { syncTaskStatusToSupabase, fetchMeetingByIdFromSupabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

export default function MeetingDetailPage() {
  const { activeOrg, userOrgs } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const meetingId = (params?.id as string) || 'demo-1';

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedLinkingTaskId, setSelectedLinkingTaskId] = useState<string | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setTeamMembers(getStoredTeamMembers());
  }, []);

  const handleLinkContactToTask = (taskId: string, member: TeamMember) => {
    if (!meeting) return;
    const updatedItems = meeting.actionItems.map((item) => {
      if (item.id === taskId) {
        return {
          ...item,
          assignee: member.name,
          linkedMemberId: member.id,
          unlinkedSpeaker: undefined,
        };
      }
      return item;
    });

    const updatedMeeting = { ...meeting, actionItems: updatedItems };
    saveMeeting(updatedMeeting);
    setMeeting(updatedMeeting);
    setIsLinkModalOpen(false);
    setSelectedLinkingTaskId(null);
    showToast(`Task linked to contact ${member.name} (${member.email})`);
  };

  // Calendar & OAuth Alert States
  const [calendarAlert, setCalendarAlert] = useState<string | null>(null);
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);

  // Export & Email States
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('delivered@resend.dev');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [durationSec, setDurationSec] = useState<number>(0);

  // Fetch Meeting Data (Local store first, then live Supabase DB fallback)
  useEffect(() => {
    if (meetingId) {
      const data = getMeetingById(meetingId);
      if (data) {
        setMeeting(data);
        if (data.speakerSegments && data.speakerSegments.length > 0) {
          const lastSeg = data.speakerSegments[data.speakerSegments.length - 1];
          const parts = lastSeg.timestamp.split(':');
          if (parts.length === 2) {
            const secs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + 10;
            setDurationSec(secs);
          }
        }
      } else {
        // Fetch from Supabase remote DB directly
        fetchMeetingByIdFromSupabase(meetingId).then((remoteData) => {
          if (remoteData) {
            setMeeting(remoteData);
            if (remoteData.speakerSegments && remoteData.speakerSegments.length > 0) {
              const lastSeg = remoteData.speakerSegments[remoteData.speakerSegments.length - 1];
              const parts = lastSeg.timestamp.split(':');
              if (parts.length === 2) {
                const secs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + 10;
                setDurationSec(secs);
              }
            }
          } else {
            const fallback = getMeetingById('demo-1');
            if (fallback) setMeeting(fallback);
          }
        });
      }
    }
  }, [meetingId]);

  // Check URL Search Params for OAuth Redirect Status & Fallbacks
  useEffect(() => {
    if (searchParams) {
      if (searchParams.get('calendar_connected') === 'true') {
        showToast('Google Calendar OAuth Authorized Successfully!');
      } else if (searchParams.get('calendar_error')) {
        const errType = searchParams.get('calendar_error');
        setCalendarAlert(
          errType === 'access_denied'
            ? 'Google Calendar Authorization Denied by user. Click "Connect Google Calendar" to grant permission when ready.'
            : `Google Calendar OAuth error (${errType}). Please re-authorize.`
        );
      }
    }
  }, [searchParams]);

  // Audio Playback Simulation Timer (Fallback when audioUrl is missing)
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && !meeting?.audioUrl) {
      interval = setInterval(() => {
        setCurrentTimeSec((prev) => {
          if (prev >= durationSec) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, meeting?.audioUrl, durationSec]);

  // Highlight Active Speaker Segment
  useEffect(() => {
    if (meeting && meeting.speakerSegments.length > 0) {
      const totalSec = currentTimeSec;
      let matchedId = meeting.speakerSegments[0].id;

      for (let i = 0; i < meeting.speakerSegments.length; i++) {
        const seg = meeting.speakerSegments[i];
        const [mins, secs] = seg.timestamp.split(':').map(Number);
        const segSec = (mins || 0) * 60 + (secs || 0);
        if (totalSec >= segSec) {
          matchedId = seg.id;
        }
      }
      setActiveSegmentId(matchedId);
    }
  }, [currentTimeSec, meeting]);

  const togglePlayPause = () => {
    if (meeting?.audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
          console.error('[Audio Playback Error]:', err);
        });
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeekToSec = (targetSec: number) => {
    setCurrentTimeSec(targetSec);
    if (meeting?.audioUrl && audioRef.current) {
      audioRef.current.currentTime = targetSec;
    }
  };

  const handleSeekToTimestamp = (timestampStr: string, segmentId: string) => {
    const [mins, secs] = timestampStr.split(':').map(Number);
    const targetSec = (mins || 0) * 60 + (secs || 0);
    setCurrentTimeSec(targetSec);
    setActiveSegmentId(segmentId);

    if (meeting?.audioUrl && audioRef.current) {
      audioRef.current.currentTime = targetSec;
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        console.error('[Audio Playback Error]:', err);
      });
    } else {
      setIsPlaying(true);
    }

    showToast(`Jumped to audio timestamp ${timestampStr}`);
  };

  // Sync Task to Google Calendar API
  const handleSyncTaskToCalendar = async (task: ActionItem) => {
    setSyncingTaskId(task.id);
    setCalendarAlert(null);

    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          assignee: task.assignee,
          dueDate: task.dueDate,
          meetingTitle: meeting?.title,
        }),
      });

      const parsed = await safeParseJsonResponse(res);
      setSyncingTaskId(null);

      if (res.status === 401 || parsed.data?.requiresAuth) {
        // Redirect to Google OAuth Consent Flow
        window.location.href = `/api/calendar/auth?returnTo=/meetings/${meetingId}`;
        return;
      }

      if (parsed.success && parsed.data?.success && parsed.data?.eventId) {
        const data = parsed.data;
        showToast(`Synced to Google Calendar! Event ID: ${data.eventId}`);
        if (data.htmlLink) {
          window.open(data.htmlLink, '_blank');
        }
      } else {
        setCalendarAlert(`Calendar sync failed: ${parsed.error || parsed.data?.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setSyncingTaskId(null);
      setCalendarAlert(`Calendar API error: ${err.message}`);
    }
  };

  // Export PDF/DOCX
  const handleExportFile = async (format: 'pdf' | 'docx') => {
    if (!meeting) return;
    if (format === 'pdf') setIsExportingPdf(true);
    if (format === 'docx') setIsExportingDocx(true);

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: meeting.id,
          format,
          meeting,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Export request failed (${res.status}): ${errText.replace(/<[^>]*>/g, '').trim().slice(0, 150)}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `echoes-${meeting.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast(`Exported real ${format.toUpperCase()} file containing speaker diarization!`);
    } catch (err: any) {
      showToast(`Export error: ${err.message}`);
    } finally {
      setIsExportingPdf(false);
      setIsExportingDocx(false);
    }
  };

  const [additionalRecipients, setAdditionalRecipients] = useState<string[]>([]);
  const [newAdditionalEmail, setNewAdditionalEmail] = useState('');

  const getLinkedRecipients = () => {
    if (!meeting) return [];
    const map = new Map<string, { member: TeamMember; tasks: ActionItem[] }>();

    meeting.actionItems.forEach((task) => {
      let member = teamMembers.find((m) => m.id === task.linkedMemberId);
      if (!member) {
        member = teamMembers.find((m) => m.name.toLowerCase() === task.assignee.toLowerCase());
      }
      if (member) {
        if (!map.has(member.id)) {
          map.set(member.id, { member, tasks: [] });
        }
        map.get(member.id)!.tasks.push(task);
      }
    });

    return Array.from(map.values());
  };

  const getUnlinkedTasks = () => {
    if (!meeting) return [];
    return meeting.actionItems.filter((t) => {
      const hasLinkedId = teamMembers.some((m) => m.id === t.linkedMemberId);
      const hasLinkedName = teamMembers.some((m) => m.name.toLowerCase() === t.assignee.toLowerCase());
      return !hasLinkedId && !hasLinkedName;
    });
  };

  const handleAddAdditionalRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdditionalEmail.trim()) return;
    if (additionalRecipients.includes(newAdditionalEmail.trim())) return;
    setAdditionalRecipients([...additionalRecipients, newAdditionalEmail.trim()]);
    setNewAdditionalEmail('');
  };

  const handleRemoveAdditionalRecipient = (email: string) => {
    setAdditionalRecipients(additionalRecipients.filter((e) => e !== email));
  };

  const [testOverrideEmail, setTestOverrideEmail] = useState('');

  // Resend Email Digest
  const handleSendEmailDigest = async () => {
    if (!meeting) return;
    setIsSendingEmail(true);

    const linked = getLinkedRecipients();
    let allTargets: { email: string; assigneeName: string }[] = linked.map((item) => ({
      email: item.member.email,
      assigneeName: item.member.name,
    }));

    additionalRecipients.forEach((email) => {
      allTargets.push({ email, assigneeName: 'Additional Recipient' });
    });

    if (allTargets.length === 0) {
      allTargets.push({ email: 'delivered@resend.dev', assigneeName: 'Team Member' });
    }

    // If user provided a real personal test email override, use that for dispatches!
    if (testOverrideEmail.trim()) {
      allTargets = allTargets.map((target) => ({
        ...target,
        email: testOverrideEmail.trim(),
      }));
    }

    let successCount = 0;
    const errors: string[] = [];

    const targetOrg = activeOrg || userOrgs?.find((o) => o.id === meeting?.organizationId) || userOrgs?.[0];
    const inviteCode = targetOrg?.inviteCode || (targetOrg as any)?.invite_code;
    const workspaceName = targetOrg?.name;
    const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const inviteLink = inviteCode ? `${origin}/invite/${inviteCode}` : undefined;

    if (!inviteCode) {
      console.warn('[Email Digest] Could not resolve workspace invite code for recipient payload');
    }

    try {
      for (const target of allTargets) {
        const payload = {
          meetingId: meeting.id,
          recipientEmail: target.email,
          assigneeName: target.assigneeName,
          meeting,
          workspaceName,
          workspaceInviteCode: inviteCode,
          workspaceInviteLink: inviteLink,
        };

        const res = await fetch('/api/email/digest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const parsed = await safeParseJsonResponse(res);
        if (parsed.success && parsed.data?.success) {
          const data = parsed.data;
          successCount++;
          console.log(`[Email Digest Response Success] Delivered to ${data.recipient} (Resend ID: ${data.resendId})`);
        } else {
          const errStr = parsed.error || parsed.data?.error || 'Unknown email delivery error';
          console.warn(`[Email Digest Response Warning] Failed to deliver to ${target.email}:`, errStr);
          errors.push(`${target.email}: ${errStr}`);
        }
      }

      setIsSendingEmail(false);
      setIsEmailModalOpen(false);

      if (successCount > 0) {
        if (errors.length > 0) {
          showToast(`Sent to ${successCount} recipient(s), but failed for: ${errors.join('; ')}`);
        } else {
          showToast(`Email digest successfully dispatched to ${successCount} ${successCount === 1 ? 'recipient' : 'recipients'}!`);
        }
      } else {
        showToast(`Email Dispatch Failed: ${errors.join('; ')}`);
      }
    } catch (err: any) {
      setIsSendingEmail(false);
      showToast(`Email API error: ${err.message}`);
    }
  };

  const formatTime = (secs: number) => {
    if (secs === 0) return "00:00";
    if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return "--:--";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: ActionItem['status']) => {
    updateTaskStatus(taskId, newStatus);
    if (meeting) {
      const updatedItems = meeting.actionItems.map((t) => 
        t.id === taskId ? { ...t, status: newStatus } : t
      );
      setMeeting({ ...meeting, actionItems: updatedItems });
    }
    const res = await syncTaskStatusToSupabase(taskId, newStatus);
    if (!res.success && res.error) {
      showToast(`⚠️ ${res.error}`);
    } else {
      showToast(`Task status updated to "${newStatus.replace('_', ' ')}"`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (!meeting) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-16 text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-zinc-700">Loading meeting details...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-20">
      <Navbar />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-zinc-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2.5 border border-zinc-700 animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-8">
        
        {/* Calendar Authorization Alert (Graceful Fallback) */}
        {calendarAlert && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-medium flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span>{calendarAlert}</span>
            </div>

            <a
              href={`/api/calendar/auth?returnTo=/meetings/${meetingId}`}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-colors"
            >
              <span>Authenticate Google Calendar</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Draft / Uploaded Review Banner */}
        {meeting && (meeting.status === 'draft' || meeting.status === 'uploaded') && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {meeting.status === 'uploaded' ? 'Audio Uploaded — Not Processed Yet' : 'Draft Notes — Pending Final Review'}
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  {meeting.status === 'uploaded' 
                    ? 'Audio file is saved. Click below to continue AI transcription & extraction.' 
                    : 'AI extraction completed automatically. Review notes and mark as completed.'}
                </p>
              </div>
            </div>

            {meeting.status === 'uploaded' ? (
              <Link
                href={`/new-meeting?resumeId=${meeting.id}`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0"
              >
                <span>Resume Processing</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                onClick={() => {
                  updateMeetingStatus(meeting.id, 'completed');
                  setMeeting({ ...meeting, status: 'completed' });
                  showToast('Meeting finalized & marked as Completed!');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finalize & Mark Completed</span>
              </button>
            )}
          </div>
        )}

        {/* Navigation & Export Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Link
            href="/meetings"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-600" />
            <span>Back to All Meetings</span>
          </Link>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            <a
              href={`/api/calendar/auth?returnTo=/meetings/${meetingId}`}
              className="px-3.5 py-2.5 min-h-[40px] rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-900 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span>Connect Google Calendar</span>
            </a>

            <button
              onClick={() => handleExportFile('pdf')}
              disabled={isExportingPdf}
              className="px-3.5 py-2.5 min-h-[40px] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span>{isExportingPdf ? 'Exporting PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={() => handleExportFile('docx')}
              disabled={isExportingDocx}
              className="px-3.5 py-2.5 min-h-[40px] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span>{isExportingDocx ? 'Exporting DOCX...' : 'Download DOCX'}</span>
            </button>

            <button
              onClick={() => setIsEmailModalOpen(true)}
              className="px-3.5 py-2.5 min-h-[40px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-hero transition-all flex items-center justify-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-200 flex-shrink-0" />
              <span>Send Email Digest</span>
            </button>

            <button
              onClick={() => {
                if (meeting && window.confirm(`Delete meeting "${meeting.title}"? This cannot be undone.`)) {
                  deleteMeeting(meeting.id);
                  router.push('/meetings');
                }
              }}
              className="px-3.5 py-2.5 min-h-[40px] rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span>Delete Meeting</span>
            </button>
          </div>
        </div>

        {/* Hero Card */}
        <div className="card-white p-6 mb-8 border-l-4 border-l-indigo-600 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5 sm:gap-3 leading-tight mb-3">
                <Video className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <span>{meeting.title}</span>
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <PillBadge label={meeting.sentiment || 'action-oriented'} variant="ai" size="sm" />
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                  {meeting.date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                  {meeting.duration}
                </span>
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                  {new Set(meeting.speakerSegments.map((s) => s.speaker)).size} {new Set(meeting.speakerSegments.map((s) => s.speaker)).size === 1 ? 'speaker detected' : 'speakers detected'}
                </span>
              </div>
            </div>

            {/* Health Score Pill Card */}
            <div className="p-4 rounded-2xl bg-zinc-900 text-white flex items-center gap-4 min-w-[200px] justify-between shadow-hero">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Meeting Health</span>
                <span className="text-2xl font-extrabold text-white">{meeting.healthScore.score}<span className="text-xs text-zinc-400 font-normal">/100</span></span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">

            {/* Executive Summary */}
            <div className="card-white p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Executive Summary
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal">
                {meeting.summary}
              </p>
            </div>

            {/* Key Decisions */}
            <div className="card-white p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Key Decisions ({meeting.keyDecisions.length})
                </h2>
              </div>

              <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200">
                {meeting.keyDecisions.map((decision, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{decision}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Audio Player UI */}
            <div className="card-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Meeting Audio Playback
                </h2>
                {meeting.audioUrl ? (
                  <PillBadge label="Audio Stream" variant="ai" size="sm" />
                ) : (
                  <PillBadge label="Sample Stream" variant="tag" size="sm" />
                )}
              </div>

              {/* Real HTML5 Audio Element */}
              {meeting.audioUrl && (
                <audio
                  ref={audioRef}
                  src={meeting.audioUrl}
                  onTimeUpdate={() => {
                    if (audioRef.current) setCurrentTimeSec(Math.floor(audioRef.current.currentTime));
                  }}
                  onLoadedMetadata={() => {
                    if (audioRef.current && isFinite(audioRef.current.duration) && !isNaN(audioRef.current.duration)) {
                      const totalSeconds = Math.floor(audioRef.current.duration);
                      setDurationSec(totalSeconds);
                      const mins = Math.floor(totalSeconds / 60);
                      const secs = totalSeconds % 60;
                      const formattedDuration = secs > 0 ? `${mins} min ${secs} sec` : `${Math.max(1, mins)} min`;
                      if (meeting && meeting.duration !== formattedDuration) {
                        meeting.duration = formattedDuration;
                        saveMeeting(meeting);
                      }
                    }
                  }}
                  onEnded={() => setIsPlaying(false)}
                />
              )}

              <div className="p-4 rounded-2xl bg-zinc-900 text-white space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlayPause}
                      aria-label="Play or pause audio"
                      className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-hero transition-all flex items-center justify-center flex-shrink-0"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 pl-0.5" />}
                    </button>

                    <div>
                      <p className="text-xs font-bold text-zinc-200">
                        {isPlaying ? "Playing recording audio stream..." : "Audio Paused"}
                      </p>
                      <p className="text-[11px] text-zinc-400 font-medium">
                        {meeting.audioUrl ? "Audio recording playback" : "Click transcript timestamp to seek"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleSeekToSec(Math.max(0, currentTimeSec - 10))}
                      className="px-3 py-2 min-h-[44px] rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-bold flex items-center gap-1 active:scale-95"
                    >
                      <Rewind className="w-3.5 h-3.5" /> -10s
                    </button>
                    <button
                      onClick={() => handleSeekToSec(currentTimeSec + 10)}
                      className="px-3 py-2 min-h-[44px] rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-bold flex items-center gap-1 active:scale-95"
                    >
                      +10s <FastForward className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={durationSec}
                  value={currentTimeSec}
                  onChange={(e) => handleSeekToSec(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>{formatTime(currentTimeSec)}</span>
                  <span>{formatTime(durationSec)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-6">

            {/* Conversation Timeline */}
            <div className="card-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Conversation Timeline
                </h2>
                <PillBadge label="Click timestamp to seek" variant="tag" size="sm" />
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {meeting.speakerSegments.map((seg) => {
                  const isActive = activeSegmentId === seg.id;
                  return (
                    <div
                      key={seg.id}
                      onClick={() => handleSeekToTimestamp(seg.timestamp, seg.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-400/30 shadow-sm'
                          : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/80 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-bold flex items-center gap-1.5 ${isActive ? 'text-indigo-900 dark:text-indigo-300' : 'text-indigo-600 dark:text-indigo-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-600 animate-ping' : 'bg-indigo-400'}`} />
                          {seg.speaker}
                        </span>

                        <button className="px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:text-indigo-900 dark:hover:text-indigo-200">
                          {seg.timestamp}
                        </button>
                      </div>

                      <p className="text-xs text-zinc-800 dark:text-zinc-200 font-normal leading-relaxed pl-3 border-l-2 border-indigo-200 dark:border-indigo-800">
                        "{seg.text}"
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Items & Google Calendar One-Click Sync */}
            <div className="card-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Action Items ({meeting.actionItems.length})
                </h2>
              </div>

              <div className="space-y-3">
                {meeting.actionItems.map((task) => {
                  const linkedMember = teamMembers.find((m) => m.id === task.linkedMemberId);
                  const isUnlinked = !linkedMember || task.unlinkedSpeaker;

                  return (
                    <div key={task.id} className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 transition-all space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white leading-snug">{task.title}</p>
                        <PillBadge priority={task.priority} size="sm" />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2">
                          {isUnlinked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-bold text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>Unlinked: {task.unlinkedSpeaker || task.assignee}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-semibold cursor-help" title={linkedMember.email}>
                              <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold flex items-center justify-center text-[9px]">
                                {linkedMember.name.slice(0, 2)}
                              </span>
                              <span>{linkedMember.name}</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLinkingTaskId(task.id);
                              setIsLinkModalOpen(true);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-[10px]"
                          >
                            {isUnlinked ? 'Link Contact' : 'Change Contact'}
                          </button>
                        </div>

                        <select
                          value={task.status}
                          onChange={(e: any) => handleTaskStatusChange(task.id, e.target.value)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border focus:outline-none ${
                            task.status === 'completed'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                              : task.status === 'in_progress'
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700'
                          }`}
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>

                      {/* Google Calendar One-Click Sync Button */}
                      <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                        <button
                          onClick={() => handleSyncTaskToCalendar(task)}
                          disabled={syncingTaskId === task.id}
                          className="w-full py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                        >
                          <CalendarPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>{syncingTaskId === task.id ? 'Syncing to Calendar...' : 'Sync to Google Calendar'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

        {/* LINK CONTACT MODAL */}
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#1C1C21] rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Link Task to Team Contact
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Select an active contact from your team directory to link this task to a verified email address.
              </p>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {teamMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (selectedLinkingTaskId) {
                        handleLinkContactToTask(selectedLinkingTaskId, m);
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 text-left flex items-center justify-between transition-all"
                  >
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">{m.name}</p>
                      <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{m.email}</p>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Link &rarr;</span>
                  </button>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EMAIL DIGEST CONFIRMATION MODAL */}
        {isEmailModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1C1C21] rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-xl w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Confirm Email Digest Dispatch
                </h3>
                <button onClick={() => setIsEmailModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                  &times;
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs space-y-1">
                <p className="font-bold text-indigo-900 dark:text-indigo-200">Meeting: {meeting.title}</p>
                <p className="text-indigo-800 dark:text-indigo-300">{meeting.actionItems.length} Total Action Items • Health Score {meeting.healthScore.score}/100</p>
              </div>

              {/* 1. Auto-Populated Recipients Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  1. Auto-Populated Linked Task Recipients ({getLinkedRecipients().length})
                </h4>

                {getLinkedRecipients().length === 0 ? (
                  <p className="text-xs italic text-zinc-500 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    No linked contacts found for this meeting's tasks.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {getLinkedRecipients().map(({ member, tasks }) => (
                      <div key={member.id} className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center text-[10px]">
                              {member.name.slice(0, 2)}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-zinc-900 dark:text-white">{member.name}</p>
                              <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{member.email}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold">
                            {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
                          </span>
                        </div>

                        {/* Per-recipient task list preview */}
                        <ul className="space-y-1 pl-8 border-l-2 border-indigo-200 dark:border-indigo-800">
                          {tasks.map((t) => (
                            <li key={t.id} className="text-[11px] text-zinc-700 dark:text-zinc-300 font-medium flex items-center justify-between">
                              <span className="truncate">&bull; {t.title}</span>
                              <span className="text-[10px] font-mono text-zinc-400 flex-shrink-0 ml-2">Due {t.dueDate}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Additional Recipients Option */}
              <div>
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  2. + Add Additional Recipient (Stakeholder / Manager)
                </h4>

                <form onSubmit={handleAddAdditionalRecipient} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="e.g. manager@echoes.dev"
                    value={newAdditionalEmail}
                    onChange={(e) => setNewAdditionalEmail(e.target.value)}
                    className="flex-1 px-3.5 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white text-xs font-bold transition-all"
                  >
                    Add
                  </button>
                </form>

                {additionalRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {additionalRecipients.map((email) => (
                      <span key={email} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold">
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAdditionalRecipient(email)}
                          className="text-zinc-400 hover:text-red-500 font-bold"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Unlinked / Skipped Assignees Section */}
              {getUnlinkedTasks().length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span>Skipped Unlinked Assignees ({getUnlinkedTasks().length} Tasks)</span>
                  </div>

                  <p className="text-[11px] leading-relaxed">
                    The following speakers are unlinked and will NOT receive a personalized digest because no contact email address is associated with them:
                  </p>

                  <ul className="space-y-1 font-mono text-[11px]">
                    {getUnlinkedTasks().map((t) => (
                      <li key={t.id} className="text-amber-950 dark:text-amber-300">
                        &bull; <span className="font-bold">{t.unlinkedSpeaker || t.assignee}</span>: "{t.title}" &rarr; <span className="underline italic">Skipped (No Contact Email)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Test Dispatch Override Input */}
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-1.5">
                <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  Optional: Deliver all test dispatches directly to your personal email address
                </label>
                <input
                  type="email"
                  placeholder="Leave empty for contact emails, or enter your real email e.g. user@gmail.com"
                  value={testOverrideEmail}
                  onChange={(e) => setTestOverrideEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
                <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
                  (If filled, every personalized digest in this batch will be sent directly to this address so you can inspect the delivered emails in your real inbox!)
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-bold text-zinc-500">
                  Total Dispatches: {getLinkedRecipients().length + additionalRecipients.length}
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEmailModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleSendEmailDigest}
                    disabled={isSendingEmail}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-hero flex items-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingEmail ? 'Dispatching...' : 'Confirm & Send All Email Digests'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
