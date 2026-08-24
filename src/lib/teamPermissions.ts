type AppRole = "admin" | "recruiter" | "super_admin" | null | undefined;
type TenantUserRole = "admin" | "recruiter";

export function canAccessTeam(role: AppRole) {
  return role === "admin" || role === "recruiter" || role === "super_admin";
}

export function canManageCompanyUsers(role: AppRole) {
  return role === "admin" || role === "super_admin";
}

export function createUserRoleOptions(role: AppRole): TenantUserRole[] {
  if (!canAccessTeam(role)) return [];
  if (role === "recruiter") return ["recruiter"];
  return ["admin", "recruiter"];
}
