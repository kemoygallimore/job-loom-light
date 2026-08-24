export type TeamUserRole = "admin" | "recruiter";

export interface CompanyUserRow {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  role: TeamUserRole | null;
}

interface RawCompanyUserRow {
  user_id?: unknown;
  name?: unknown;
  email?: unknown;
  is_active?: unknown;
  role?: unknown;
}

export function normalizeCompanyUsers(rows: RawCompanyUserRow[]): CompanyUserRow[] {
  return rows.map((row) => ({
    user_id: typeof row.user_id === "string" ? row.user_id : "",
    name: typeof row.name === "string" ? row.name : "",
    email: typeof row.email === "string" ? row.email : "",
    is_active: row.is_active !== false,
    role: row.role === "admin" || row.role === "recruiter" ? row.role : null,
  }));
}
