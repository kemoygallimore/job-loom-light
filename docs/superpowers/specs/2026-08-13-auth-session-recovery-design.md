# Authentication Session Recovery Design

## Objective

Prevent a logout or revoked session on one device from leaving another browser in a misleading, apparently signed-in state. When a protected request cannot authenticate, the application must recover predictably and explain that the user needs to sign in again.

## Confirmed Product Decisions

- A user account may remain signed in on multiple computers at the same time.
- A normal logout affects only the current browser session.
- Each staff member should receive a separate Team account instead of sharing credentials.
- A stale or revoked session redirects the affected browser to sign-in and displays a plain-language explanation.
- The behavior applies across the authenticated application, not only to candidate email sending.

## Current Failure

The Supabase client persists sessions in browser local storage. The application restores the locally stored session and uses it to render authenticated routes. If the corresponding server-side session has been revoked, the browser can temporarily continue showing authenticated screens. A protected Edge Function then returns HTTP 401, while the calling component displays only the generic Supabase function error.

The existing `signOut()` call also uses Supabase's default global scope. A user who signs out from one browser can therefore revoke sessions on other devices using the same account.

## Architecture

### Device-local logout

The authentication provider will call `supabase.auth.signOut({ scope: "local" })`. Its React state will still be cleared after the call so the current browser immediately returns to the sign-in route. Other active sessions remain unaffected.

### Initial session validation

When the authentication provider restores a locally persisted session, it will validate that session with `supabase.auth.getUser()` before treating the user as authenticated. A locally present session that the Auth server rejects will be cleared locally and marked as expired.

This validation runs once during application startup. Routine token refresh remains the responsibility of the Supabase client.

### Central unauthorized-response signal

The existing instrumented Supabase fetch layer already observes non-success responses. It will publish an unauthorized-session signal when all of the following are true:

- The response status is 401.
- The request is for a protected Supabase API or Edge Function rather than the operational-error reporting endpoint.
- The browser currently has a user access token.

The authentication provider will subscribe to this signal. It will coalesce concurrent signals so that several failing requests produce only one validation and recovery sequence. It will call `getUser()` to distinguish a revoked session from an endpoint-specific authorization error. If the user is still valid, normal component error handling continues. If Supabase Auth explicitly rejects the session as unauthorized or missing, the provider clears the local session and records the session-expired notice. A network outage or temporary Auth service failure will preserve the local session and leave the original request error visible.

Public pages that invoke Supabase without a user access token will not trigger authenticated-session recovery.

### User-facing recovery

Clearing the provider's user and profile state causes the existing protected route guard to redirect to `/auth`. The authentication context will expose a session-expired flag. The sign-in page will render an accessible alert with this copy:

> Your session expired or is no longer valid. Please sign in again.

The flag clears after a successful login or after the user begins a new valid authenticated session.

### Edge Function error translation

A focused utility will extract safe error details from Supabase function errors. It will recognize a 401 response and return the session-expired message. For other function failures it will use the server's JSON `error` field when available, then fall back to the SDK error message.

The candidate email composer will use this utility so failures that do not cause a redirect are still understandable. It will not expose provider internals, response bodies, tokens, or stack traces to users.

### Separate user accounts

The Team page will state that every staff member should receive an individual account and that passwords should not be shared. The application will not block simultaneous sessions or attempt to infer account sharing because legitimate multi-device use remains supported.

## Component Boundaries

- `src/lib/authSessionEvents.ts`: small framework-independent subscription mechanism for unauthorized-session signals.
- `src/lib/operationalErrorReporting.ts`: detects eligible 401 responses and publishes the signal while preserving existing sanitized error reporting.
- `src/hooks/useAuth.tsx`: validates restored sessions, coalesces recovery, performs local logout, and exposes the session-expired state.
- `src/lib/functionErrors.ts`: converts Supabase Edge Function errors into safe user-facing messages.
- `src/pages/Auth.tsx`: displays the persistent session-expired alert and clears it after successful sign-in.
- `src/components/email/CandidateEmailComposer.tsx`: uses the shared function-error translation.
- `src/pages/Team.tsx`: communicates the separate-account policy.

## Error Handling and Concurrency

- Multiple 401 responses emitted together must result in one `getUser()` validation and one local sign-out.
- A 401 with no current user access token must not affect public routes.
- A 401 followed by successful `getUser()` validation must not sign out the user.
- A session is cleared only when Auth explicitly reports it as unauthorized, invalid, or missing. Network and temporary service failures do not sign the user out.
- Local sign-out errors must not leave stale authenticated React state in the current browser.
- Existing operational-error reporting remains best-effort and must not recursively report or react to failures from its own endpoint.

## Testing Strategy

Automated tests will verify:

1. The instrumented fetch publishes an unauthorized signal for a protected 401 when a user access token exists.
2. It does not publish for public/anonymous requests or the reporting endpoint.
3. Restored sessions are validated before authenticated state is exposed.
4. Invalid startup sessions are cleared and marked expired.
5. Concurrent 401 signals are coalesced into one recovery attempt.
6. A valid server-side user is not signed out after an endpoint-specific 401.
7. Normal logout requests Supabase's local scope.
8. The sign-in page renders the approved session-expiry message.
9. Candidate email function errors resolve to plain-language messages.
10. Existing authentication, pipeline, and application tests continue to pass.

Verification will include focused Vitest suites, the full test suite, linting, and a production build.

## Security and Privacy

- No service-role or secret keys move into the browser.
- No access or refresh tokens are logged or included in error messages.
- Server-side authorization remains authoritative; this change only improves browser recovery and messaging.
- Device-local logout is an intentional product choice. Administrative session revocation and password/security actions may still invalidate other sessions through Supabase.

## Out of Scope

- Enforcing one active device per account.
- Detecting whether two people share an account.
- Changing Supabase Auth session lifetime settings.
- Changing database policies or Edge Function authorization rules.
- Reworking every existing component's non-authentication error copy.
