"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/components/auth/AuthProvider';
import { acceptPerPersonInviteToken } from '@/lib/supabase/client';
import { ShieldCheck, UserCheck, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const token = params.token as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAcceptInvite = async () => {
    if (!user) {
      // Redirect to login page first
      router.push(`/login?redirectTo=/invite/${token}`);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await acceptPerPersonInviteToken(token);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } else {
      setError(res.error || 'Failed to accept invitation. The invite link may be invalid or expired.');
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-zinc-900 dark:text-zinc-100 selection:bg-indigo-500 selection:text-white flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-[#1C1C21] border border-zinc-200/90 dark:border-zinc-800 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-inner">
            <UserCheck className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs inline-flex items-center gap-1.5 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Per-Person Workspace Invite
            </span>
            <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              You're Invited to Join Workspace
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              Accepting this invitation will bind your account directly to your assigned team profile with restricted data access level.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 text-xs font-medium flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Invitation accepted! Redirecting to Dashboard…</span>
            </div>
          ) : (
            <button
              onClick={handleAcceptInvite}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-hero transition-all flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Binding Identity & Joining…' : 'Accept Invitation & Join Workspace'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400 font-medium">
            🔒 Protected by PostgreSQL Row-Level Security (RLS)
          </div>
        </div>
      </main>
    </div>
  );
}
