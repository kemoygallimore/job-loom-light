## Why the app "refreshes" when you switch tabs

The page is **not** doing a full browser reload — there is no `window.location.reload()` anywhere in the codebase. What you are experiencing is a **React re-render cascade** that wipes any unsaved local component state (form inputs, dialogs, scroll position, etc.).

### Root cause: `src/hooks/useAuth.tsx`

When you leave a tab, Supabase's auth client pauses its token refresh timer. When you come back, it immediately:

1. Refreshes the JWT (fires a `TOKEN_REFRESHED` event), and
2. Re-emits a `SIGNED_IN` event on visibility change.

Our `onAuthStateChange` handler responds to **every** event by calling:

```ts
setSession(session);
setUser(session?.user ?? null);
```

Even though the logged-in user is the same, `session.user` is a brand-new object reference each time. That triggers the second `useEffect` (which depends on `user`), which:

- Re-fetches `profiles` and `user_roles` from the database,
- Calls `setProfile(...)` and `setRole(...)` with new object references,
- Which changes the `AuthContext` value,
- Which re-renders **every component in the app that uses `useAuth()`** (basically all pages, the layout, and protected routes),
- And any child component whose `useEffect` depends on `profile`, `role`, `user`, or `company_id` then re-runs its own data fetch — which is what feels like a "refresh".

Anything held only in local component state (typed text in an input, modal open state, an in-progress upload form) gets reset because the parent's identity churn unmounts/remounts subtrees.

### The fix

Make the auth provider **idempotent**: ignore auth events that don't actually change the logged-in user, and only re-fetch the profile when the user id changes — not on every token refresh.

Concretely, in `src/hooks/useAuth.tsx`:

1. In the `onAuthStateChange` callback, compare the incoming `session.user.id` to the current one. Only call `setUser` / `setSession` when it actually changed (sign-in, sign-out, user switch). Token refreshes silently update the cached session without touching React state.
2. Change the profile-fetch effect to depend on `user?.id` instead of the whole `user` object, so a refreshed-but-identical user does not retrigger the fetch.
3. Keep the existing `refreshAuth()` escape hatch (via `refreshTick`) so we can still force a re-fetch when something legitimately changes (e.g. after a profile update).

### Files to change

- `src/hooks/useAuth.tsx` — the only change needed.

### What this will fix

- Typing in a form and switching tabs will no longer reset the inputs.
- Open dialogs/sheets stay open.
- No unnecessary network calls to `profiles` / `user_roles` every time you tab back.
- Pages that fetch on `useEffect([profile])` won't re-fetch on focus.

### What this will NOT change

- Real sign-in / sign-out events still update the UI immediately.
- The session is still refreshed in the background by Supabase — you stay logged in.
- No other files (pages, layout, queries) need to change.

### Out of scope (mention only)

We do not use React Query's `useQuery` anywhere, so `refetchOnWindowFocus` is not a factor here. If we add React Query data fetching later, we should also disable `refetchOnWindowFocus` globally for forms-heavy screens.
