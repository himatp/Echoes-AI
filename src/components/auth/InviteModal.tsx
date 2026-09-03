"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Users, ShieldCheck, UserMinus, RefreshCw, AlertTriangle, LockKeyhole, Sparkles } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { TeamMember } from '@/types';
import { getStoredTeamMembers, deleteTeamMember } from '@/lib/store/teamStore';
import { fetchTeamMembersFromSupabase, revokeTeammateAccessFromSupabase } from '@/lib/supabase/client';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
  const { activeOrg } = useAuth();
  const [activeTab, setActiveTab] = useState<'invite' | 'manage'>('invite');
  const [copied, setCopied] = useState(false);
  const [perPersonCopiedId, setPerPersonCopiedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hydrate Team Members list when modal is open
  useEffect(() => {
    if (isOpen && activeOrg?.id) {
      // 1. Initial local store hydration
      setTeamMembers(getStoredTeamMembers());

      // 2. Live Supabase DB fetch
      fetchTeamMembersFromSupabase(activeOrg.id).then((members) => {
        if (members && members.length > 0) {
          setTeamMembers(members);
        }
      });
    }
  }, [isOpen, activeOrg?.id]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !activeOrg || !mounted) return null;

  const inviteCode = activeOrg.inviteCode || 'LEGACY00';
  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/login?invite=${encodeURIComponent(inviteCode)}`
    : `http://localhost:3000/login?invite=${encodeURIComponent(inviteCode)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyPerPersonLink = (member: TeamMember) => {
    const token = member.inviteToken || `token-${member.id}`;
    const perPersonUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/invite/${encodeURIComponent(token)}`
      : `http://localhost:3000/invite/${encodeURIComponent(token)}`;

    navigator.clipboard.writeText(perPersonUrl);
    setPerPersonCopiedId(member.id);
    setTimeout(() => setPerPersonCopiedId(null), 2500);
  };

  // Revoke Teammate Access Handler
  const handleRevokeAccess = async (member: TeamMember) => {
    if (!confirm(`Are you sure you want to revoke access for ${member.name}? They will immediately be cut off from viewing your workspace, meetings, and tasks, but will remain listed in your Team Members directory.`)) {
      return;
    }

    setRevokingId(member.id);
    setToastMessage(null);

    // Revoke workspace access in Supabase DB without deleting team_members profile
    const res = await revokeTeammateAccessFromSupabase(member.id, member.userId);
    setRevokingId(null);

    if (res.success) {
      setTeamMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, userId: undefined, dataScope: 'revoked' as any } : m
        )
      );
      setToastMessage({
        text: `✓ Access revoked for ${member.name}. They remain in your team list with revoked access.`,
        type: 'success',
      });
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage({
        text: res.error || `Failed to revoke access for ${member.name}.`,
        type: 'error',
      });
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      
      {/* 1. Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. Modal Content Card */}
      <div 
        className="relative z-10 w-full max-w-lg bg-white dark:bg-[#1C1C21] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 shadow-indigo-500/10 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Visible × Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Invite & Manage Teammates</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Workspace: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{activeOrg.name}</span></p>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mb-4">
          <button
            onClick={() => setActiveTab('invite')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'invite'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            🔗 Copy Invite Link
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'manage'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <span>👥 Active Teammates</span>
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[10px] font-mono font-bold">
              {teamMembers.length}
            </span>
          </button>
        </div>

        {/* Toast Notification Banner inside Modal */}
        {toastMessage && (
          <div
            className={`mb-4 p-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/70 border-red-300 text-red-900 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {/* TAB 1: COPY INVITE LINK */}
        {activeTab === 'invite' && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Share your general workspace invite link or generate individual per-person links for restricted team members.
            </p>

            {/* General Workspace Invite Code */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Workspace Invite Code
              </label>
              <div className="px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-center text-lg font-extrabold tracking-wider text-indigo-600 dark:text-indigo-400">
                {inviteCode}
              </div>
            </div>

            {/* Direct General Link */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                General Invite Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex-shrink-0 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* RLS Security Note */}
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/40 flex items-start gap-2.5 text-[11px] text-indigo-900 dark:text-indigo-200">
              <ShieldCheck className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span>Protected by Row-Level Security (RLS). Invited members can only see data within {activeOrg.name}.</span>
            </div>
          </div>
        )}

        {/* TAB 2: MANAGE ACTIVE TEAMMATES & REVOKE ACCESS */}
        {activeTab === 'manage' && (
          <div className="space-y-3 overflow-y-auto pr-1 max-h-80">
            {teamMembers.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                No teammates added yet. Share your invite link to add team members.
              </div>
            ) : (
              teamMembers.map((member) => {
                const isJoined = Boolean(member.userId);
                return (
                  <div
                    key={member.id}
                    className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 hover:border-indigo-300 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                            {member.name}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-semibold">
                            ({member.role || 'Member'})
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[9px] font-extrabold border ${
                              member.dataScope === 'revoked'
                                ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                                : isJoined
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {member.dataScope === 'revoked' ? '🚫 Revoked' : isJoined ? '✓ Joined' : '⏳ Pending'}
                          </span>
                        </div>

                        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Copy Per-Person Link Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyPerPersonLink(member)}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-bold transition-all flex items-center gap-1.5"
                        title="Copy invite link to restore access"
                      >
                        {perPersonCopiedId === member.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Link Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{member.dataScope === 'revoked' ? 'Grant Access' : 'Copy Link'}</span>
                          </>
                        )}
                      </button>

                      {/* Revoke Access Button (Only shown if currently joined/active) */}
                      {isJoined && member.dataScope !== 'revoked' && (
                        <button
                          type="button"
                          disabled={revokingId === member.id}
                          onClick={() => handleRevokeAccess(member)}
                          className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white border border-red-500/20 text-[11px] font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                          title="Revoke access and block workspace view for this member"
                        >
                          {revokingId === member.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserMinus className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">Revoke Access</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
