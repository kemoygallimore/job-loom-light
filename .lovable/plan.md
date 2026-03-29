

# Separating Video Screening from ATS

## Approach

Use the existing `useAuth` hook to control navigation visibility based on the logged-in user's email. No database changes needed — purely a frontend gating mechanism.

**How it works:**
- A hardcoded test email (`testadmin@email.com`) gets full access to all modules (ATS + Screening)
- All other authenticated users see only the Video Screening module
- Super admins continue to see the admin panel as before

## Changes

### 1. Update `AppLayout.tsx` — Conditional navigation

Split the current `navItems` into two sets:

```text
ATS-only nav (hidden from regular users):
  Dashboard, Jobs, Candidates, Pipeline

Screening nav (visible to everyone):
  Screening (as the default "/" route)
```

Logic in `AppLayout`:
- If `profile?.email === "testadmin@email.com"` → show all nav items (ATS + Screening)
- If `role === "super_admin"` → show super admin nav (unchanged)
- Otherwise → show only Screening nav

### 2. Update `App.tsx` — Route protection and default redirect

- Wrap ATS routes (Dashboard, Jobs, Candidates, Pipeline) with an email check
- Regular users hitting `/`, `/jobs`, `/candidates`, `/pipeline` get redirected to `/screening`
- The `/screening` route becomes the default landing page for non-test users
- Public routes (careers, screening links) remain unchanged

### 3. Update `ProtectedRoutes` / create a small guard component

A simple `<ATSGuard>` wrapper that checks `profile?.email === "testadmin@email.com"` and redirects to `/screening` if not authorized.

## What stays the same
- Database, RLS policies, auth flow — no changes
- Super admin dashboard — unchanged
- Public screening candidate flow — unchanged
- All ATS code remains in place, just hidden from navigation

## Summary

This is the lightest-touch separation: a single email check controls nav visibility and route access. When the ATS is ready to launch, you simply remove the email guard and restore the full nav for all users.

