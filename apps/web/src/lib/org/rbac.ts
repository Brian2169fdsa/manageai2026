/**
 * Role-based access control helpers.
 * Roles (from org_members.role): owner | admin | manager | member | viewer
 */

export type OrgRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

/** Full ticket lifecycle management (create, edit, delete) */
export function canManageTickets(role: string): boolean {
  return ['owner', 'admin', 'manager'].includes(role);
}

/** Approve/reject completed builds */
export function canApproveBuilds(role: string): boolean {
  return ['owner', 'admin'].includes(role);
}

/** Push a workflow to production (deploy) */
export function canDeploy(role: string): boolean {
  return ['owner', 'admin', 'manager'].includes(role);
}

/** Invite / remove org members */
export function canManageMembers(role: string): boolean {
  return ['owner', 'admin'].includes(role);
}

/** Update org settings (billing, integrations, deploy configs) */
export function canManageSettings(role: string): boolean {
  return ['owner', 'admin'].includes(role);
}

/** Admin-level shorthand */
export function isAdmin(role: string): boolean {
  return ['owner', 'admin'].includes(role);
}

/**
 * Department-scoped visibility.
 * Owners and admins see everything. Managers/members see their own department.
 * Pass null for dept to check without dept filtering (e.g., a manager with no assigned dept).
 */
export function canViewDepartment(role: string, memberDept: string | null, targetDept: string): boolean {
  if (['owner', 'admin'].includes(role)) return true;
  if (!memberDept) return false;
  return memberDept === targetDept;
}
