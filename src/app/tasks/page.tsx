"use client";

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PillBadge } from '@/components/ui/PillBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getStoredMeetings, getStoredTasks, updateTaskStatus, addTaskToMeeting, fetchAndHydrateMeetingsFromSupabase } from '@/lib/store/localStore';
import { ActionItem, Meeting } from '@/types';
import { 
  CheckSquare, Search, Filter, Plus, ArrowRight, CheckCircle2, 
  Clock, AlertCircle, Sparkles, User, Calendar, ExternalLink, 
  Kanban, List, X, RefreshCw, Check, Zap
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { syncTaskStatusToSupabase } from '@/lib/supabase/client';

export default function TaskBoardPage() {
  const { activeOrg } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<ActionItem[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('all');

  // Toast & Modal
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Task Form Inputs
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newPriority, setNewPriority] = useState<ActionItem['priority']>('high');
  const [newMeetingId, setNewMeetingId] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );

  // Load Data (only finalized/completed meetings on Task Board!)
  const refreshData = () => {
    const loadedMeetings = getStoredMeetings().filter((m) => m.status === 'completed' || (!m.status && m.summary && m.summary !== 'EMPTY'));
    const loadedTasks = getStoredTasks();
    setMeetings(loadedMeetings);
    setTasks(loadedTasks);
  };

  useEffect(() => {
    refreshData();
    if (activeOrg?.id) {
      fetchAndHydrateMeetingsFromSupabase(activeOrg.id).then((hydrated) => {
        const finalizedMeetings = hydrated.filter((m) => m.status === 'completed' || (!m.status && m.summary && m.summary !== 'EMPTY'));
        setMeetings(finalizedMeetings);
        setTasks(finalizedMeetings.flatMap((m) => m.actionItems || []));
      });
    }
  }, [activeOrg?.id]);

  // Update Task Status with Real-Time Persistence Sync
  const handleStatusChange = async (taskId: string, newStatus: ActionItem['status']) => {
    updateTaskStatus(taskId, newStatus);
    refreshData();
    const res = await syncTaskStatusToSupabase(taskId, newStatus);
    if (!res.success && res.error) {
      showToast(`⚠️ ${res.error}`);
    } else {
      showToast(`Task status synced to "${newStatus.replace('_', ' ')}" across Dashboard & Meetings`);
    }
  };

  // Add Quick Task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: ActionItem = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      meetingId: newMeetingId,
      title: newTitle.trim(),
      assignee: newAssignee,
      priority: newPriority,
      status: 'todo',
      dueDate: newDueDate,
      speakerSource: 'Quick Task Form',
    };

    addTaskToMeeting(newMeetingId, newTask);
    refreshData();
    setIsAddModalOpen(false);
    setNewTitle('');
    showToast(`New task created for ${newAssignee}!`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.speakerSource && task.speakerSource.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPriority = selectedPriority === 'all' || task.priority === selectedPriority;
    const matchesAssignee = selectedAssignee === 'all' || task.assignee === selectedAssignee;
    const matchesMeeting = selectedMeetingId === 'all' || task.meetingId === selectedMeetingId;

    return matchesSearch && matchesPriority && matchesAssignee && matchesMeeting;
  });

  // Velocity Metrics
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const velocityPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Group by Kanban Column
  const todoTasks = filteredTasks.filter((t) => t.status === 'todo');
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'in_progress');
  const completedTasks = filteredTasks.filter((t) => t.status === 'completed');

  // Unique Assignees List for Filter Dropdown
  const uniqueAssignees = Array.from(new Set(tasks.map((t) => t.assignee)));

  return (
    <div className="min-h-screen bg-canvas pb-20">
      <Navbar />

      {/* Floating Sync Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-zinc-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2.5 border border-zinc-700 animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-8">

        {/* Header & Velocity Hero Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-start gap-2.5 sm:gap-3 leading-tight">
              <CheckSquare className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
              <span>Task Board</span>
            </h1>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-hero flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>Create Quick Task</span>
            </button>
          </div>
        </div>

        {/* Progress Bar Card */}
        <div className="card-contrast p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Team Task Completion</span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {completedCount} of {totalCount} Action Items Completed ({velocityPct}%)
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Auto-synced across meetings & dashboard</span>
            </div>
          </div>

          <ProgressBar 
            value={velocityPct} 
            label="Task Completion Progress" 
            barColor="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400" 
          />
        </div>

        {/* Search & Filter Toolbar */}
        <div className="card-white p-4 mb-6 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="w-full md:w-80 relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tasks, assignees, sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-zinc-400 dark:placeholder-zinc-500"
              />
            </div>

            {/* Filters Row - All 4 controls fully reachable on mobile */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto">
              
              {/* Priority Filter */}
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent Priority</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>

              {/* Assignee Filter */}
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none"
              >
                <option value="all">All Assignees</option>
                {uniqueAssignees.map((assignee) => (
                  <option key={assignee} value={assignee}>{assignee}</option>
                ))}
              </select>

              {/* Meeting Filter */}
              <select
                value={selectedMeetingId}
                onChange={(e) => setSelectedMeetingId(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none max-w-full sm:max-w-[180px] truncate"
              >
                <option value="all">All Meetings</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>

              {/* View Mode Toggle */}
              <div className="w-full sm:w-auto flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 min-h-[40px]">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    viewMode === 'kanban' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>Kanban</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    viewMode === 'list' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>List</span>
                </button>
              </div>

            </div>

          </div>
        </div>

        {/* KANBAN BOARD VIEW */}
        {viewMode === 'kanban' ? (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:grid-cols-3 md:gap-6 md:pb-0 scrollbar-thin">
            
            {/* COLUMN 1: TO DO */}
            <div className="space-y-4 min-w-[85vw] sm:min-w-[320px] md:min-w-0 snap-center">
              <div className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                  To Do
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs shadow-sm">
                  {todoTasks.length}
                </span>
              </div>

              <div className="space-y-3">
                {todoTasks.map((task) => (
                  <TaskKanbanCard
                    key={task.id}
                    task={task}
                    meetings={meetings}
                    onStatusChange={handleStatusChange}
                  />
                ))}
                {todoTasks.length === 0 && (
                  <div className="p-6 text-center bg-white dark:bg-[#1C1C21] rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                    No tasks in To Do column
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: IN PROGRESS */}
            <div className="space-y-4 min-w-[85vw] sm:min-w-[320px] md:min-w-0 snap-center">
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  In Progress
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-amber-950 dark:text-amber-200 font-bold text-xs shadow-sm">
                  {inProgressTasks.length}
                </span>
              </div>

              <div className="space-y-3">
                {inProgressTasks.map((task) => (
                  <TaskKanbanCard
                    key={task.id}
                    task={task}
                    meetings={meetings}
                    onStatusChange={handleStatusChange}
                  />
                ))}
                {inProgressTasks.length === 0 && (
                  <div className="p-6 text-center bg-white dark:bg-[#1C1C21] rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                    No tasks currently in progress
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 3: COMPLETED */}
            <div className="space-y-4 min-w-[85vw] sm:min-w-[320px] md:min-w-0 snap-center">
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Completed
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-zinc-800 text-emerald-950 dark:text-emerald-200 font-bold text-xs shadow-sm">
                  {completedTasks.length}
                </span>
              </div>

              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <TaskKanbanCard
                    key={task.id}
                    task={task}
                    meetings={meetings}
                    onStatusChange={handleStatusChange}
                  />
                ))}
                {completedTasks.length === 0 && (
                  <div className="p-6 text-center bg-white dark:bg-[#1C1C21] rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                    No completed tasks yet
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          /* LIST TABLE VIEW */
          <div className="card-white p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-extrabold uppercase tracking-wider">
                    <th className="pb-3">Task Title</th>
                    <th className="pb-3">Assignee</th>
                    <th className="pb-3">Priority</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Meeting Origin</th>
                    <th className="pb-3">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-medium text-zinc-800 dark:text-zinc-200">
                  {filteredTasks.map((t) => {
                    const originMeeting = meetings.find((m) => m.id === t.meetingId);
                    return (
                      <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                        <td className="py-3 font-bold text-zinc-900 dark:text-zinc-100 pr-4">{t.title}</td>
                        <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300 font-semibold">{t.assignee}</td>
                        <td className="py-3 pr-4">
                          <PillBadge priority={t.priority} size="sm" />
                        </td>
                        <td className="py-3 pr-4">
                          <select
                            value={t.status}
                            onChange={(e: any) => handleStatusChange(t.id, e.target.value)}
                            className="px-2.5 py-1 rounded-xl text-xs font-bold border focus:outline-none bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td className="py-3 pr-4">
                          {originMeeting ? (
                            <Link href={`/meetings/${originMeeting.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold">
                              <span>{originMeeting.title}</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : 'Direct Creation'}
                        </td>
                        <td className="py-3 font-mono text-zinc-400 dark:text-zinc-500">{t.dueDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal for Creating Quick Task */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="card-white p-6 max-w-md w-full shadow-2xl relative border border-zinc-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  Create Quick Task Card
                </h3>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Finalize Q3 roadmap review..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Assignee</label>
                    <select
                      value={newAssignee}
                      onChange={(e) => setNewAssignee(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-800 focus:outline-none"
                    >
                      <option value="Alex Kumar">Alex Kumar</option>
                      <option value="Sarah Chen">Sarah Chen</option>
                      <option value="Priya Patel">Priya Patel</option>
                      <option value="Marcus Vance">Marcus Vance</option>
                      <option value="Speaker A (Live Mic User)">Speaker A (Live Mic)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Priority Level</label>
                    <select
                      value={newPriority}
                      onChange={(e: any) => setNewPriority(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-800 focus:outline-none"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Assign to Meeting</label>
                    <select
                      value={newMeetingId}
                      onChange={(e) => setNewMeetingId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-800 focus:outline-none truncate"
                    >
                      {meetings.map((m) => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-hero"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// Sub-component: Individual Kanban Task Card
function TaskKanbanCard({ 
  task, 
  meetings, 
  onStatusChange 
}: { 
  task: ActionItem; 
  meetings: Meeting[]; 
  onStatusChange: (id: string, status: ActionItem['status']) => void;
}) {
  const originMeeting = meetings.find((m) => m.id === task.meetingId);

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C21] border border-zinc-200/90 dark:border-zinc-800/80 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500 transition-all space-y-3">
      
      {/* Title & Meeting Link */}
      <div>
        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-snug mb-1">{task.title}</h4>
        {originMeeting && (
          <Link 
            href={`/meetings/${originMeeting.id}`}
            className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
          >
            <span>{originMeeting.title}</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </Link>
        )}
      </div>

      {/* Badges & Meta */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
        <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-semibold">
          <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-extrabold flex items-center justify-center text-[9px] uppercase">
            {task.assignee.slice(0, 2)}
          </div>
          <span>{task.assignee}</span>
        </div>

        <PillBadge priority={task.priority} size="sm" />
      </div>

      {/* Due Date & Source */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-zinc-400" />
          Due {task.dueDate}
        </span>
        <span>
          {task.linkedMemberId
            ? ''
            : task.unlinkedSpeaker
            ? `Unmatched (${task.unlinkedSpeaker})`
            : task.speakerSource && !task.speakerSource.toLowerCase().includes('manual') && task.speakerSource.toLowerCase().includes('speaker')
            ? `Unmatched (${task.speakerSource})`
            : ''}
        </span>
      </div>

      {/* Quick Action Transition Buttons */}
      <div className="pt-2 flex items-center gap-1.5">
        {task.status === 'todo' && (
          <button
            onClick={() => onStatusChange(task.id, 'in_progress')}
            className="w-full py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-200 flex items-center justify-center gap-1 transition-all"
          >
            <span>Move to In Progress</span>
            <ArrowRight className="w-3 h-3 text-amber-600" />
          </button>
        )}

        {task.status === 'in_progress' && (
          <button
            onClick={() => onStatusChange(task.id, 'completed')}
            className="w-full py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-[11px] border border-emerald-200 flex items-center justify-center gap-1 transition-all"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mark Completed</span>
          </button>
        )}

        {task.status === 'completed' && (
          <button
            onClick={() => onStatusChange(task.id, 'todo')}
            className="w-full py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[11px] border border-zinc-200 flex items-center justify-center gap-1 transition-all"
          >
            <RefreshCw className="w-3 h-3 text-zinc-500" />
            <span>Reopen Task</span>
          </button>
        )}
      </div>

    </div>
  );
}
