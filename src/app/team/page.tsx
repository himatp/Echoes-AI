"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { PillBadge } from '@/components/ui/PillBadge';
import { 
  getStoredTeamMembers, saveTeamMember, deleteTeamMember, 
  getStoredMeetingGroups, saveMeetingGroup, deleteMeetingGroup,
  fetchAndHydrateTeamFromSupabase
} from '@/lib/store/teamStore';
import { OrganizationMember, TeamMember, MeetingGroup, DataScope } from '@/types';
import { 
  Users, UserPlus, FolderPlus, Mail, Shield, Trash2, Edit2, 
  Sparkles, CheckCircle2, User, Layers, Info, ShieldAlert, AlertTriangle, Link as LinkIcon, Lock, Zap, LockKeyhole
} from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import { 
  updateTeamMemberDataScope, updateOrganizationMemberDataScope, 
  fetchOrganizationMembersFromSupabase, fetchPersonalMemberWorkspaceData
} from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function TeamPage() {
  const router = useRouter();
  const { activeOrg, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'groups'>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [groups, setGroups] = useState<MeetingGroup[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Role Guard: Redirect invited teammates away from Team & Groups page
  useEffect(() => {
    if (user?.id) {
      fetchPersonalMemberWorkspaceData(user.id).then((data) => {
        const isOwnerOrAdmin = data.organizationMember?.role === 'owner' || data.organizationMember?.role === 'admin';
        if (data.dataScope === 'assigned_only' && !isOwnerOrAdmin) {
          router.push('/');
        }
      });
    }
  }, [user?.id, router]);

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
      fetchOrganizationMembersFromSupabase(activeOrg.id).then((om) => {
        setOrgMembers(om);
      });
    }
  }, [activeOrg?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDataScopeChange = async (member: TeamMember, newScope: DataScope) => {
    const isOwner = member.email.toLowerCase() === user?.email?.toLowerCase() && 
                    orgMembers.some((om) => om.userId === user?.id && om.role === 'owner');

    if (isOwner) {
      showToast('⚠️ Workspace Owners are forced to Full Workspace Access.');
      return;
    }

    const res = await updateTeamMemberDataScope(member.id, newScope, member.userId);
    if (res.success) {
      setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, dataScope: newScope } : m));
      if (member.userId) {
        setOrgMembers((prev) => prev.map((om) => om.userId === member.userId ? { ...om, dataScope: newScope } : om));
      }
      showToast(`Data access level for ${member.name} updated to "${newScope === 'full' ? 'Full Access' : 'Assigned Items Only'}"`);
    } else {
      showToast(`Failed to update data scope: ${res.error}`);
    }
  };

  const handleCopyInviteLink = (member: TeamMember) => {
    const token = member.inviteToken || member.id;
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    showToast(`Copied per-person invite link for ${member.name}! (Restricted Access default)`);
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
    if (members.length === 0) {
      showToast('Please add team members first before creating a group.');
      return;
    }
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
              onClick={() => handleOpenMemberModal()}
              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-hero flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <UserPlus className="w-4 h-4 flex-shrink-0" />
              <span>Add Team Member</span>
            </button>

            <button
              onClick={() => handleOpenGroupModal()}
              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <FolderPlus className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>Create Group</span>
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
            {members.map((member) => {
              const om = orgMembers.find((m) => (member.userId && m.userId === member.userId) || m.userId === member.id);
              const isOwner = member.email.toLowerCase() === user?.email?.toLowerCase() && 
                              orgMembers.some((m) => m.userId === user?.id && m.role === 'owner');
              const currentScope: DataScope = isOwner ? 'full' : (member.dataScope || om?.dataScope || 'full');

              return (
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-snug">{member.name}</h3>
                            {member.isDemo && (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[9px] font-bold">
                                Demo
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{member.role || 'Team Member'}</span>
                        </div>
                      </div>

                      {/* Top-Right Icon Action Bar */}
                      <div className="flex items-center gap-1.5">
                        {/* Copy Invite Link Icon */}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleCopyInviteLink(member)}
                          className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-300 flex items-center justify-center transition-colors shadow-sm"
                          title="Copy per-person invite link (Restricted Scope)"
                          aria-label="Copy per-person invite link"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </motion.button>

                        {/* Edit Member Icon */}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleOpenMemberModal(member)}
                          className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-colors shadow-sm"
                          title="Edit Member Details"
                          aria-label="Edit Member Details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </motion.button>

                        {/* Delete Member Icon */}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteMember(member.id, member.name)}
                          className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/70 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors shadow-sm"
                          title="Delete Member"
                          aria-label="Delete Member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-300 flex items-center gap-2 mb-3">
                      <Mail className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>

                    {/* Compact & Mobile-Friendly Data Access Switch */}
                    <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/90 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Shield className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Data Scope</span>
                          
                          {isOwner ? (
                            <motion.span 
                              whileHover={{ scale: 1.05, rotate: [0, -4, 4, 0] }}
                              transition={{ duration: 0.3 }}
                              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 truncate cursor-help group/lock"
                              title="Workspace Owners are permanently assigned Full Workspace Access"
                            >
                              <Lock className="w-3 h-3 text-amber-500 group-hover/lock:rotate-12 transition-transform" />
                              Forced Full Access
                            </motion.span>
                          ) : (
                            <motion.span
                              key={currentScope}
                              initial={{ opacity: 0, x: -3 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`inline-flex items-center gap-1 text-[11px] font-extrabold transition-colors duration-200 ${
                                currentScope === 'full'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {currentScope === 'full' ? (
                                <>
                                  <Zap className="w-3 h-3 text-emerald-500 animate-pulse" />
                                  Full Workspace Access
                                </>
                              ) : (
                                <>
                                  <LockKeyhole className="w-3 h-3 text-amber-500" />
                                  Assigned Items Only
                                </>
                              )}
                            </motion.span>
                          )}
                        </div>
                      </div>

                      {/* Dribbble Fluid Elastic Toggle Switch Track */}
                      <motion.button
                        type="button"
                        disabled={isOwner}
                        onClick={() => handleDataScopeChange(member, currentScope === 'full' ? 'assigned_only' : 'full')}
                        whileTap={{ scale: isOwner ? 1 : 0.92 }}
                        whileHover={{ scale: isOwner ? 1 : 1.06 }}
                        aria-label="Toggle Data Scope Access Level"
                        className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full p-1 border transition-colors duration-300 focus:outline-none overflow-hidden ${
                          isOwner
                            ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 cursor-not-allowed opacity-80'
                            : currentScope === 'full'
                            ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 border-emerald-400/80 shadow-lg shadow-emerald-500/25'
                            : 'bg-zinc-800 dark:bg-zinc-800/90 border-zinc-600 dark:border-zinc-700 shadow-inner'
                        }`}
                      >
                        {/* Animated Dribbble Radial Burst Glow Ripple */}
                        <motion.span
                          key={`ripple-${currentScope}`}
                          initial={{ scale: 0.2, opacity: 0.8 }}
                          animate={{ scale: 2.5, opacity: 0 }}
                          transition={{ duration: 0.45, ease: 'easeOut' }}
                          className={`absolute inset-0 rounded-full pointer-events-none ${
                            currentScope === 'full' ? 'bg-emerald-400/40' : 'bg-amber-500/30'
                          }`}
                        />

                        {/* Fluid Elastic Morphing Knob */}
                        <motion.span
                          initial={false}
                          animate={{
                            x: currentScope === 'full' ? 24 : 0,
                            scaleX: [1, 1.35, 1],
                            scaleY: [1, 0.75, 1],
                          }}
                          transition={{ 
                            type: 'spring', 
                            stiffness: 500, 
                            damping: 22, 
                            mass: 0.8 
                          }}
                          className="pointer-events-none relative z-10 inline-block h-6 w-6 rounded-full bg-white shadow-xl flex items-center justify-center"
                        >
                          <motion.div
                            key={`icon-${currentScope}`}
                            initial={{ rotate: currentScope === 'full' ? -180 : 180, scale: 0.5, opacity: 0 }}
                            animate={{ rotate: 0, scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 600, damping: 25 }}
                          >
                            {currentScope === 'full' ? (
                              <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-500" />
                            ) : (
                              <LockKeyhole className="w-3.5 h-3.5 text-amber-600" />
                            )}
                          </motion.div>
                        </motion.span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: REUSABLE MEETING GROUPS */}
        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => {
              const groupMembers = members.filter((m) => {
                if (!group.memberIds || group.memberIds.length === 0) return false;
                return group.memberIds.some((idOrVal) => {
                  if (!idOrVal) return false;
                  const cleanVal = idOrVal.toLowerCase().trim();
                  return (
                    m.id.toLowerCase() === cleanVal ||
                    (m.name && m.name.toLowerCase().trim() === cleanVal) ||
                    (m.email && m.email.toLowerCase().trim() === cleanVal) ||
                    cleanVal.includes(m.name?.toLowerCase()) ||
                    cleanVal.includes(m.id.toLowerCase())
                  );
                });
              });
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
                  {members.length === 0 ? (
                    <div className="p-4 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-medium space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-extrabold text-amber-800 dark:text-amber-300 text-xs mb-0.5">No Team Members Available</p>
                          <p className="text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
                            You must add team members to your organization first before you can create a meeting group.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsGroupModalOpen(false);
                          handleOpenMemberModal();
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      >
                        <UserPlus className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Add First Team Member</span>
                      </button>
                    </div>
                  ) : (
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
                  )}
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
                    disabled={members.length === 0}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-hero"
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
