export type TenantRole = "admin" | "recruiter" | "super_admin";
export type CompanyUserAction = "list" | "update" | "deactivate" | "reactivate";

interface AuthorizeCompanyUserActionInput {
  action: CompanyUserAction;
  callerRoles: TenantRole[];
  callerCompanyId: string | null;
  targetCompanyId: string;
}

type AuthorizationResult =
  | { allowed: true }
  | { allowed: false; error: string };

export function authorizeCompanyUserAction({
  action,
  callerRoles,
  callerCompanyId,
  targetCompanyId,
}: AuthorizeCompanyUserActionInput): AuthorizationResult {
  if (callerRoles.includes("super_admin")) return { allowed: true };
  if (!callerCompanyId || callerCompanyId !== targetCompanyId) return { allowed: false, error: "Forbidden" };
  if (callerRoles.includes("admin")) return { allowed: true };
  if (callerRoles.includes("recruiter") && action === "list") return { allowed: true };
  return { allowed: false, error: "Forbidden" };
}
