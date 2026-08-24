import { describe, expect, it } from "vitest";
import { normalizeCompanyUsers } from "./teamUsers";

describe("normalizeCompanyUsers", () => {
  it("keeps server-provided roles when displaying company users", () => {
    expect(normalizeCompanyUsers([
      {
        user_id: "user-1",
        name: "Riley Recruiter",
        email: "riley@example.com",
        is_active: true,
        role: "recruiter",
      },
    ])).toEqual([
      {
        user_id: "user-1",
        name: "Riley Recruiter",
        email: "riley@example.com",
        is_active: true,
        role: "recruiter",
      },
    ]);
  });

  it("normalizes invalid or missing roles to blank", () => {
    expect(normalizeCompanyUsers([
      {
        user_id: "user-1",
        name: "Unknown User",
        email: "unknown@example.com",
        is_active: null,
        role: "super_admin",
      },
    ])).toEqual([
      {
        user_id: "user-1",
        name: "Unknown User",
        email: "unknown@example.com",
        is_active: true,
        role: null,
      },
    ]);
  });
});
