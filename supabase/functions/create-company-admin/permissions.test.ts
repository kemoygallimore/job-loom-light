import { describe, expect, it } from "vitest";
import { authorizeCreateCompanyUser } from "./permissions";

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
