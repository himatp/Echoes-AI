"use client";

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PillBadge } from '@/components/ui/PillBadge';
import { 
  getStoredTeamMembers, saveTeamMember, deleteTeamMember, 
  getStoredMeetingGroups, saveMeetingGroup, deleteMeetingGroup, clearDemoTeamData,
  fetchAndHydrateTeamFromSupabase
} from '@/lib/store/teamStore';
import { TeamMember, MeetingGroup } from '@/types';
import { 
  Users, UserPlus, FolderPlus, Mail, Shield, Trash2, Edit2, 
  Sparkles, CheckCircle2, User, Layers, Info, RefreshCw, ShieldAlert
} from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';

export default function TeamPage() {
  const { activeOrg } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'groups'>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [groups, setGroups] = useState<MeetingGroup[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Member Modal State
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('');

  // Group Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);

  const refreshData = () => {
    setMembers(getStoredTeamMembers());
    setGroups(getStoredMeetingGroups());
  };

  useEffect(() => {
    refreshData();
    if (activeOrg?.id) {
      fetchAndHydrateTeamFromSupabase(activeOrg.id).then(({ members: m, groups: g }) => {
        setMembers(m);
        setGroups(g);
      });
    }
  }, [activeOrg?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Member Handlers
  const handleOpenMemberModal = (member?: TeamMember) => {
    if (member) {
      setEditingMemberId(member.id);
      setMemberName(member.name);
      setMemberEmail(member.email);
      setMemberRole(member.role || '');
    } else {
      setEditingMemberId(null);
      setMemberName('');
      setMemberEmail('');
      setMemberRole('');
    }
    setIsMemberModalOpen(true);
  };

  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberEmail.trim()) return;
    setSupabaseError(null);

    const existingMember = members.find((m) => m.id === editingMemberId);

    const newMember: TeamMember = {
      id: editingMemberId || `member-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: memberName.trim(),
      email: memberEmail.trim(),
      role: memberRole.trim() || 'Team Member',
      isDemo: existingMember ? existingMember.isDemo : false,
      createdAt: existingMember ? existingMember.createdAt : new Date().toISOString(),
    };

    const res = await saveTeamMember(newMember);
    refreshData();
    setIsMemberModalOpen(false);

    if (res.success) {
      showToast(`Team member "${newMember.name}" saved & synced to Supabase!`);
    } else {
      setSupabaseError(`Supabase Error for member "${newMember.name}": ${res.error}`);
      showToast(`Saved locally. Supabase error: ${res.error}`);
    }
  };

  const handleDeleteMember = async (memberId: string, name: string) => {
    if (window.confirm(`Delete team member "${name}"? Past meeting tasks will retain static historical name.`)) {
      const res = await deleteTeamMember(memberId);
      refreshData();
      if (!res.success) {
        setSupabaseError(`Supabase Delete Error: ${res.error}`);
      }
      showToast(`Team member "${name}" deleted.`);
    }
  };

  // Group Handlers
  const handleOpenGroupModal = (group?: MeetingGroup) => {
    if (group) {
      setEditingGroupId(group.id);
      setGroupName(group.name);
      setSelectedGroupMemberIds(group.memberIds);
    } else {
      setEditingGroupId(null);
      setGroupName('');
      setSelectedGroupMemberIds(members.map((m) => m.id));
    }
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setSupabaseError(null);

    const existingGroup = groups.find((g) => g.id === editingGroupId);

    const newGroup: MeetingGroup = {
      id: editingGroupId || `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: groupName.trim(),
      memberIds: selectedGroupMemberIds,
      isDemo: existingGroup ? existingGroup.isDemo : false,
      createdAt: existingGroup ? existingGroup.createdAt : new Date().toISOString(),
    };

    const res = await saveMeetingGroup(newGroup);
    refreshData();
    setIsGroupModalOpen(false);

    if (res.success) {
      showToast(`Meeting group "${newGroup.name}" saved & synced to Supabase!`);
    } else {
      setSupabaseError(`Supabase Error for group "${newGroup.name}": ${res.error}`);
      showToast(`Saved locally. Supabase error: ${res.error}`);
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (window.confirm(`Delete group "${name}"?`)) {
      const res = await deleteMeetingGroup(groupId);
      refreshData();
      if (!res.success) {
        setSupabaseError(`Supabase Delete Error: ${res.error}`);
      }
      showToast(`Group "${name}" deleted.`);
    }
  };

  const handleClearDemoData = () => {
    if (window.confirm('Remove all default demo contacts and groups? Real members will be kept.')) {
      clearDemoTeamData();
      refreshData();
      showToast('Demo contacts & groups removed!');
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <Navbar />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-zinc-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2.5 border border-zinc-700 animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5 sm:gap-3 leading-tight">
              <Users className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span>Team Members & Meeting Groups</span>
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={handleClearDemoData}
              className="w-full sm:w-auto px-3.5 py-2.5 min-h-[44px] rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>Clear Demo Data</span>
            </button>

            <button
              onClick={() => handleOpenMemberModal()}
              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-hero flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <UserPlus className="w-4 h-4 flex-shrink-0" />
              <span>+ Add Team Member</span>
            </button>

            <button
              onClick={() => handleOpenGroupModal()}
              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <FolderPlus className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>+ Create Group</span>
            </button>
          </div>
        </div>

        {/* Remote Sync Error Alert Banner */}
        {supabaseError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200 text-xs font-medium flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-900 dark:text-red-200 mb-0.5">Database Sync Alert</p>
                <p className="text-red-800 dark:text-red-300 font-mono text-[11px] leading-relaxed">{supabaseError}</p>
                <p className="text-red-800 dark:text-red-300 mt-1 font-semibold">
                  👉 Make sure you have created the <code className="bg-red-100 dark:bg-red-900/60 px-1 py-0.5 rounded">team_members</code> and <code className="bg-red-100 dark:bg-red-900/60 px-1 py-0.5 rounded">meeting_groups</code> tables in your Supabase SQL Editor!
                </p>
              </div>
            </div>
            <button
              onClick={() => setSupabaseError(null)}
              className="text-red-400 hover:text-red-700 dark:hover:text-white font-bold"
            >
              &times;
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'members'
                ? 'bg-zinc-900 dark:bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Team Members ({members.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'groups'
                ? 'bg-zinc-900 dark:bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Meeting Groups ({groups.length})</span>
          </button>
        </div>

        {/* TAB 1: TEAM MEMBERS DIRECTORY */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => (
              <div 
                key={member.id}
                className="card-white p-5 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-500 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-extrabold flex items-center justify-center text-sm uppercase shadow-sm">
                        {member.name.slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-snug">{member.name}</h3>
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{member.role || 'Team Member'}</span>
                      </div>
                    </div>

                    {member.isDemo && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                        Demo Contact
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => handleOpenMemberModal(member)}
                    className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDeleteMember(member.id, member.name)}
                    className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-xs font-bold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: REUSABLE MEETING GROUPS */}
        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => {
              const groupMembers = members.filter((m) => group.memberIds.includes(m.id));
              return (
                <div 
                  key={group.id}
                  className="card-white p-5 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-500 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-bold text-base text-zinc-900 dark:text-white leading-snug">{group.name}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                          {groupMembers.length} Members Assigned
                        </p>
                      </div>

                      {group.isDemo && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                          Demo Group
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 my-3 max-h-36 overflow-y-auto pr-1">
                      {groupMembers.map((m) => (
                        <div key={m.id} className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 text-xs flex items-center justify-between">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{m.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">{m.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      onClick={() => handleOpenGroupModal(group)}
                      className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Group</span>
                    </button>

                    <button
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-xs font-bold transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MEMBER MODAL */}
        {isMemberModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#1C1C21] rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 my-auto">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingMemberId ? 'Edit Team Member' : 'Add New Team Member'}
              </h3>

              <form onSubmit={handleSaveMember} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Chen"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. sarah@echoes.dev"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Role (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Architect"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMemberModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-hero"
                  >
                    Save Contact
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* GROUP MODAL */}
        {isGroupModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#1C1C21] rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {editingGroupId ? 'Edit Meeting Group' : 'Create Meeting Group'}
              </h3>

              <form onSubmit={handleSaveGroup} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Group Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Leadership Team, Engineering Standup"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Select Group Members</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    {members.map((m) => {
                      const isChecked = selectedGroupMemberIds.includes(m.id);
                      return (
                        <label key={m.id} className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedGroupMemberIds(selectedGroupMemberIds.filter((id) => id !== m.id));
                              } else {
                                setSelectedGroupMemberIds([...selectedGroupMemberIds, m.id]);
                              }
                            }}
                            className="rounded accent-indigo-600 w-4 h-4"
                          />
                          <span>{m.name} ({m.email})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsGroupModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-hero"
                  >
                    Save Group
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
