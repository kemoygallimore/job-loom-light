# Stages 2, 3, 4 — Tenant Team / Account Menu / Policy Editor

## Manual deploy

- **Stage 4 migration**: run `docs/stage4-policies-migration.sql` in the external Supabase SQL editor. Adds `company_policies`, `company_policy_versions`, snapshot trigger, and the public `get_public_company_policy(text)` RPC.
- No new edge functions. Stages 2 + 3 reuse `create-company-admin` and `manage-company-user` from Stage 1.

## What changed

### Stage 2 — Tenant Team page (`/team`)
- Admin-only. Lists company users, invite/edit/deactivate using the same `CompanyUsersTab` component as the super-admin view.
- Seat limit pulled via `get_company_seat_limit`. Add-user is disabled when the cap is reached.
- Server-side enforcement: `manage-company-user` already verifies the caller is `admin` of the same company.

### Stage 3 — Account menu
- Removed "Billing" from the tenant sidebar.
- Bottom user block is now a dropdown ("Account") with: Team (admins only), Billing, Data Protection, Sign out.
- Super-admin sidebar untouched.

### Stage 4 — Data Protection policy editor
- New "Policies" tab on `AdminCompanyDetail` using `RichTextEditor`. Resets to a built-in default template.
- Public `/legal/data-protection?company=<slug>` resolves to the tenant's policy via the public RPC.
- All HTML rendered through `DOMPurify` to prevent stored XSS.
- Every save is mirrored to `company_policy_versions` for audit/compliance.

## Notes
- Tenant-side Account → Data Protection link uses the user's company slug; super-admins see the generic page.
- If a company has no row in `company_policies`, the public page falls back to the default template.