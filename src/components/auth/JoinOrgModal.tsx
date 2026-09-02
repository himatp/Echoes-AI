"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, KeyRound, Check, AlertTriangle, RefreshCw, Sparkles, Building2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { joinOrganizationByCodeFromSupabase } from '@/lib/supabase/client';

interface JoinOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinOrgModal: React.FC<JoinOrgModalProps> = ({ isOpen, onClose }) => {
  const { user, refreshOrgs, switchOrg } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnosticDetails, setDiagnosticDetails] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!isOpen || !mounted) return null;

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setErrorMessage('Please enter a valid workspace invite code.');
      return;
    }

    if (!user?.id) {
      setErrorMessage('You must be signed in to join a workspace.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setDiagnosticDetails(null);
    setSuccessMessage(null);

    const res = await joinOrganizationByCodeFromSupabase(inviteCode, user.id);
    setLoading(false);

    if (res.success && res.organizationId) {
      setSuccessMessage(`✓ Joined workspace "${res.orgName || inviteCode}" successfully!`);
      await refreshOrgs();
      switchOrg(res.organizationId);

      setTimeout(() => {
        setInviteCode('');
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } else {
      setErrorMessage(res.error || 'Failed to join workspace.');
      if (res.diagnosticDetails) {
        setDiagnosticDetails(res.diagnosticDetails);
      }
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content Card */}
      <div 
        className="relative z-10 w-full max-w-md bg-white dark:bg-[#1C1C21] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 shadow-indigo-500/10 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Join Workspace</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Enter invite code to join a team</p>
          </div>
        </div>

        <form onSubmit={handleJoinWorkspace} className="space-y-4">
          
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/80 text-red-800 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {diagnosticDetails && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/80 text-amber-900 dark:text-amber-200 text-[11px] font-mono leading-relaxed space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300 uppercase tracking-wider text-[10px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Diagnostic Cause Report</span>
              </p>
              <p className="break-all opacity-90">{diagnosticDetails}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Workspace Invite Code
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 238a859a1f or LEGACY00"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <p className="text-[11px] text-zinc-400 mt-1.5">
              Ask your workspace owner for their 8-character invite code.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !inviteCode.trim()}
            className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Joining Workspace…</span>
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4" />
                <span>Join & Switch Workspace</span>
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
