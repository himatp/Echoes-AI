import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const inviteCode = requestUrl.searchParams.get('invite');
  const origin = requestUrl.origin;

  if (code) {
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    let response = NextResponse.redirect(`${origin}/`);

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session?.user) {
      const user = session.user;
      console.log(`[Supabase Auth Callback] Session established for user ${user.email} (${user.id})`);

      let joinedOrgId: string | null = null;

      if (inviteCode && inviteCode.trim()) {
        const cleanCode = inviteCode.trim();
        console.log(`[Supabase Auth Callback] Attempting to join workspace with invite code: ${cleanCode}`);

        // 1. Try RPC join_organization_with_code
        const { error: joinErr } = await supabase.rpc('join_organization_with_code', {
          p_invite_code: cleanCode,
        });

        if (joinErr) {
          console.warn('[Supabase Auth Callback Warning] RPC join_organization_with_code failed, attempting direct table insert fallback:', joinErr.message);
        }

        // 2. Direct table fallback: Query organization by invite_code
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id, name')
          .or(`invite_code.eq.${cleanCode},id.eq.${cleanCode}`)
          .limit(1)
          .maybeSingle();

        if (orgData) {
          joinedOrgId = orgData.id;

          // Check if organization member row exists
          const { data: existingOm } = await supabase
            .from('organization_members')
            .select('id')
            .eq('organization_id', orgData.id)
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (!existingOm) {
            console.log(`[Supabase Auth Callback] Inserting organization_member row for user ${user.id} in org ${orgData.name}...`);
            await supabase.from('organization_members').insert({
              organization_id: orgData.id,
              user_id: user.id,
              role: 'member',
              data_scope: 'assigned_only',
            });
          }

          // Link matching team_members row if present
          if (user.email) {
            await supabase
              .from('team_members')
              .update({ user_id: user.id })
              .or(`email.eq.${user.email},invite_token.eq.${cleanCode}`)
              .eq('organization_id', orgData.id);
          }
        }
      }

      // 3. Guarantee user has at least 1 organization membership row so they are NEVER redirected to /login!
      const { data: memberRows } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);

      if (!memberRows || memberRows.length === 0) {
        // Find existing organization to join or create new
        const { data: anyOrg } = await supabase
          .from('organizations')
          .select('id, name')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        const targetOrgId = joinedOrgId || anyOrg?.id;

        if (targetOrgId) {
          console.log(`[Supabase Auth Callback Safeguard] Binding user ${user.id} to workspace ${targetOrgId}...`);
          await supabase.from('organization_members').insert({
            organization_id: targetOrgId,
            user_id: user.id,
            role: 'member',
            data_scope: 'assigned_only',
          });
        } else {
          // Create default workspace
          const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'My Team';
          const orgName = `${userName}'s Workspace`;
          const orgSlug = `${userName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;

          console.log(`[Supabase Auth Callback] Creating workspace "${orgName}" for user ${user.id}...`);
          await supabase.rpc('create_organization_with_owner', {
            p_name: orgName,
            p_slug: orgSlug,
          });
        }
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could%20not%20authenticate%20user`);
}
