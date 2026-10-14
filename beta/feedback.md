# Beta feedback — PKCE code verifier error (Wed Aug 12)

## Report

A user reported the following error on Wednesday Aug 12, between 23:15–23:30
EEST (20:15–20:30 UTC), in the then-current production deployment:

> PKCE code verifier not found in storage. This can happen if the auth flow was
> initiated in a different browser or device, or if the storage was cleared. For
> SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server
> and client to store the code verifier in cookies.

## Investigation

### Vercel logs — not available

- Production site: `https://community-skills.vercel.app`.
- Current deployment at the time: `reteaua-de-suport-dekvbkq45`, created
  Wed Aug 12 17:13 (GMT+3), matching HEAD commit `c049f1d`.
- Plan is **Hobby**, which retains runtime logs for ~1 hour.
- `vercel logs --since "2026-08-12T20:00:00Z"` returned `No logs found` — the
  window is long past retention.

### Supabase auth logs — found the event

Project `eqgvmtorjlqdonppyyzr` ("community-skills"). Auth events (UTC):

| Time (UTC) | Event |
|---|---|
| 20:26:57 | Magic link sent to the affected user (`POST /otp`, 200) |
| 20:27:16 | Link clicked, `GET /verify` → **303 success** (valid auth code issued) |

Supabase succeeded. The failure occurred **in the app** at
`app/auth/callback/route.ts:14`, where `exchangeCodeForSession` threw the error.

## Root cause

- `@supabase/ssr` `createServerClient` **hardcodes `flowType: "pkce"`** (set
  after the caller's `options.auth`, so it cannot be overridden).
- PKCE stores a one-time code-verifier cookie in the browser that *initiated*
  sign-in (`signInWithOtp` in `app/sign-in/actions.ts`).
- `exchangeCodeForSession` throws `AuthPKCECodeVerifierMissingError` when that
  cookie is absent at callback time — i.e. the magic link was opened in a
  **different browser/device** than where the email was entered, or cookies were
  cleared/blocked (private mode, ITP).
- This is inherent to PKCE, **not a code regression**: it was an isolated
  single-user incident (only one magic link that evening), and the code follows
  the canonical Supabase SSR pattern.

## How the error surfaced

- `app/auth/callback/route.ts:16-22` redirects to `/sign-in?error=<raw message>`.
- `SearchParamsToast` (`components/searchparams-toast.tsx`) shows
  `ERROR_MESSAGES[error] ?? error` as a toast — the PKCE message is unmapped, so
  the user saw the raw technical English string.

## Recommended fixes

1. Map the PKCE error to a friendly Romanian message (open the link on the same
   device/browser, or re-request the link). Either:
   - add a key in `ERROR_MESSAGES` in `components/searchparams-toast.tsx`, or
   - detect it in `app/auth/callback/route.ts` and redirect to a clean
     `?error=` code.
2. Cross-device magic-link support would require dropping PKCE (plain
   `supabase-js` with `flowType: "implicit"`), which weakens security — avoid
   unless cross-device opening is a supported product flow.
