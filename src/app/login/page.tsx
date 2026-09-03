"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Sparkles, ShieldCheck, Users, ArrowRight, Lock, KeyRound } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import LogoLoader from '@/components/ui/LogoLoader';
import AmbientIcons from '@/components/ui/AmbientIcons';

function LoginForm() {
  const searchParams = useSearchParams();
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const inviteParam = searchParams.get('invite');
    const errorParam = searchParams.get('error');
    if (inviteParam) {
      setInviteCode(inviteParam.toUpperCase());
    }
    if (errorParam) {
      setErrorMessage(errorParam);
    }
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setErrorMessage('Supabase client environment variables are not configured in .env.local');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback${
        inviteCode.trim() ? `?invite=${encodeURIComponent(inviteCode.trim())}` : ''
      }`;

      console.log(`[Google OAuth Login] Initiating OAuth flow redirecting to ${redirectUrl}...`);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setIsLoading(false);
        if (error.message.includes('provider is not enabled')) {
          setErrorMessage('Google Sign-In is not enabled yet in your Supabase Dashboard. Go to Supabase Dashboard -> Authentication -> Providers -> Google, toggle it ON, and paste your Google Client ID & Secret.');
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      if (data?.url) {
        console.log(`[Google OAuth Login] Redirecting browser to: ${data.url}`);
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('[Google OAuth Exception]', err);
      setIsLoading(false);
      setErrorMessage(err?.message || 'An unexpected error occurred during Google sign-in.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {isLoading && (
        <LogoLoader size="fullscreen" />
      )}
      {/* Dynamic Background Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Reusable Low-Opacity Ambient Floating Icons (Icons only) */}
      <AmbientIcons />

      <div className="w-full max-w-md relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs font-bold mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI-Powered Meeting Intelligence</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
            Echoes Workspace
          </h1>
          <p className="text-sm text-zinc-400 font-normal max-w-xs mx-auto">
            Secure, multi-tenant meeting notes, speaker matching, and task automation.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-900/80 text-red-200 text-xs font-medium leading-relaxed flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Invite Code Input (Optional) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span>Workspace Invite Code (Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. DEMO123456"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 transition-all uppercase placeholder-zinc-600"
            />
            {inviteCode.trim() && (
              <p className="text-[11px] text-emerald-400 font-semibold mt-1.5">
                ✓ You will automatically join workspace <code className="bg-emerald-950 px-1 py-0.5 rounded">{inviteCode.trim()}</code> upon Google sign-in.
              </p>
            )}
          </div>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full min-h-[52px] py-3.5 px-5 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="text-zinc-600 font-semibold text-xs">Redirecting to Google OAuth...</span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4 text-zinc-600" />
              </>
            )}
          </button>

          <div className="pt-4 border-t border-zinc-800/80 space-y-2.5 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>Multi-tenant Row-Level Security (RLS) enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Isolated team data containers & instant invite code links</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg animate-pulse">
            <span className="text-white font-extrabold text-xl tracking-tighter">E</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
