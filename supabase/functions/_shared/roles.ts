// The role names and the "who may give which role" rule, the same as the web app (src/lib/crmStore.ts:
// roleHierarchy and canAssignRole) and the same list the database accepts (migration 20261003_06).

export const KNOWN_ROLES = [
  'owner', 'admin', 'sales_manager', 'sales_rep', 'production_manager', 'project_manager',
  'field_tech', 'office_staff', 'subcontractor', 'canvasser', 'field_contractor',
  // older names, still accepted
  'manager', 'sales', 'salesperson', 'member', 'production', 'billing', 'canvas',
];

const HIERARCHY: Record<string, number> = {
  owner: 10,
  admin: 9,
  sales_manager: 8,
  production_manager: 8,
  project_manager: 6,
  office_staff: 5,
  sales_rep: 4,
  field_tech: 3,
  subcontractor: 2,
  canvasser: 1,
  field_contractor: 1,
  manager: 8,
  sales: 4,
  salesperson: 4,
  member: 3,
  production: 8,
  billing: 5,
  canvas: 3,
};

/** Who may add or invite people (the web app's canManageTeam, plus the older "manager"). */
export const isTeamManagerRole = (role: string) =>
  ['owner', 'admin', 'manager', 'sales_manager', 'production_manager'].includes(role);

/** Owner: any role. Admin: any role but owner. Managers: only roles ranked below their own. */
export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (!KNOWN_ROLES.includes(targetRole)) return false;
  if (actorRole === 'owner') return true;
  if (actorRole === 'admin') return targetRole !== 'owner';
  if (['sales_manager', 'production_manager', 'manager'].includes(actorRole)) {
    return (HIERARCHY[targetRole] ?? 0) < (HIERARCHY[actorRole] ?? 0);
  }
  return false;
}
