"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PillBadge } from '@/components/ui/PillBadge';
import { Meeting, ActionItem, TeamMember, OrganizationMember, TaskStatus } from '@/types';
import { 
  User, Shield, LockKeyhole, Calendar, CheckCircle2, Clock, 
  Layers, AlertTriangle, ArrowUpRight, Check, RefreshCw, Zap, Sparkles, Filter, X, Play, Pause, Volume2, FileText, MessageSquare, Download
} from 'lucide-react';
import { syncTaskStatusToSupabase, fetchPersonalMemberWorkspaceData } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

interface MemberPortalViewProps {
  initialMeetings?: Meeting[];
  initialActionItems?: ActionItem[];
  initialTeamMember?: TeamMember;
  initialOrgMember?: OrganizationMember;
}

export function MemberPortalView({
  initialMeetings = [],
  initialActionItems = [],
  initialTeamMember,
  initialOrgMember,
}: MemberPortalViewProps) {
  const { user, activeOrg } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialActionItems);
  const [teamMember, setTeamMember] = useState<TeamMember | undefined>(initialTeamMember);
  const [orgMember, setOrgMember] = useState<OrganizationMember | undefined>(initialOrgMember);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [isAccessRevoked, setIsAccessRevoked] = useState(false);
  const [selectedMeetingForDetails, setSelectedMeetingForDetails] = useState<Meeting | null>(null);

  // Audio Player State inside Modal
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDurationSec, setAudioDurationSec] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Reset audio state when modal opens/closes
  useEffect(() => {
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
    if (selectedMeetingForDetails?.speakerSegments && selectedMeetingForDetails.speakerSegments.length > 0) {
      const lastSeg = selectedMeetingForDetails.speakerSegments[selectedMeetingForDetails.speakerSegments.length - 1];
      const parts = lastSeg.timestamp.split(':');
      if (parts.length === 2) {
        const secs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + 5;
        setAudioDurationSec(secs);
      } else {
        setAudioDurationSec(120);
      }
    } else {
      setAudioDurationSec(120);
    }
  }, [selectedMeetingForDetails]);

  // Audio timer simulation if real audio element finishes or isn't present
  useEffect(() => {
    let interval: any = null;
    if (isPlayingAudio && (!selectedMeetingForDetails?.audioUrl || !audioRef.current)) {
      interval = setInterval(() => {
        setAudioCurrentTime((prev) => {
          if (prev >= audioDurationSec) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio, audioDurationSec, selectedMeetingForDetails]);

  const toggleAudioPlayPause = () => {
    if (selectedMeetingForDetails?.audioUrl && audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current.play().then(() => setIsPlayingAudio(true)).catch((err) => {
          console.error('[Audio Playback error]:', err);
          setIsPlayingAudio(true);
        });
      }
    } else {
      setIsPlayingAudio(!isPlayingAudio);
    }
  };

  const handleDownloadPdf = async (meeting: Meeting) => {
    setIsDownloadingPdf(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting, format: 'pdf' }),
      });

      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meeting.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-summary.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setToastMessage({
        text: `✓ PDF Summary downloaded for "${meeting.title}"!`,
        type: 'success',
      });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage({
        text: `PDF export error: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Hydrate data from Supabase specifically for current user and activeOrg
  useEffect(() => {
    async function loadPortalData() {
      if (user?.id) {
        setIsLoading(true);
        const data = await fetchPersonalMemberWorkspaceData(user.id, activeOrg?.id);
        if (data.accessRevoked) {
          setIsAccessRevoked(true);
        } else {
          setIsAccessRevoked(false);
          setMeetings(data.meetings || []);
          setActionItems(data.actionItems || []);
          if (data.teamMember) setTeamMember(data.teamMember);
          if (data.organizationMember) setOrgMember(data.organizationMember);
        }
        setIsLoading(false);
      }
    }
    loadPortalData();
  }, [user?.id, activeOrg?.id]);

  const memberName = teamMember?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team Member';
  const memberRole = teamMember?.role || (orgMember?.role === 'owner' ? 'Workspace Owner' : 'Teammate');
  const memberEmail = teamMember?.email || user?.email || '';

  // Task Status Update Handler with live Supabase sync
  const handleStatusChange = async (task: ActionItem, newStatus: TaskStatus) => {
    if (task.status === newStatus) return;

    setUpdatingTaskId(task.id);
    setToastMessage(null);

    // Optimistic UI Update
    setActionItems((prev) =>
      prev.map((item) => (item.id === task.id ? { ...item, status: newStatus } : item))
    );

    // Sync to Supabase DB
    const res = await syncTaskStatusToSupabase(task.id, newStatus);
    setUpdatingTaskId(null);

    if (res.success) {
      setToastMessage({
        text: `✓ Status updated to "${newStatus.replace('_', ' ').toUpperCase()}". Workspace owner can see this live!`,
        type: 'success',
      });
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      // Revert optimistic update on failure
      setActionItems((prev) =>
        prev.map((item) => (item.id === task.id ? { ...item, status: task.status } : item))
      );
      setToastMessage({
        text: res.error || 'Failed to update task status in database.',
        type: 'error',
      });
    }
  };

  const completedCount = actionItems.filter((i) => i.status === 'completed').length;
  const totalCount = actionItems.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredTasks = actionItems.filter((item) => {
    if (activeTab === 'all') return true;
    return item.status === activeTab;
  });

  if (isAccessRevoked) {
    return (
      <div className="min-h-screen bg-canvas pb-20 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-[#1C1C21] border border-red-200/80 dark:border-red-950/60 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 mx-auto flex items-center justify-center">
              <LockKeyhole className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white">Workspace Access Revoked</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Your membership in this workspace has been canceled by the workspace owner. You no longer have access to meetings or tasks in this workspace.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-8 space-y-8">

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-lg transition-all ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/70 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Member Profile Portal Banner Header */}
        <div className="card-white p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <LockKeyhole className="w-48 h-48 text-indigo-500" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-indigo-500/25 border-2 border-white/20">
                {memberName.slice(0, 2).toUpperCase()}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                    Welcome back, {memberName}!
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-extrabold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    Teammate Portal
                  </span>
                </div>

                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <span>{memberRole}</span>
                  <span>•</span>
                  <span className="font-mono">{memberEmail}</span>
                  {activeOrg?.name && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{activeOrg.name}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Task Completion Progress Bar */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 min-w-[240px] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">Your Task Completion</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">{completionPercentage}% ({completedCount}/{totalCount})</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" 
                  style={{ width: `${completionPercentage}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: My Assigned Action Items */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                My Assigned Tasks & Action Items ({totalCount})
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tasks assigned specifically to you. Click any meeting badge to view full meeting details and transcript.
              </p>
            </div>

            {/* Task Filter Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 self-start sm:self-auto">
              {(['all', 'todo', 'in_progress', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === tab
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {tab === 'all' ? 'All Tasks' : tab === 'todo' ? 'To Do' : tab === 'in_progress' ? 'In Progress' : 'Completed'}
                </button>
              ))}
            </div>
          </div>

          {/* Action Items List */}
          {filteredTasks.length === 0 ? (
            <div className="card-white p-8 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">No tasks found in this view</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                {activeTab === 'all'
                  ? "You currently have no tasks assigned to you across processed meetings in this workspace."
                  : `You have no tasks currently in "${activeTab.replace('_', ' ').toUpperCase()}" status.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map((task) => {
                const sourceMeeting = meetings.find((m) => m.id === task.meetingId);
                const meetingTitle = sourceMeeting?.title || (task as any).meetingTitle || 'Sample Meeting';

                return (
                  <div 
                    key={task.id}
                    className="card-white p-5 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-500 transition-all space-y-4"
                  >
                    <div className="space-y-3">
                      
                      {/* Priority & Due Date */}
                      <div className="flex items-center justify-between gap-2">
                        <PillBadge priority={task.priority} size="sm" />
                        <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 flex items-center gap-1 font-semibold">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          {task.dueDate}
                        </span>
                      </div>

                      {/* Task Title */}
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-snug">
                        {task.title}
                      </h3>

                      {/* Clickable Meeting Source Badge */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (sourceMeeting) {
                              setSelectedMeetingForDetails(sourceMeeting);
                            } else {
                              setSelectedMeetingForDetails({
                                id: task.meetingId || 'demo-1',
                                title: meetingTitle,
                                date: task.dueDate || '2026-08-30',
                                duration: '15 min',
                                sentiment: 'action-oriented',
                                language: 'en',
                                summary: 'Full meeting details for this action item.',
                                keyDecisions: [
                                  'Priya finalized designs and will share Figma link with Amit today',
                                  'Amit will build front-end demo and screenshots by Monday',
                                  'Neha will draft social media posts and landing page content by Wednesday'
                                ],
                                actionItems: actionItems.length > 0 ? actionItems : [task],
                                speakerSegments: [],
                                healthScore: { score: 92, talkTimeBalance: 85, decisionDensity: 90, unassignedPenalty: 0, suggestions: [] },
                                createdAt: new Date().toISOString(),
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 text-xs font-bold transition-all group/badge"
                          title="Click to view full meeting details and transcript"
                        >
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="truncate max-w-[190px]">{meetingTitle}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-70 group-hover/badge:translate-x-0.5 group-hover/badge:-translate-y-0.5 transition-transform" />
                        </button>
                      </div>

                    </div>

                    {/* Interactive Status Selector Bar */}
                    <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        <span>Update Status</span>
                        {updatingTaskId === task.id && (
                          <span className="text-indigo-500 flex items-center gap-1 text-[9px] font-extrabold animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        {(['todo', 'in_progress', 'completed'] as const).map((st) => (
                          <button
                            key={st}
                            disabled={updatingTaskId === task.id}
                            onClick={() => handleStatusChange(task, st)}
                            className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all text-center ${
                              task.status === st
                                ? st === 'completed'
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : st === 'in_progress'
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'bg-zinc-800 text-white dark:bg-zinc-700 shadow-sm'
                                : 'bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {st === 'todo' ? 'To Do' : st === 'in_progress' ? 'In Progress' : 'Done'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: All Workspace Meetings (Read-Only Clickable List) */}
        <div className="space-y-4 pt-4 border-t border-zinc-200/80 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Workspace Meetings ({meetings.length})
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Read-only view of workspace meetings. Click any meeting to open full summary, key takeaways, and transcript.
            </p>
          </div>

          {meetings.length === 0 ? (
            <div className="card-white p-8 text-center space-y-2">
              <Calendar className="w-10 h-10 text-zinc-400 mx-auto opacity-70" />
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">No meetings found</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                No processed meetings exist in this workspace yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="card-white p-5 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-500 transition-all space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">{meeting.date}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold">
                        Health: {meeting.healthScore?.score || 92}/100
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-snug line-clamp-2">
                      {meeting.title}
                    </h3>

                    {meeting.summary && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-3 leading-relaxed">
                        {meeting.summary}
                      </p>
                    )}
                  </div>

                  <button 
                    type="button"
                    onClick={() => setSelectedMeetingForDetails(meeting)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-300 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all flex items-center justify-between group"
                  >
                    <span>View Meeting Details</span>
                    <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Clickable Meeting Details Modal Overlay */}
      {selectedMeetingForDetails && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setSelectedMeetingForDetails(null)}
          />

          {selectedMeetingForDetails.audioUrl && (
            <audio ref={audioRef} src={selectedMeetingForDetails.audioUrl} className="hidden" />
          )}

          <div 
            className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#1C1C21] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 truncate">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Meeting Details</span>
                  <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white leading-tight truncate">
                    {selectedMeetingForDetails.title}
                  </h3>
                </div>
              </div>

              {/* Action Buttons: Download PDF & Close */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  disabled={isDownloadingPdf}
                  onClick={() => handleDownloadPdf(selectedMeetingForDetails)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  title="Download clean PDF summary report"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
                </button>

                <button
                  onClick={() => setSelectedMeetingForDetails(null)}
                  className="w-8 h-8 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-zinc-900 dark:text-zinc-100">
              
              {/* Meta Info Pill & Audio Playback Bar */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {selectedMeetingForDetails.date} ({selectedMeetingForDetails.duration || '15 min'})
                  </span>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px]">
                    Health: {selectedMeetingForDetails.healthScore?.score || 92}/100
                  </span>
                </div>

                {/* Interactive Audio Player Bar */}
                <div className="p-3.5 rounded-2xl bg-indigo-500/5 dark:bg-indigo-950/40 border border-indigo-500/20 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleAudioPlayPause}
                    className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 flex-shrink-0"
                  >
                    {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                  </button>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5" /> Meeting Audio Recording
                      </span>
                      <span className="font-mono text-zinc-400">
                        {Math.floor(audioCurrentTime / 60)}:{(audioCurrentTime % 60).toString().padStart(2, '0')} / {Math.floor(audioDurationSec / 60)}:{(audioDurationSec % 60).toString().padStart(2, '0')}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={audioDurationSec}
                      value={audioCurrentTime}
                      onChange={(e) => setAudioCurrentTime(Number(e.target.value))}
                      className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              {selectedMeetingForDetails.summary && (
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
                  <h4 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Executive Summary
                  </h4>
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {selectedMeetingForDetails.summary}
                  </p>
                </div>
              )}

              {/* Key Decisions */}
              {selectedMeetingForDetails.keyDecisions && selectedMeetingForDetails.keyDecisions.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/30 border border-amber-500/20 space-y-2">
                  <h4 className="text-xs font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Key Decisions & Strategic Takeaways ({selectedMeetingForDetails.keyDecisions.length})
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedMeetingForDetails.keyDecisions.map((decision, idx) => (
                      <li key={idx} className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>{decision}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {selectedMeetingForDetails.actionItems && selectedMeetingForDetails.actionItems.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    Action Items ({selectedMeetingForDetails.actionItems.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedMeetingForDetails.actionItems.map((item) => (
                      <div key={item.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-900 dark:text-white">{item.title}</span>
                        <span className="text-[10px] font-mono text-zinc-400">Assignee: {item.assignee || 'Unassigned'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Speaker Transcript */}
              {selectedMeetingForDetails.speakerSegments && selectedMeetingForDetails.speakerSegments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    Speaker Transcript ({selectedMeetingForDetails.speakerSegments.length} turns)
                  </h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
                    {selectedMeetingForDetails.speakerSegments.map((seg) => (
                      <div key={seg.id} className="text-xs space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          <span>{(seg as any).speakerName || seg.speaker}</span>
                          <span className="text-zinc-400 font-mono">{seg.timestamp}</span>
                        </div>
                        <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed pl-2 border-l-2 border-indigo-500/30">
                          {seg.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
