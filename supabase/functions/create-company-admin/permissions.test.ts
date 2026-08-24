import { describe, expect, it } from "vitest";
import { authorizeCreateCompanyUser, resolveCreateCompanyUserRole } from "./permissions";

describe("authorizeCreateCompanyUser", () => {
  it("allows super admins to create admins for any company", () => {
    expect(authorizeCreateCompanyUser({
      callerRoles: ["super_admin"],
      callerCompanyId: null,
      targetCompanyId: "company-1",
      targetRole: "admin",
    })).toEqual({ allowed: true });
  });

  it("allows company admins to create admins in their own company", () => {
    expect(authorizeCreateCompanyUser({
      callerRoles: ["admin"],
      callerCompanyId: "company-1",
      targetCompanyId: "company-1",
      targetRole: "admin",
    })).toEqual({ allowed: true });
  });

  it("allows recruiters to create recruiters in their own company", () => {
    expect(authorizeCreateCompanyUser({
      callerRoles: ["recruiter"],
      callerCompanyId: "company-1",
      targetCompanyId: "company-1",
      targetRole: "recruiter",
    })).toEqual({ allowed: true });
  });

  it("does not allow recruiters to create admins", () => {
    expect(authorizeCreateCompanyUser({
      callerRoles: ["recruiter"],
      callerCompanyId: "company-1",
      targetCompanyId: "company-1",
      targetRole: "admin",
    })).toEqual({ allowed: false, error: "Recruiters can only create recruiter users" });
  });

  it("does not allow tenant users to create users for another company", () => {
    expect(authorizeCreateCompanyUser({
      callerRoles: ["admin"],
      callerCompanyId: "company-1",
      targetCompanyId: "company-2",
      targetRole: "recruiter",
    })).toEqual({ allowed: false, error: "Forbidden" });
  });
});

describe("resolveCreateCompanyUserRole", () => {
  it("uses an explicitly selected recruiter role", () => {
    expect(resolveCreateCompanyUserRole("recruiter", ["admin"])).toBe("recruiter");
  });

  it("uses an explicitly selected admin role", () => {
    expect(resolveCreateCompanyUserRole("admin", ["admin"])).toBe("admin");
  });

  it("defaults super admin company-admin creation to admin when older callers omit role", () => {
    expect(resolveCreateCompanyUserRole(undefined, ["super_admin"])).toBe("admin");
  });

  it("defaults tenant-created users to recruiter when older callers omit role", () => {
    expect(resolveCreateCompanyUserRole(undefined, ["admin"])).toBe("recruiter");
  });

  it("defaults invalid tenant role values to recruiter so bad payloads cannot create admins", () => {
    expect(resolveCreateCompanyUserRole("owner", ["admin"])).toBe("recruiter");
  });
});
