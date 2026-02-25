import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOrgMembership } from '@/lib/org/middleware';
import { canManageMembers } from '@/lib/org/rbac';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** GET /api/org/members — list all members of the current user's org */
export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  try {
    const membership = await requireOrgMembership(req.headers.get('authorization'));

    const { data: members, error } = await supabase
      .from('org_members')
      .select('id, user_id, role, department, status, created_at')
      .eq('org_id', membership.orgId)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ members: members ?? [] });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

/** POST /api/org/members — invite a member (by email or user_id) */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  try {
    const membership = await requireOrgMembership(req.headers.get('authorization'));

    if (!canManageMembers(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions — admin or owner required' }, { status: 403 });
    }

    const body = await req.json();
    const { email, user_id, role = 'member', department } = body as {
      email?: string;
      user_id?: string;
      role?: string;
      department?: string;
    };

    if (!email && !user_id) {
      return NextResponse.json({ error: 'email or user_id is required' }, { status: 400 });
    }

    const validRoles = ['admin', 'manager', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    let resolvedUserId = user_id;

    // Resolve user_id from email if needed
    if (!resolvedUserId && email) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .limit(1);
      if (users && users.length > 0) {
        resolvedUserId = users[0].id;
      }
    }

    if (!resolvedUserId) {
      // Insert as pending invite with email
      const { data: invite, error: inviteError } = await supabase
        .from('org_members')
        .insert({
          org_id: membership.orgId,
          role,
          department: department ?? null,
          status: 'invited',
          invited_email: email,
          invited_by: membership.userId,
        })
        .select()
        .single();

      if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });
      return NextResponse.json({ member: invite, invited: true }, { status: 201 });
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('org_members')
      .select('id, status')
      .eq('org_id', membership.orgId)
      .eq('user_id', resolvedUserId)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'User is already a member of this org' }, { status: 409 });
    }

    const { data: member, error: memberError } = await supabase
      .from('org_members')
      .insert({
        org_id: membership.orgId,
        user_id: resolvedUserId,
        role,
        department: department ?? null,
        status: 'active',
      })
      .select()
      .single();

    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
