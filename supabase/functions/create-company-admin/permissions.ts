export type TenantRole = "admin" | "recruiter" | "super_admin";
export type CreatedUserRole = "admin" | "recruiter";

interface AuthorizeCreateCompanyUserInput {
  callerRoles: TenantRole[];
  callerCompanyId: string | null;
  targetCompanyId: string;
  targetRole: CreatedUserRole;
}

type AuthorizationResult =
  | { allowed: true }
  | { allowed: false; error: string };

export function authorizeCreateCompanyUser({
  callerRoles,
  callerCompanyId,
  targetCompanyId,
  targetRole,
}: AuthorizeCreateCompanyUserInput): AuthorizationResult {
  if (callerRoles.includes("super_admin")) return { allowed: true };

  if (!callerCompanyId || callerCompanyId !== targetCompanyId) {
    return { allowed: false, error: "Forbidden" };
  }

  if (callerRoles.includes("admin")) return { allowed: true };

  if (callerRoles.includes("recruiter")) {
    if (targetRole === "recruiter") return { allowed: true };
    return { allowed: false, error: "Recruiters can only create recruiter users" };
  }

  return { allowed: false, error: "Forbidden" };
}
