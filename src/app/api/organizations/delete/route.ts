import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ success: false, error: 'Missing organizationId parameter' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookies().set(name, value, options);
            } catch (e) {}
          });
        },
      },
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 0. Verify that requesting user is an OWNER of this organization in organization_members
    const { data: memberRow, error: memberErr } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (memberErr || !memberRow || memberRow.role !== 'owner') {
      console.warn(`[API /api/organizations/delete] User ${session.user.id} attempted to delete org ${organizationId} but is not owner (Role: ${memberRow?.role || 'none'})`);
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only the workspace owner can delete this workspace.' },
        { status: 403 }
      );
    }

    console.log(`[API /api/organizations/delete] Executing RPC delete_organization_by_id for org: ${organizationId}`);

    // 1. Call SECURITY DEFINER RPC function
    const { error: rpcErr } = await supabase.rpc('delete_organization_by_id', {
      p_org_id: organizationId,
    });

    if (rpcErr) {
      console.error(`[API /api/organizations/delete] RPC error:`, rpcErr);
      return NextResponse.json({
        success: false,
        error: `RPC Execution Failed: ${rpcErr.message}`,
        details: rpcErr.message,
      }, { status: 500 });
    }

    // 2. Strict Post-Deletion DB Verification: Query organizations table directly to verify row deletion
    const { data: checkOrg, error: checkErr } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .limit(1)
      .maybeSingle();

    if (checkErr) {
      console.error(`[API /api/organizations/delete] Verification query error:`, checkErr);
      return NextResponse.json({
        success: false,
        error: `Post-deletion verification query failed: ${checkErr.message}`,
      }, { status: 500 });
    }

    if (checkOrg) {
      console.error(`[API /api/organizations/delete] Verification Failed: Organization ${organizationId} still exists in organizations table!`);
      return NextResponse.json({
        success: false,
        error: `Verification failed: Workspace record still exists in Supabase DB after RPC call.`,
      }, { status: 500 });
    }

    // 3. Verify organization_members table clean deletion
    const { data: checkMembers } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .limit(1);

    if (checkMembers && checkMembers.length > 0) {
      console.error(`[API /api/organizations/delete] Verification Failed: organization_members still contains rows for org ${organizationId}`);
      return NextResponse.json({
        success: false,
        error: `Verification failed: Organization membership rows still exist in Supabase DB.`,
      }, { status: 500 });
    }

    console.log(`[API /api/organizations/delete] Verified: Organization ${organizationId} cleanly purged from database.`);
    return NextResponse.json({
      success: true,
      message: 'Workspace permanently purged and verified from Supabase DB.',
    });
  } catch (err: any) {
    console.error('[API /api/organizations/delete Exception]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Server error during workspace deletion' },
      { status: 500 }
    );
  }
}
