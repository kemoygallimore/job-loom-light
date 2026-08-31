import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

function allMigrationSql() {
  const migrationsDir = path.resolve(process.cwd(), "supabase", "migrations");
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n\n");
}

describe("company feature migrations", () => {
  it("keeps guest feedback enabled for companies without a feature row", () => {
    const sql = allMigrationSql();

    expect(sql).toMatch(/_feature\s+IS\s+NULL\s+OR\s+_feature\s+NOT\s+IN/i);
    expect(sql).toMatch(/WHEN\s+'guest_feedback'\s+THEN\s+true/i);
    expect(sql).toMatch(/RETURN\s+coalesce\(\s*enabled\s*,\s*default_enabled\s*,\s*false\s*\)/i);
  });

  it("backfills and provisions company feature defaults", () => {
    const sql = allMigrationSql();

    expect(sql).toMatch(/INSERT\s+INTO\s+public\.company_features\s*\(\s*company_id\s*\)\s*SELECT\s+c\.id\s+FROM\s+public\.companies\s+c/i);
    expect(sql).toMatch(/CREATE\s+TRIGGER\s+ensure_company_features_after_company_insert/i);
  });
});
