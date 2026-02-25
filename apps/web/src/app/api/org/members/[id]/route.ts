import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOrgMembership } from '@/lib/org/middleware';
import { canManageMembers } from '@/lib/org/rbac';

// Lazy-initialised so the module can be imported at build time without env vars
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** PATCH /api/org/members/[id] — update a member's role or department */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const membership = await requireOrgMembership(req.headers.get('authorization'));
    const { id: memberId } = await params;

    if (!canManageMembers(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verify the target member belongs to the same org
    const { data: target, error: targetError } = await supabase
      .from('org_members')
      .select('id, org_id, role, user_id')
      .eq('id', memberId)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (target.org_id !== membership.orgId) {
      return NextResponse.json({ error: 'Member does not belong to your org' }, { status: 403 });
    }

    // Prevent demoting owners unless the requester is also the owner
    if (target.role === 'owner' && membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can modify other owners' }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.role !== undefined) {
      const validRoles = ['owner', 'admin', 'manager', 'member', 'viewer'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: `role must be one of: ${validRoles.join(', ')}` }, { status: 400 });
      }
      updates.role = body.role;
    }

    if (body.department !== undefined) updates.department = body.department;
    if (body.status !== undefined) updates.status = body.status;

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('org_members')
      .update(updates)
      .eq('id', memberId)
      .select()
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ member: updated });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

/** DELETE /api/org/members/[id] — remove a member from the org */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const membership = await requireOrgMembership(req.headers.get('authorization'));
    const { id: memberId } = await params;

    if (!canManageMembers(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Verify the target member belongs to the same org
    const { data: target, error: targetError } = await supabase
      .from('org_members')
      .select('id, org_id, role, user_id')
      .eq('id', memberId)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (target.org_id !== membership.orgId) {
      return NextResponse.json({ error: 'Member does not belong to your org' }, { status: 403 });
    }

    // Prevent removing the last owner
    if (target.role === 'owner') {
      const { count } = await supabase
        .from('org_members')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', membership.orgId)
        .eq('role', 'owner')
        .eq('status', 'active');

      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last owner of an org' }, { status: 400 });
      }
    }

    // Prevent self-removal via this endpoint (use sign-out instead)
    if (target.user_id === membership.userId) {
      return NextResponse.json({ error: 'Cannot remove yourself — use account settings' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('org_members')
      .delete()
      .eq('id', memberId);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
