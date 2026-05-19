# Stage 1 — Editable Companies & Super-Admin User Management

## Manual deploy steps (external Supabase)

1. **Run migration** in the SQL editor:
   `docs/stage1-users-migration.sql`
   - Adds `profiles.is_active`
   - Adds RLS update/delete policies for super-admins on `profiles` and `user_roles`
   - Adds `count_active_company_seats(uuid)` helper

2. **Deploy edge functions** (both use default `verify_jwt = true`):
   ```bash
   supabase functions deploy create-company-admin --project-ref <REF>
   supabase functions deploy manage-company-user  --project-ref <REF>
   ```

## What changed

- `create-company-admin` now accepts an optional `role: "admin" | "recruiter"` (defaults to `admin`) and enforces seat limits via `get_company_seat_limit` + `count_active_company_seats`. Returns `409` when the seat cap is reached.
- `manage-company-user` handles `update | deactivate | reactivate`. Caller must be `super_admin` OR `admin` of the target company. Never touches `super_admin` rows in `user_roles`.
- `AdminCompanyDetail` gains an "Edit company" dialog (name + status; slug intentionally immutable) and a "Users" tab using `CompanyUsersTab`.

## Notes

- We **deactivate** rather than delete users — preserves audit trail and avoids `auth.users` cascade. Reactivation restores a tenant role of your choice.
- Slug rename is intentionally not exposed; it would break existing public careers URLs.
- Stage 2 (tenant `/team` page) will reuse `manage-company-user` with the built-in same-company admin check.