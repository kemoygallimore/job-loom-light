import { describe, expect, it } from "vitest";
import {
  canAccessTeam,
  canManageCompanyUsers,
  createUserRoleOptions,
} from "./teamPermissions";

describe("team permissions", () => {
  it("allows admins, recruiters, and super admins to access team user creation", () => {
    expect(canAccessTeam("admin")).toBe(true);
    expect(canAccessTeam("recruiter")).toBe(true);
    expect(canAccessTeam("super_admin")).toBe(true);
  });

  it("keeps edit and deactivate actions limited to admins and super admins", () => {
    expect(canManageCompanyUsers("admin")).toBe(true);
    expect(canManageCompanyUsers("super_admin")).toBe(true);
    expect(canManageCompanyUsers("recruiter")).toBe(false);
  });

  it("limits recruiter-created accounts to recruiter role", () => {
    expect(createUserRoleOptions("recruiter")).toEqual(["recruiter"]);
    expect(createUserRoleOptions("admin")).toEqual(["admin", "recruiter"]);
    expect(createUserRoleOptions("super_admin")).toEqual(["admin", "recruiter"]);
  });
});
