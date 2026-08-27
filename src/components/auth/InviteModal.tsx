"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
  const { activeOrg } = useAuth();
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Escape key handler
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

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      
      {/* 1. Single full-viewport dim overlay backdrop (bg-black/50, no hard edges or visible borders) */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. Modal Content Card (Captures clicks so card clicks don't close modal) */}
      <div 
        className="relative z-10 w-full max-w-md bg-white dark:bg-[#1C1C21] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 shadow-indigo-500/10 animate-in fade-in zoom-in-95 duration-200"
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
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Invite Teammates</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Workspace: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{activeOrg.name}</span></p>
          </div>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-5 leading-relaxed">
          Share this invite link with your colleagues. Anyone who signs in with Google using this link will automatically join <strong className="text-zinc-900 dark:text-white">{activeOrg.name}</strong> and access team meetings.
        </p>

        {/* Invite Code Display Box */}
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Workspace Invite Code
            </label>
            <div className="px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-center text-lg font-extrabold tracking-wider text-indigo-600 dark:text-indigo-400">
              {inviteCode}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Direct Link
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
        </div>

        {/* RLS Security Note */}
        <div className="mt-6 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/40 flex items-start gap-2.5 text-[11px] text-indigo-900 dark:text-indigo-200">
          <ShieldCheck className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <span>Secured by database-enforced Row-Level Security (RLS). Teammates can only view data within {activeOrg.name}.</span>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
