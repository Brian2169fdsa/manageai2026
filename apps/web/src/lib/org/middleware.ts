import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface OrgMembership {
  org_id: string;
  role: string;
  department: string | null;
}

/**
 * Fetches the org membership for a given user ID.
 * Returns null if the user has no org membership.
 */
export async function getOrgForUser(userId: string): Promise<OrgMembership | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('org_members')
    .select('org_id, role, department')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    org_id: data.org_id,
    role: data.role,
    department: data.department ?? null,
  };
}

/**
 * Utility for API routes: extracts user from auth header, resolves org membership.
 * Returns { userId, orgId, role, department } or throws with a 401/403 message.
 */
export async function requireOrgMembership(
  authHeader: string | null
): Promise<{ userId: string; orgId: string; role: string; department: string | null }> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = getSupabase();

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
  }

  const userId = userData.user.id;
  const membership = await getOrgForUser(userId);

  if (!membership) {
    throw Object.assign(new Error('User has no org membership'), { status: 403 });
  }

  return {
    userId,
    orgId: membership.org_id,
    role: membership.role,
    department: membership.department,
  };
}
