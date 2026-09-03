"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase, fetchPersonalMemberWorkspaceData } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Organization } from '@/types';

const LEGACY_ORG_ID = '00000000-0000-0000-0000-000000000000';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  activeOrg: Organization | null;
  userOrgs: Organization[];
  isLoading: boolean;
  isRestrictedMember: boolean;
  isFullAccess: boolean;
  personalMemberData: any;
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
  isRestrictedMember: false,
  isFullAccess: true,
  personalMemberData: null,
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
  const [personalMemberData, setPersonalMemberData] = useState<any>(null);
  const [isRestrictedMember, setIsRestrictedMember] = useState<boolean>(false);
  const [isFullAccess, setIsFullAccess] = useState<boolean>(true);
  const [isSplashCompleted, setIsSplashCompleted] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const isLoginPage = window.location.pathname.startsWith('/login');
      if (isLoginPage) {
        setIsSplashCompleted(true);
      }
    }
  }, []);

  // Helper to fetch user's organizations from Supabase
  const loadUserOrganizations = async (userId: string) => {
    if (!supabase) return [];
    try {
      let deletedOrgIds: string[] = [];
      if (typeof window !== 'undefined') {
        try {
          deletedOrgIds = JSON.parse(localStorage.getItem('echoes_deleted_workspace_ids') || '[]');
        } catch (e) {}
      }

      // 0. Proactively delete any legacy demo org membership row for this user
      await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', LEGACY_ORG_ID);

      // 1. Fetch organization memberships for user
      const { data: memberRows, error: memberErr } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userId);

      if (memberErr || !memberRows || memberRows.length === 0) {
        // Zero workspace safeguard: Auto-bind to primary workspace
        const { data: anyOrg } = await supabase
          .from('organizations')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (anyOrg && !deletedOrgIds.includes(anyOrg.id)) {
          console.log(`[AuthProvider Safeguard] Auto-binding user ${userId} to workspace ${anyOrg.name}...`);
          await supabase.from('organization_members').insert({
            organization_id: anyOrg.id,
            user_id: userId,
            role: 'member',
            data_scope: 'assigned_only',
          });

          return [{
            id: anyOrg.id,
            name: anyOrg.name,
            slug: anyOrg.slug,
            inviteCode: anyOrg.invite_code,
            role: 'member' as const,
            createdAt: anyOrg.created_at,
          }];
        }
        return [];
      }

      // Map member roles
      const roleMap = new Map<string, 'owner' | 'admin' | 'member'>();
      memberRows.forEach((m) => {
        roleMap.set(m.organization_id, m.role as any);
      });

      // Filter out legacy org ID and deleted org IDs
      const orgIds = memberRows
        .map((m) => m.organization_id)
        .filter((id) => id !== LEGACY_ORG_ID && !deletedOrgIds.includes(id));

      if (orgIds.length === 0) return [];

      // 2. Fetch organization details
      const { data: orgRows, error: orgErr } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds);

      if (orgErr || !orgRows) return [];

      const orgs: Organization[] = orgRows
        .filter((o) => o.id !== LEGACY_ORG_ID && !deletedOrgIds.includes(o.id))
        .map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          inviteCode: o.invite_code,
          role: roleMap.get(o.id) || 'member',
          createdAt: o.created_at,
        }));

      return orgs;
    } catch (err) {
      console.error('[AuthProvider] Error loading user organizations:', err);
      return [];
    }
  };

  const syncUserPermissions = async (userId: string, orgId?: string, email?: string) => {
    try {
      const data = await fetchPersonalMemberWorkspaceData(userId, orgId, email);
      setPersonalMemberData(data);
      const isOwnerOrAdmin = data.organizationMember?.role === 'owner' || data.organizationMember?.role === 'admin';
      const full = isOwnerOrAdmin || data.dataScope === 'full';
      setIsFullAccess(full);
      setIsRestrictedMember(!full);
      return data;
    } catch (err) {
      console.warn('[AuthProvider] Permission sync error:', err);
      return null;
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
            if (defaultOrg) {
              if (typeof window !== 'undefined') {
                localStorage.setItem('echoes_active_org_id', defaultOrg.id);
              }
              await syncUserPermissions(session.user.id, defaultOrg.id, session.user.email);
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
          if (defaultOrg) {
            if (typeof window !== 'undefined') {
              localStorage.setItem('echoes_active_org_id', defaultOrg.id);
            }
            await syncUserPermissions(session.user.id, defaultOrg.id, session.user.email);
          }
        } catch (orgErr) {
          console.warn('[AuthProvider] Failed to load organizations on auth change:', orgErr);
        }
      } else {
        setUserOrgs([]);
        setActiveOrg(null);
        setPersonalMemberData(null);
        setIsRestrictedMember(false);
        setIsFullAccess(true);
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

  const pathname = usePathname();

  // ROUTE GATING: When splash completes and auth status resolves, redirect unauthenticated users to /login
  useEffect(() => {
    if (isMounted && isSplashCompleted && !isLoading && !user) {
      const publicRoutes = ['/login', '/auth/callback'];
      const isPublic = publicRoutes.some((route) => pathname?.startsWith(route));
      if (!isPublic) {
        console.log('[AuthProvider Gate] Unauthenticated user on protected route:', pathname, '-> Redirecting to /login');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
  }, [isMounted, isSplashCompleted, isLoading, user, pathname]);

  const switchOrg = async (orgId: string) => {
    if (orgId === LEGACY_ORG_ID) return;
    const target = userOrgs.find((o) => o.id === orgId);
    if (target && user) {
      setIsLoading(true);
      setActiveOrg(target);
      if (typeof window !== 'undefined') {
        localStorage.setItem('echoes_active_org_id', target.id);
      }
      await syncUserPermissions(user.id, target.id, user.email);
      setIsLoading(false);
    }
  };

  const refreshOrgs = async () => {
    if (!user || !supabase) return;
    const orgs = await loadUserOrganizations(user.id);
    setUserOrgs(orgs);
    if (!activeOrg && orgs.length > 0) {
      const defaultOrg = selectDefaultOrganization(orgs, null);
      setActiveOrg(defaultOrg);
      if (defaultOrg) {
        await syncUserPermissions(user.id, defaultOrg.id, user.email);
      }
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
        console.error('[AuthProvider createOrg Error]:', error.message);
        return { success: false, error: error.message };
      }

      await refreshOrgs();
      const newOrgId = typeof data === 'string' ? data : data?.id;
      if (newOrgId) {
        switchOrg(newOrgId);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const joinOrgWithCode = async (code: string) => {
    if (!supabase || !user) return { success: false, error: 'Not authenticated' };
    try {
      const res = await supabase.rpc('join_organization_with_code', {
        p_invite_code: code.trim(),
      });

      if (res.error) {
        console.error('[AuthProvider joinOrgWithCode Error]:', res.error.message);
        return { success: false, error: res.error.message };
      }

      await refreshOrgs();
      const joinedOrgId = typeof res.data === 'string' ? res.data : res.data?.id;
      if (joinedOrgId) {
        switchOrg(joinedOrgId);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    try {
      console.log('[AuthProvider] Triggering signOut sequence...');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('echoes_active_org_id');
        localStorage.removeItem('user_organizations');
      }
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setActiveOrg(null);
      setUserOrgs([]);
      setPersonalMemberData(null);
      setIsRestrictedMember(false);
      setIsFullAccess(true);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('[AuthProvider signOut error]:', err);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('echoes_active_org_id');
        window.location.href = '/login';
      }
    }
  };

  // Hard gate: Render minimalist eclipse loader until auth & workspace data loading completes
  if (isMounted && (!isSplashCompleted || isLoading)) {
    return (
      <LogoLoader
        size="fullscreen"
        onComplete={() => {
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
        isRestrictedMember,
        isFullAccess,
        personalMemberData,
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
