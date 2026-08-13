# Authentication Session Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover cleanly from revoked Supabase sessions, keep logout local to one browser, and replace generic Edge Function failures with actionable sign-in guidance.

**Architecture:** The existing instrumented Supabase fetch publishes a small framework-independent signal when an authenticated protected request returns 401. `AuthProvider` validates the session once, coalesces simultaneous failures, clears only the local browser session when Supabase explicitly rejects it, and exposes a persistent sign-in notice. A separate Edge Function error helper gives components safe, useful error copy.

**Tech Stack:** React 18, TypeScript 5.8, Supabase JS 2.104, React Router 6, Vitest 3, Testing Library.

## Global Constraints

- A user account may remain signed in on multiple computers at the same time.
- A normal logout affects only the current browser session.
- The session-expiry message is exactly: `Your session expired or is no longer valid. Please sign in again.`
- Public requests without a user access token must never trigger authenticated-session recovery.
- Network and temporary Auth service failures must not sign the user out.
- No database migration or Edge Function deployment is part of this change.
- No access token, refresh token, server response body, or stack trace may be exposed to users.

---

### Task 1: Unauthorized-session signal at the Supabase request boundary

**Files:**
- Create: `src/lib/authSessionEvents.ts`
- Create: `src/lib/authSessionEvents.test.ts`
- Modify: `src/lib/operationalErrorReporting.ts`
- Modify: `src/lib/operationalErrorReporting.test.ts`

**Interfaces:**
- Produces: `subscribeToUnauthorizedSession(listener: () => void): () => void`
- Produces: `publishUnauthorizedSession(): void`
- Consumes: the access token already supplied through `setOperationalErrorAccessToken(token)`

- [ ] **Step 1: Write failing event and request-boundary tests**

```ts
it("publishes to active subscribers and stops after unsubscribe", () => {
  const listener = vi.fn();
  const unsubscribe = subscribeToUnauthorizedSession(listener);
  publishUnauthorizedSession();
  unsubscribe();
  publishUnauthorizedSession();
  expect(listener).toHaveBeenCalledTimes(1);
});

it("publishes an unauthorized-session signal for an authenticated protected 401", async () => {
  setOperationalErrorAccessToken("user-token");
  const listener = vi.fn();
  const unsubscribe = subscribeToUnauthorizedSession(listener);
  const instrumented = createInstrumentedFetch(
    vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })),
    vi.fn(),
    () => "/pipeline",
  );
  await instrumented("https://project.supabase.co/functions/v1/send-candidate-email", {
    method: "POST",
    headers: { authorization: "Bearer user-token" },
  });
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  setOperationalErrorAccessToken(undefined);
});
```

Add companion cases proving anonymous requests, `/functions/v1/report-client-error`, and `/auth/v1/user` do not publish.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `bunx vitest run src/lib/authSessionEvents.test.ts src/lib/operationalErrorReporting.test.ts`

Expected: FAIL because `authSessionEvents.ts` and unauthorized publication do not exist.

- [ ] **Step 3: Implement the minimal signal and authenticated 401 detection**

```ts
type UnauthorizedSessionListener = () => void;
const listeners = new Set<UnauthorizedSessionListener>();

export function subscribeToUnauthorizedSession(listener: UnauthorizedSessionListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishUnauthorizedSession() {
  for (const listener of listeners) listener();
}
```

In `createInstrumentedFetch`, publish only when the response is 401, the sanitized path starts with `/rest/v1/`, `/functions/v1/`, or `/storage/v1/`, the path is not the reporting endpoint, and the outgoing bearer token exactly matches the current user access token.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `bunx vitest run src/lib/authSessionEvents.test.ts src/lib/operationalErrorReporting.test.ts`

Expected: all focused tests PASS with no warnings.

- [ ] **Step 5: Commit Task 1**

```powershell
git add src/lib/authSessionEvents.ts src/lib/authSessionEvents.test.ts src/lib/operationalErrorReporting.ts src/lib/operationalErrorReporting.test.ts
git commit -m "feat: detect unauthorized Supabase sessions"
```

### Task 2: Validate and recover authentication state centrally

**Files:**
- Modify: `src/hooks/useAuth.tsx`
- Create: `src/hooks/useAuth.test.tsx`

**Interfaces:**
- Consumes: `subscribeToUnauthorizedSession(listener)` from Task 1
- Produces: `sessionExpired: boolean` on `AuthContextType`
- Produces: `clearSessionExpired(): void` on `AuthContextType`
- Produces: `signOut(): Promise<void>` that uses `{ scope: "local" }`

- [ ] **Step 1: Write failing provider behavior tests**

Render the real `AuthProvider` with a small consumer and mock only the external Supabase client. Cover these observable behaviors:

```tsx
function Consumer() {
  const { user, loading, sessionExpired, signOut } = useAuth();
  return (
    <>
      <span>{loading ? "loading" : user?.id ?? "signed-out"}</span>
      <span>{sessionExpired ? "expired" : "active"}</span>
      <button onClick={() => void signOut()}>Sign out</button>
    </>
  );
}
```

- A restored session is not exposed until `getUser()` validates it.
- A 401/403 `getUser()` error clears the local session and exposes `expired`.
- A network error preserves the restored session.
- Three unauthorized signals while validation is pending call `getUser()` once.
- A valid `getUser()` result after a protected 401 leaves the session active.
- Manual sign-out calls `supabase.auth.signOut({ scope: "local" })` and does not mark the session expired.

- [ ] **Step 2: Run the provider tests and verify RED**

Run: `bunx vitest run src/hooks/useAuth.test.tsx`

Expected: FAIL because startup validation, signal subscription, local scope, and `sessionExpired` do not exist.

- [ ] **Step 3: Implement startup validation and coalesced recovery**

Add a narrow helper inside `useAuth.tsx`:

```ts
function isDefinitiveSessionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown };
  return candidate.status === 401 || candidate.status === 403 ||
    candidate.code === "session_not_found" || candidate.code === "bad_jwt" ||
    candidate.code === "refresh_token_not_found";
}
```

During initialization, call `getSession()`, then `getUser()` when a stored session exists. Preserve the stored session for non-definitive network/service errors. Subscribe to unauthorized signals and guard recovery with `useRef<Promise<void> | null>` so concurrent failures share one validation. On definitive invalidity, call local sign-out, clear `user`, `session`, `profile`, and `role`, and set `sessionExpired` to true in a `finally` block. Clear the flag on a valid `SIGNED_IN` event and through `clearSessionExpired()`.

- [ ] **Step 4: Run provider and request-boundary tests and verify GREEN**

Run: `bunx vitest run src/hooks/useAuth.test.tsx src/lib/authSessionEvents.test.ts src/lib/operationalErrorReporting.test.ts`

Expected: all tests PASS with no React act warnings.

- [ ] **Step 5: Commit Task 2**

```powershell
git add src/hooks/useAuth.tsx src/hooks/useAuth.test.tsx
git commit -m "fix: recover revoked browser sessions"
```

### Task 3: Translate Supabase Edge Function failures safely

**Files:**
- Create: `src/lib/functionErrors.ts`
- Create: `src/lib/functionErrors.test.ts`
- Modify: `src/components/email/CandidateEmailComposer.tsx`

**Interfaces:**
- Produces: `SESSION_EXPIRED_MESSAGE: string`
- Produces: `functionErrorMessage(error: unknown, fallback?: string): Promise<string>`

- [ ] **Step 1: Write failing message-translation tests**

```ts
it("translates a function 401 into sign-in guidance", async () => {
  const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
    context: new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  });
  await expect(functionErrorMessage(error)).resolves.toBe(SESSION_EXPIRED_MESSAGE);
});

it("uses a safe server error field for non-auth failures", async () => {
  const error = Object.assign(new Error("non-2xx"), {
    context: new Response(JSON.stringify({ error: "Template not found", details: { secret: "hidden" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    }),
  });
  await expect(functionErrorMessage(error)).resolves.toBe("Template not found");
});
```

Also cover malformed/non-JSON responses and non-Error values falling back safely.

- [ ] **Step 2: Run the utility tests and verify RED**

Run: `bunx vitest run src/lib/functionErrors.test.ts`

Expected: FAIL because the utility does not exist.

- [ ] **Step 3: Implement safe response parsing and adopt it in the composer**

The helper checks `error.context instanceof Response`, returns the approved message for status 401, clones and parses JSON for other statuses, accepts only a non-empty string `error` field, and otherwise falls back to the `Error.message` or supplied fallback. Update the email composer error branch to await the helper before showing the toast.

- [ ] **Step 4: Run utility and pipeline-related tests and verify GREEN**

Run: `bunx vitest run src/lib/functionErrors.test.ts src/pages/Pipeline.test.tsx src/pages/CandidateProfile.test.tsx`

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/lib/functionErrors.ts src/lib/functionErrors.test.ts src/components/email/CandidateEmailComposer.tsx
git commit -m "fix: explain candidate email function failures"
```

### Task 4: Present session recovery and account guidance in the UI

**Files:**
- Modify: `src/pages/Auth.tsx`
- Create: `src/pages/Auth.test.tsx`
- Modify: `src/pages/Team.tsx`

**Interfaces:**
- Consumes: `sessionExpired` and `clearSessionExpired()` from `useAuth()`
- Consumes: `SESSION_EXPIRED_MESSAGE` from `src/lib/functionErrors.ts`

- [ ] **Step 1: Write a failing sign-in recovery test**

Render the real `Auth` page in a `MemoryRouter`, mock only `useAuth()` and the Supabase sign-in boundary, and assert that an element with `role="alert"` contains the approved message when `sessionExpired` is true. Add a successful-login case proving `clearSessionExpired()` is called before navigation.

- [ ] **Step 2: Run the Auth page tests and verify RED**

Run: `bunx vitest run src/pages/Auth.test.tsx`

Expected: FAIL because Auth does not read or display the recovery state.

- [ ] **Step 3: Implement the alert and Team-page guidance**

Use the existing `Alert` and `AlertDescription` components above the sign-in form. On successful login, call `clearSessionExpired()` before navigating. Update the Team page description to tell administrators to create a separate account for every person and never share passwords; retain the existing seat-limit explanation.

- [ ] **Step 4: Run Auth and application route tests and verify GREEN**

Run: `bunx vitest run src/pages/Auth.test.tsx src/App.lazy-routes.test.tsx src/components/AppLayout.test.tsx`

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add src/pages/Auth.tsx src/pages/Auth.test.tsx src/pages/Team.tsx
git commit -m "feat: guide users through expired sessions"
```

### Task 5: Full verification

**Files:**
- Modify only files required to correct verification failures caused by Tasks 1-4.

**Interfaces:**
- Consumes: all completed task interfaces.
- Produces: a verified production build with no known regression from this change.

- [ ] **Step 1: Run the complete automated test suite**

Run: `bun run test`

Expected: all test files PASS.

- [ ] **Step 2: Run lint**

Run: `bun run lint`

Expected: exit code 0 with no new warnings or errors from changed files.

- [ ] **Step 3: Run the production build**

Run: `bun run build`

Expected: exit code 0 and Vite emits the production bundle.

- [ ] **Step 4: Review the final diff and repository state**

Run: `git diff HEAD~4 --check` and `git status --short`.

Expected: no whitespace errors; only the approved implementation and its tests/docs are changed.

- [ ] **Step 5: Complete final code review and handoff**

Review authentication correctness, race handling, public-route safety, safe error copy, and test coverage before reporting completion.
