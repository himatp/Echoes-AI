"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { PillBadge } from '@/components/ui/PillBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LiveTimer } from '@/components/ui/LiveTimer';
import { getStoredMeetings, getStoredTasks, fetchAndHydrateMeetingsFromSupabase } from '@/lib/store/localStore';
import { Meeting, ActionItem } from '@/types';
import { Mic, ArrowUpRight, CheckCircle2, Clock, Sparkles, Activity, FileText, Zap, ChevronRight, Layers, History, ArrowRight, FileAudio } from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/components/auth/AuthProvider';
import { fetchPersonalMemberWorkspaceData, fetchOrganizationMembersFromSupabase } from '@/lib/supabase/client';
import { MemberPortalView } from '@/components/portal/MemberPortalView';

export default function DashboardPage() {
  const { user, activeOrg } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<ActionItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [greeting, setGreeting] = useState('Good morning');
  const [needsReviewFilter, setNeedsReviewFilter] = useState<'all' | 'uploaded' | 'transcribed' | 'draft'>('all');
  
  // Restricted Portal View State
  const [isRestrictedMember, setIsRestrictedMember] = useState(false);
  const [portalData, setPortalData] = useState<any>(null);

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Friend';

  // Load persistent meetings & tasks for active workspace with live Supabase hydration
  useEffect(() => {
    // 1. Instant local render for speed
    setMeetings(getStoredMeetings());
    setTasks(getStoredTasks());
    setIsLoaded(true);

    // Check member access level scope specifically for activeOrg
    if (user?.id) {
      fetchPersonalMemberWorkspaceData(user.id, activeOrg?.id).then((data) => {
        const isOwnerOrAdmin = data.organizationMember?.role === 'owner' || data.organizationMember?.role === 'admin';
        if (!isOwnerOrAdmin) {
          setIsRestrictedMember(true);
          setPortalData(data);
        } else {
          setIsRestrictedMember(false);
        }
      });
    }

    // 2. Fetch live PostgreSQL remote data for active org
    if (activeOrg?.id) {
      fetchAndHydrateMeetingsFromSupabase(activeOrg.id).then((hydrated) => {
        setMeetings(hydrated);
        const finalizedMeetings = hydrated.filter((m) => m.status === 'completed' || (!m.status && m.summary && m.summary !== 'EMPTY'));
        setTasks(finalizedMeetings.flatMap((m) => m.actionItems || []));
      });
    }

    // Compute dynamic greeting based on user local time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, [activeOrg?.id, user?.id]);

  const pendingReviewMeetings = meetings.filter((m) => m.status === 'uploaded' || m.status === 'transcribed' || m.status === 'draft');
  const uploadedReviewCount = pendingReviewMeetings.filter((m) => m.status === 'uploaded').length;
  const transcribedReviewCount = pendingReviewMeetings.filter((m) => m.status === 'transcribed').length;
  const draftReviewCount = pendingReviewMeetings.filter((m) => m.status === 'draft').length;

  const filteredNeedsReviewMeetings = pendingReviewMeetings.filter((m) => {
    if (needsReviewFilter === 'uploaded') return m.status === 'uploaded';
    if (needsReviewFilter === 'transcribed') return m.status === 'transcribed';
    if (needsReviewFilter === 'draft') return m.status === 'draft';
    return true;
  });

  const completedMeetings = meetings.filter((m) => m.status === 'completed' || (!m.status && m.summary && m.summary !== 'EMPTY'));

  // Compute live team velocity metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const urgentTasks = tasks.filter((t) => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high'));

  // Calculate average health score across meetings
  const avgHealthScore = meetings.length > 0
    ? Math.round(meetings.reduce((acc, m) => acc + (m.healthScore?.score || 85), 0) / meetings.length)
    : 90;

  // Container animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
  };

  // If user is a restricted member in the active workspace, render dedicated Member Portal View
  if (isRestrictedMember) {
    return (
      <MemberPortalView
        initialMeetings={portalData?.meetings || []}
        initialActionItems={portalData?.actionItems || []}
        initialTeamMember={portalData?.teamMember}
        initialOrgMember={portalData?.organizationMember}
      />
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-8">
        
        {/* Header Greeting */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              {greeting}, <span className="text-indigo-600 dark:text-indigo-400">{userName}</span>
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm mt-1 font-medium flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span>AI Meeting Assistant & Action Item Generator</span>
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{meetings.length} {meetings.length === 1 ? 'meeting tracked' : 'meetings tracked'}</span>
            </p>
          </div>
        </motion.div>

        {/* Hero Card & Contrast Card Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* HERO CARD (Bold Indigo Accent) */}
          <div className="lg:col-span-2 card-hero p-6 lg:p-8 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-bold tracking-wide w-fit shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>ECHOES AI 2.0</span>
                </span>
                <span className="text-xs font-semibold text-indigo-100 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Smart Meeting Intelligence</span>
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                Automated Meeting Intelligence & Action Tasks
              </h2>
              <p className="text-indigo-100 text-xs sm:text-sm font-medium max-w-xl leading-relaxed mb-6">
                Turns your meeting audio into organized notes, key summaries, and actionable tasks — automatically.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10 pt-4 border-t border-indigo-500/40">
              <Link
                href="/new-meeting"
                className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-white text-indigo-900 font-bold text-xs shadow-md hover:bg-indigo-50 transition-all active:scale-95"
              >
                <Mic className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <span>Start New Recording</span>
              </Link>
              
              <Link
                href="/tasks"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 min-h-[44px] rounded-xl bg-indigo-700/60 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors"
              >
                <span>View Task Board ({totalTasks})</span>
                <ArrowUpRight className="w-4 h-4 flex-shrink-0" />
              </Link>
            </div>
          </div>

          {/* NEAR-BLACK CONTRAST CARD */}
          <div className="card-contrast p-6 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  Task Progress
                </span>
                <PillBadge label={`${avgHealthScore}% HEALTH`} variant="ai" size="sm" />
              </div>

              <div className="my-6">
                <div className="text-4xl font-extrabold text-white tracking-tight mb-1">
                  {completedTasks} / {totalTasks}
                </div>
                <p className="text-xs text-zinc-400 font-medium mb-4">
                  Action items completed across {meetings.length} {meetings.length === 1 ? 'processed meeting' : 'processed meetings'}
                </p>

                {/* Dynamic Live Updating Progress Bar */}
                <ProgressBar 
                  value={completionPercentage} 
                  label="Task Completion" 
                  barColor="bg-gradient-to-r from-indigo-500 to-emerald-400" 
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Avg Health Score: {avgHealthScore}/100
              </span>
              <Link href="/tasks" className="text-indigo-400 hover:underline font-semibold">
                Details &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* NEEDS REVIEW SECTION */}
        {pendingReviewMeetings.length > 0 && (
          <div className="mb-8 p-6 card-white border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-amber-500/20">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span>Needs Review ({pendingReviewMeetings.length})</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                  Unfinished recordings and pending AI drafts. Click to resume or finalize.
                </p>
              </div>

              {/* Filter Tabs Bar */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 shadow-sm self-start sm:self-auto flex-wrap">
                <button
                  onClick={() => setNeedsReviewFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    needsReviewFilter === 'all'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  All ({pendingReviewMeetings.length})
                </button>
                <button
                  onClick={() => setNeedsReviewFilter('uploaded')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    needsReviewFilter === 'uploaded'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Audio Uploaded ({uploadedReviewCount})
                </button>
                <button
                  onClick={() => setNeedsReviewFilter('transcribed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    needsReviewFilter === 'transcribed'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Audio Transcribed ({transcribedReviewCount})
                </button>
                <button
                  onClick={() => setNeedsReviewFilter('draft')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    needsReviewFilter === 'draft'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  Notes Extracted ({draftReviewCount})
                </button>
              </div>
            </div>

            {filteredNeedsReviewMeetings.length === 0 ? (
              <div className="p-8 text-center bg-white/40 dark:bg-zinc-900/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  No items match the selected "{
                    needsReviewFilter === 'uploaded'
                      ? 'Audio Uploaded'
                      : needsReviewFilter === 'transcribed'
                      ? 'Audio Transcribed'
                      : 'Notes Extracted'
                  }" filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredNeedsReviewMeetings.map((mtg) => {
                  const isUploaded = mtg.status === 'uploaded';
                  const isTranscribed = mtg.status === 'transcribed';
                  const isDraft = mtg.status === 'draft';

                  return (
                    <div
                      key={mtg.id}
                      className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                            isUploaded
                              ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : isTranscribed
                              ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}>
                            {isUploaded
                              ? 'Stage 1: Audio uploaded — not yet processed'
                              : isTranscribed
                              ? 'Stage 2: Audio transcribed — awaiting notes'
                              : 'Stage 3: Notes extracted — not yet reviewed'}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {new Date(mtg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1">
                          {mtg.title}
                        </h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                          {isUploaded 
                            ? 'Raw audio file stored safely in Supabase. Resume to generate AI notes & tasks.'
                            : isTranscribed
                            ? `Audio transcribed (${mtg.speakerSegments?.length || 0} dialogue lines). Resume to extract AI notes & tasks.`
                            : `${mtg.actionItems?.length || 0} tasks extracted • Health Score ${mtg.healthScore?.score || 85}/100`}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {mtg.duration || '0 min'}
                        </span>

                        {isUploaded || isTranscribed ? (
                          <Link
                            href={`/new-meeting?resumeId=${mtg.id}`}
                            className={`px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-colors flex items-center gap-1 ${
                              isUploaded ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-purple-600 hover:bg-purple-700'
                            }`}
                          >
                            <span>{isUploaded ? 'Resume Stage 1' : 'Resume Stage 2'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <Link
                            href={`/meetings/${mtg.id}`}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <span>Review & Finalize</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recent Meetings Grid & Quick Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Meetings List (White Cards - DYNAMIC) */}
          <div className="lg:col-span-2 card-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-6">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span>Processed Meetings ({completedMeetings.length})</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Loaded dynamically from persistence store • Click to inspect summary & health score</p>
              </div>

              <Link href="/meetings" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 self-start sm:self-auto min-h-[36px]">
                <span>View all ({completedMeetings.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {completedMeetings.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                No finalized meetings yet. Click "Start New Recording" to process a meeting or finalize an item under Needs Review.
              </div>
            ) : (
              <div className="space-y-4">
                {completedMeetings.map((mtg) => (
                  <Link 
                    key={mtg.id}
                    href={`/meetings/${mtg.id}`}
                    className="block p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-zinc-800/90 transition-all group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                          {mtg.title.slice(0, 2)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {mtg.title}
                          </h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                            {mtg.duration} • {mtg.speakerSegments?.length || 0} speaker turns • {mtg.actionItems?.length || 0} action items
                            {mtg.originalLanguage && ` • (${mtg.originalLanguage} translated)`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <PillBadge priority={mtg.sentiment === 'positive' ? 'low' : 'high'} label={mtg.sentiment.toUpperCase()} size="sm" />
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
                          Health {mtg.healthScore?.score || 85}/100
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 pl-12 font-normal">
                      {mtg.summary}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Urgent Pending Tasks Card (White Card - DYNAMIC) */}
          <div className="card-white p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Urgent Action Items
                </h3>
                <PillBadge label={`${urgentTasks.length} PENDING`} variant="priority" priority="urgent" size="sm" />
              </div>

              {urgentTasks.length === 0 ? (
                <div className="p-6 text-center bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 font-medium my-4">
                  No open urgent tasks. Great execution velocity!
                </div>
              ) : (
                <div className="space-y-3 my-4">
                  {urgentTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 flex items-start gap-3 hover:bg-white dark:hover:bg-zinc-800/90 transition-colors">
                      <CheckCircle2 className="w-4 h-4 text-zinc-400 dark:text-zinc-500 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <PillBadge priority={task.priority} size="sm" />
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                            {task.assignee} • Due {task.dueDate}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/tasks"
              className="w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors mt-4"
            >
              <span>Manage All Action Items ({totalTasks})</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
