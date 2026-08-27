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

      if (inviteCode && inviteCode.trim()) {
        // 1. User is joining an organization via explicit invite code
        console.log(`[Supabase Auth Callback] Joining organization with invite code: ${inviteCode}`);
        const { error: joinErr } = await supabase.rpc('join_organization_with_code', {
          p_invite_code: inviteCode.trim(),
        });
        if (joinErr) {
          console.warn('[Supabase Auth Callback Warning] join_organization_with_code failed:', joinErr.message);
        }
      } else {
        // 2. Check if user already has an organization
        const { data: memberRows } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id);

        if (!memberRows || memberRows.length === 0) {
          const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'My Team';
          const orgName = `${userName}'s Workspace`;
          const orgSlug = `${userName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;

          console.log(`[Supabase Auth Callback] Creating default private workspace "${orgName}" for new user...`);
          const { error: createErr } = await supabase.rpc('create_organization_with_owner', {
            p_name: orgName,
            p_slug: orgSlug,
          });
          if (createErr) {
            console.warn('[Supabase Auth Callback Warning] create_organization_with_owner failed:', createErr.message);
          }
        }
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could%20not%20authenticate%20user`);
}
