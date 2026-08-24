import { describe, expect, it } from "vitest";
import { authorizeCompanyUserAction, parseManagedCompanyUserRole } from "./permissions";

describe("authorizeCompanyUserAction", () => {
  it("allows admins to list, edit, deactivate, and reactivate users in their company", () => {
    for (const action of ["list", "update", "deactivate", "reactivate"] as const) {
      expect(authorizeCompanyUserAction({
        action,
        callerRoles: ["admin"],
        callerCompanyId: "company-1",
        targetCompanyId: "company-1",
      })).toEqual({ allowed: true });
    }
  });

  it("allows recruiters to list users in their company only", () => {
    expect(authorizeCompanyUserAction({
      action: "list",
      callerRoles: ["recruiter"],
      callerCompanyId: "company-1",
      targetCompanyId: "company-1",
    })).toEqual({ allowed: true });

    expect(authorizeCompanyUserAction({
      action: "deactivate",
      callerRoles: ["recruiter"],
      callerCompanyId: "company-1",
      targetCompanyId: "company-1",
    })).toEqual({ allowed: false, error: "Forbidden" });
  });

  it("does not allow tenant users to manage another company", () => {
    expect(authorizeCompanyUserAction({
      action: "list",
      callerRoles: ["admin"],
      callerCompanyId: "company-1",
      targetCompanyId: "company-2",
    })).toEqual({ allowed: false, error: "Forbidden" });
  });
});

describe("parseManagedCompanyUserRole", () => {
  it("accepts admin and recruiter roles", () => {
    expect(parseManagedCompanyUserRole("admin")).toBe("admin");
    expect(parseManagedCompanyUserRole("recruiter")).toBe("recruiter");
  });

  it("rejects missing role values so edit requests cannot silently leave roles unchanged", () => {
    expect(parseManagedCompanyUserRole(undefined)).toBeNull();
  });

  it("rejects invalid role values so edit requests cannot silently leave roles unchanged", () => {
    expect(parseManagedCompanyUserRole("owner")).toBeNull();
  });
});
