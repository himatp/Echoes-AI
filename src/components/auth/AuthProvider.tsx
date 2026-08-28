"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Organization } from '@/types';

const LEGACY_ORG_ID = '00000000-0000-0000-0000-000000000000';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  activeOrg: Organization | null;
  userOrgs: Organization[];
  isLoading: boolean;
  switchOrg: (orgId: string) => void;
  createOrg: (name: string, slug: string) => Promise<{ success: boolean; error?: string }>;
  joinOrgWithCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshOrgs: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  activeOrg: null,
  userOrgs: [],
  isLoading: true,
  switchOrg: () => {},
  createOrg: async () => ({ success: false }),
  joinOrgWithCode: async () => ({ success: false }),
  signOut: async () => {},
  refreshOrgs: async () => {},
});

function selectDefaultOrganization(orgs: Organization[], savedOrgId: string | null): Organization | null {
  if (!orgs || orgs.length === 0) return null;

  // Filter out any legacy org if present
  const validOrgs = orgs.filter((o) => o.id !== LEGACY_ORG_ID);
  if (validOrgs.length === 0) return null;

  if (savedOrgId && savedOrgId !== LEGACY_ORG_ID) {
    const saved = validOrgs.find((o) => o.id === savedOrgId);
    if (saved) return saved;
  }
  return validOrgs[0] || null;
}

import LogoLoader from '@/components/ui/LogoLoader';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSplashCompleted, setIsSplashCompleted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('echoes_splash_completed') === 'true';
    }
    return false;
  });

  // Helper to fetch user's organizations from Supabase
  const loadUserOrganizations = async (userId: string) => {
    if (!supabase) return [];
    try {
      // 0. Proactively delete any legacy demo org membership row for this user
      await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', LEGACY_ORG_ID);

      // 1. Fetch organization memberships for user
      const { data: memberRows, error: memberErr } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId);

      if (memberErr || !memberRows || memberRows.length === 0) {
        return [];
      }

      // Filter out legacy org ID
      const orgIds = memberRows
        .map((m) => m.organization_id)
        .filter((id) => id !== LEGACY_ORG_ID);

      if (orgIds.length === 0) return [];

      // 2. Fetch organization details
      const { data: orgRows, error: orgErr } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds);

      if (orgErr || !orgRows) return [];

      const orgs: Organization[] = orgRows
        .filter((o) => o.id !== LEGACY_ORG_ID)
        .map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          inviteCode: o.invite_code,
          createdAt: o.created_at,
        }));

      return orgs;
    } catch (err) {
      console.error('[AuthProvider] Error loading user organizations:', err);
      return [];
    }
  };

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Safety fallback: Guarantee isLoading resolves to false within 3 seconds max under any network condition
    const safetyTimer = setTimeout(() => {
      console.warn('[AuthProvider] Auth session initialization timeout fallback reached. Unlocking app.');
      setIsLoading(false);
    }, 3000);

    // Clear legacy active org from localStorage if stored
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echoes_active_org_id');
      if (saved === LEGACY_ORG_ID) {
        localStorage.removeItem('echoes_active_org_id');
      }
    }

    // Initialize Auth Session safely with error handling and finally block
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            const orgs = await loadUserOrganizations(session.user.id);
            setUserOrgs(orgs);

            const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('echoes_active_org_id') : null;
            const defaultOrg = selectDefaultOrganization(orgs, savedOrgId);
            setActiveOrg(defaultOrg);
            if (defaultOrg && typeof window !== 'undefined') {
              localStorage.setItem('echoes_active_org_id', defaultOrg.id);
            }
          } catch (orgErr) {
            console.warn('[AuthProvider] Failed to load organizations:', orgErr);
          }
        }
      })
      .catch((err) => {
        console.warn('[AuthProvider] Supabase auth session check failed:', err);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        setIsLoading(false);
      });

    // Listen for auth changes (sign in, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthProvider] Auth State Change: ${event}`);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          const orgs = await loadUserOrganizations(session.user.id);
          setUserOrgs(orgs);

          const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('echoes_active_org_id') : null;
          const defaultOrg = selectDefaultOrganization(orgs, savedOrgId);
          setActiveOrg(defaultOrg);
          if (defaultOrg && typeof window !== 'undefined') {
            localStorage.setItem('echoes_active_org_id', defaultOrg.id);
          }
        } catch (orgErr) {
          console.warn('[AuthProvider] Failed to load organizations on auth change:', orgErr);
        }
      } else {
        setUserOrgs([]);
        setActiveOrg(null);
        // CRITICAL FIX: Only remove active org ID on explicit SIGNED_OUT event!
        // Do NOT clear on transient INITIAL_SESSION null states during page refresh token hydration.
        if (event === 'SIGNED_OUT' && typeof window !== 'undefined') {
          console.log('[AuthProvider] Explicit SIGNED_OUT event. Clearing active org ID from localStorage.');
          localStorage.removeItem('echoes_active_org_id');
        }
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const switchOrg = (orgId: string) => {
    if (orgId === LEGACY_ORG_ID) return;
    const target = userOrgs.find((o) => o.id === orgId);
    if (target) {
      setActiveOrg(target);
      if (typeof window !== 'undefined') {
        localStorage.setItem('echoes_active_org_id', target.id);
      }
    }
  };

  const refreshOrgs = async () => {
    if (!user || !supabase) return;
    const orgs = await loadUserOrganizations(user.id);
    setUserOrgs(orgs);
    if (!activeOrg && orgs.length > 0) {
      const defaultOrg = selectDefaultOrganization(orgs, null);
      setActiveOrg(defaultOrg);
    }
  };

  const createOrg = async (name: string, slug: string) => {
    if (!supabase || !user) return { success: false, error: 'Not authenticated' };
    try {
      const { data, error } = await supabase.rpc('create_organization_with_owner', {
        p_name: name.trim(),
        p_slug: slug.trim().toLowerCase(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      await refreshOrgs();
      if (data && data.id) {
        switchOrg(data.id);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const joinOrgWithCode = async (code: string) => {
    if (!supabase || !user) return { success: false, error: 'Not authenticated' };
    try {
      const { data, error } = await supabase.rpc('join_organization_with_code', {
        p_invite_code: code.trim(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      await refreshOrgs();
      if (data && data.id) {
        switchOrg(data.id);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('echoes_active_org_id');
      window.location.href = '/login';
    }
  };

  // Hard gate: Do not mount or render child components until auth is resolved AND splash onComplete has fired
  if (isLoading || !isSplashCompleted) {
    return (
      <LogoLoader
        size="fullscreen"
        onComplete={() => {
          console.log('[AuthProvider Hard Gate] Splash screen sequence onComplete fired. Unlocking app render.');
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('echoes_splash_completed', 'true');
          }
          setIsSplashCompleted(true);
        }}
      />
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        activeOrg,
        userOrgs,
        isLoading,
        switchOrg,
        createOrg,
        joinOrgWithCode,
        signOut,
        refreshOrgs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
