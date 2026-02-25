import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOrgMembership } from '@/lib/org/middleware';
import { canManageSettings } from '@/lib/org/rbac';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** GET /api/org — returns the current user's org */
export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  try {
    const membership = await requireOrgMembership(req.headers.get('authorization'));

    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name, slug, settings, created_at')
      .eq('id', membership.orgId)
      .single();

    if (error || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      org,
      role: membership.role,
      department: membership.department,
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

/** POST /api/org — create a new organization (and add creator as owner) */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { name, slug } = body as { name: string; slug: string };

    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
    }

    // Create org
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: name.trim(), slug: slug.trim().toLowerCase(), settings: {} })
      .select()
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: orgError?.message ?? 'Failed to create org' }, { status: 500 });
    }

    // Add creator as owner
    const { error: memberError } = await supabase.from('org_members').insert({
      org_id: org.id,
      user_id: user.id,
      role: 'owner',
      status: 'active',
    });

    if (memberError) {
      // Rollback org on failure
      await supabase.from('organizations').delete().eq('id', org.id);
      return NextResponse.json({ error: 'Failed to create membership' }, { status: 500 });
    }

    return NextResponse.json({ org, role: 'owner' }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** PATCH /api/org — update org settings */
export async function PATCH(req: NextRequest) {
  const supabase = getSupabase();
  try {
    const membership = await requireOrgMembership(req.headers.get('authorization'));

    if (!canManageSettings(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const allowed: Record<string, unknown> = {};
    if (body.name) allowed.name = body.name;
    if (body.settings) allowed.settings = body.settings;

    const { data: org, error } = await supabase
      .from('organizations')
      .update({ ...allowed, updated_at: new Date().toISOString() })
      .eq('id', membership.orgId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ org });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
