# Fix onboarding finalization and surface submission errors

## Status

Planned. This document records the investigation and the work required for a future implementation session. It does not authorize or apply product, database, or deployment changes by itself.

## Outcome

An invited, authenticated user must be able to finish onboarding after completing all required fields, with only phone and contact email required on step 4. If finalization fails for any reason, the user must receive actionable toast feedback, retain their draft, and be able to retry safely.

## Confirmed production incident

On 12 August 2026, production Vercel logs contained eight failed `POST /onboarding` requests between 13:55 and 14:49 Europe/Bucharest. All eight returned HTTP 500 from deployment `dpl_537G4iVB5MUwujSTStiepzotGveQ` with:

```text
completeOnboarding failed: new row for relation "profiles" violates check constraint "profiles_context_embedding_complete"
```

This matches the reported behavior: the finalization button shows its processing state for several seconds, then returns to the form without navigation or feedback. Repeating the submission repeats the same failure.

This failure is unrelated to the optional website and social-profile fields.

## Root cause

`supabase/migrations/20260809170000_dual_index_people_search.sql` added three profile-context columns and a check constraint requiring them to be either all populated or all `null`:

- `profile_context_embedding`
- `profile_context_embedding_input`
- `profile_context_embedded_at`

That migration's version of `complete_onboarding` populated all three values.

`supabase/migrations/20260811120000_profile_photos_community_affiliations.sql` subsequently recreated the current seven-argument `complete_onboarding` function to add profile-photo and community-affiliation support. Its profile insert populates the embedding and input but omits `profile_context_embedded_at`. Every otherwise-valid onboarding transaction therefore violates `profiles_context_embedding_complete`.

The application generates embeddings before invoking the RPC, which accounts for the visible delay. The database transaction then fails. `lib/onboarding/submit.ts` throws the unexpected database error; `app/onboarding/actions.ts` does not convert it to a safe action result; and `app/onboarding/form.tsx` only resets `submitting` in `finally`, so the browser displays no toast.

The RPC is transactional. Confirm during implementation, but the expected result of each failed attempt is that no member/profile/resources/affiliations are committed and the invitation remains unclaimed.

## Required behavior

### Step 4

Only these fields are required on step 4:

- A possible phone number for the selected country, normalized to an international `+...` number.
- A syntactically valid contact email.

These fields remain optional:

- Website
- LinkedIn
- Facebook
- Instagram
- X

Empty optional values must be persisted as `null`, not treated as validation failures.

### Submission failure

For any expected or unexpected failure:

- Stop the loading state and re-enable the finalization button.
- Keep the user on an appropriate onboarding step.
- Preserve all draft values and any retryable local state.
- Show a Sonner toast; never fail silently or add inline feedback markup.
- Do not expose raw database, stack-trace, AI Gateway, storage, or credential details.
- Avoid claiming the invite or leaving partially published member data.
- Permit a deliberate retry after the failure has been resolved.

## Implementation plan

### 1. Preflight and repository state

1. Work on the currently checked-out non-`main` branch, per `AGENTS.md`.
2. Inspect `git status` before editing and preserve unrelated user work. At the time this plan was written, `supabase/migrations/20260812120000_allow_onboarding_community_read.sql` was an untracked, already-applied migration from the community-checkbox fix. Do not overwrite, rename, or discard it.
3. Start the local Supabase stack with `supabase start`. If Docker is unavailable, restore it before database integration testing; do not substitute remote production for destructive or mutation-based tests.
4. Run `supabase migration list` and inspect the local and linked migration history. Ensure the new migration timestamp sorts after `20260812120000_allow_onboarding_community_read.sql` and that production history is not rewritten.
5. Read the relevant Next.js 16 server-action documentation under `node_modules/next/dist/docs/` before changing the action/error-return behavior.

### 2. Add a forward-only corrective Supabase migration

Create a new migration; do not edit either historical migration that introduced the constraint or recreated the RPC.

The migration must `create or replace function public.complete_onboarding(...)` using the current seven-argument signature:

```sql
complete_onboarding(
  p_user_id uuid,
  p_email text,
  p_code text,
  p_profile jsonb,
  p_socials jsonb,
  p_resources jsonb,
  p_community_ids uuid[]
)
```

Preserve all current behavior:

- Authentication guard.
- Invite lookup and row lock.
- Invalid/already-claimed error codes.
- Resource and community validation.
- Member insert/upsert.
- Profile photo path.
- Resource insertion and embeddings.
- Social/contact insertion.
- Community-affiliation insertion.
- Invite claim at the end of the transaction.
- `security definer` and restricted `search_path`.
- Revokes from `public`, `anon`, and `authenticated`.
- Grant only to `service_role`.

Correct the profile insert so these values are written together:

```sql
(p_profile->>'profile_context_embedding')::vector,
p_profile->>'profile_context_embedding_input',
now()
```

The timestamp must target `profile_context_embedded_at`, not the obsolete `embedded_at` profile column.

Before applying remotely:

1. Run a local reset/migration application against the local Supabase stack.
2. Run `supabase db push --dry-run` against the linked project and confirm only the intended outstanding migration(s) are listed. Account explicitly for the existing community-read migration if it remains uncommitted locally but is already recorded remotely.
3. Inspect the generated/current function signature and privileges after migration.

### 3. Define an explicit server-action result contract

Replace the loosely inferred action return shape with a named discriminated union shared by the server action and form. A suitable shape is:

```ts
type SubmitOnboardingActionResult =
  | { kind: "ok" }
  | { kind: "invalidPhoto" }
  | { kind: "photoUploadFailed" }
  | { kind: "missingFields" }
  | { kind: "alreadyClaimed" }
  | { kind: "invalidCode" }
  | { kind: "embeddingFailed"; reference: string }
  | { kind: "submissionFailed"; reference: string };
```

The exact public categories may be consolidated if they do not lead to distinct user actions. Keep the contract exhaustive so the client cannot accidentally ignore a newly added failure kind.

Do not use redirects as the only feedback mechanism for failures that happen while the user is on step 4. Redirect query parameters remain valid for page-entry/server-rendered feedback, but an invoked server action should return a typed result the current client can toast immediately.

### 4. Handle and log failures at the responsible boundary

In `app/onboarding/actions.ts`:

1. Generate a short, non-sensitive diagnostic reference for each unexpected failure, such as a random uppercase/hex identifier. Do not derive it from email, user ID, invite code, or other personal data.
2. Catch known failures at their narrowest useful boundary:
   - Photo validation/upload failures.
   - AI Gateway embedding failures.
   - Expected domain results such as missing fields, invalid/claimed invite.
   - Unexpected Supabase RPC/database failures.
3. Log unexpected failures server-side with structured context sufficient for Vercel correlation:
   - Diagnostic reference.
   - Operation/stage (`profile-embedding`, `resource-embedding`, `photo-upload`, `complete-onboarding-rpc`).
   - Safe database error code and constraint name when present.
   - Error object/stack for server logs.
   - Deployment/request metadata when safely available.
4. Do not log form contents, phone, email, invite code, embeddings, access tokens, or service keys.
5. Return a safe action result containing only the public error kind and diagnostic reference.
6. Retain the existing photo cleanup behavior. If a photo was uploaded and a later step fails, remove it best-effort. Log cleanup failure separately without replacing the original failure.
7. Ensure all execution paths return a declared result or intentionally redirect. Avoid uncaught application errors for anticipated infrastructure/database failures.

If `lib/onboarding/submit.ts` needs to distinguish embedding failures from database failures, introduce a small typed error/result boundary rather than matching arbitrary human-readable error strings. Preserve the domain result mapping for PostgreSQL codes `P0001` and `P0002`.

### 5. Add user-visible toast feedback

In `app/onboarding/form.tsx`, handle every result kind explicitly.

Recommended Romanian messages:

- Unexpected submission/database failure:

  > Înregistrarea nu a putut fi finalizată. Datele tale au rămas salvate. Încearcă din nou. Cod eroare: ABC123

- Embedding/AI service failure:

  > Serviciul de procesare nu este disponibil momentan. Datele tale au rămas salvate. Încearcă din nou. Cod eroare: ABC123

- Missing or stale earlier-step data:

  > Unele informații obligatorii lipsesc. Verifică datele evidențiate.

- Already-claimed invitation:

  > Acest link de invitație a fost deja folosit. Autentifică-te sau cere ajutor unui administrator.

- Invalid/expired invitation:

  > Linkul de invitație nu este valid. Cere un link nou unui administrator.

Follow the repository feedback convention:

- Use `toast.error(...)` from Sonner.
- Do not add an inline `<p>` error message.
- Use an 8–10 second duration for unexpected errors containing a support reference; retain the normal five-second duration for ordinary validation errors.
- Keep the form draft after every failure.
- Clear the draft only after `{ kind: "ok" }`.
- Keep the user on step 4 for retryable infrastructure failures.
- For `missingFields`, determine the earliest invalid step from the current state, navigate there, mark the relevant fields invalid, and toast the explanation.
- Ensure `submitting` is reset in `finally` and the button cannot be double-submitted while a request is active.

Photo files cannot be serialized into the existing `localStorage` draft. If a selected photo was cleaned up after a failed submission, make the UI state truthful: clear the selected file/preview or tell the user to select it again. Do not leave a preview implying that an unavailable upload will be reused.

### 6. Preserve the step-4 validation contract

Keep client and server validation aligned:

- Client: `isPossiblePhoneNumber(values.phone)` and contact-email syntax.
- Server: require an international `+...` phone, validate it again, and validate the contact email.
- Optional web/social fields must not participate in `stepComplete`, `invalidContact`, or the server's required-field predicate.
- Continue normalizing empty optional social fields to `null` before the RPC.

Consider improving the phone toast to mention the selected country and international interpretation, but do not require users to manually type a `+` if `react-phone-number-input` already produces it from the selected country.

### 7. Regression tests

Add focused tests at each boundary.

#### Database/RPC tests

Against the local Supabase stack:

- A complete valid onboarding transaction succeeds.
- The inserted profile has non-null embedding, input, and `profile_context_embedded_at`.
- Phone and contact email alone are accepted for step 4.
- Website, LinkedIn, Facebook, Instagram, and X are stored as `null` when empty.
- The selected community affiliations and resources are stored.
- The invite is claimed only after the successful transaction.
- A deliberately forced profile-insert failure rolls back the member, profile, resources, affiliations, socials, and invite claim.
- Function execution remains unavailable to `anon` and ordinary `authenticated` callers and available to `service_role`.

#### Domain/server tests

- Valid required data with empty optional social fields returns `ok`.
- Missing/invalid phone returns `missingFields` without calling the RPC.
- Invalid contact email returns `missingFields` without calling the RPC.
- An embedding exception maps to the chosen safe failure kind and reference.
- An unexpected RPC error maps to `submissionFailed` and reference.
- `P0001` and `P0002` retain their domain mappings.
- A late failure after photo upload attempts cleanup.
- Logs contain the reference/stage but not phone, email, invite, or form contents.

#### Component tests

- Step 4 becomes completable with only phone and contact email.
- Optional fields remain blank and do not block submission.
- While submitting, the button is disabled and shows `Se finalizează…`.
- Unexpected failure shows a Sonner error toast containing the reference.
- Failure returns the button to its enabled state.
- Draft and visible form values survive the failure.
- A second deliberate submission can succeed.
- Success removes the draft and calls `router.replace("/")`.
- `missingFields` returns to the earliest invalid step and highlights it.
- No inline error paragraph is introduced.

Run the focused tests first, then the repository gates:

```bash
pnpm exec vitest run tests/onboarding-form.test.tsx
pnpm exec vitest run tests/submit-onboarding.test.ts
pnpm test
pnpm typecheck
pnpm lint
```

Database-dependent suites require `supabase start`; skipped or connection-refused suites do not count as successful verification.

### 8. Deployment order

Use a database-first rollout because the current production function rejects every valid onboarding submission.

1. Apply the corrective migration with `supabase db push` after a successful dry run and local integration proof.
2. Immediately inspect the deployed function definition and privileges using CLI/SQL tooling.
3. Verify with a fresh, unclaimed invitation and disposable test email that onboarding completes in production.
4. Deploy the server/client feedback changes through the normal Vercel workflow.
5. Verify again after the Vercel deployment so both the success path and failure feedback are covered.
6. Do not use either Supabase or Vercel dashboards to make changes; dashboards may be used read-only.

Upgrade the local Vercel CLI before deployment if practical. The installed version observed during investigation was `54.14.5`, while `58.9.4` was current. Use `npm i -g vercel@latest` or `pnpm add -g vercel@latest`.

### 9. Manual browser verification

Per `AGENTS.md`, use Google Chrome and test desktop and mobile viewport sizes.

Success path:

1. Obtain an unclaimed invitation from the database without exposing it in logs or documentation.
2. Use a disposable inbox.
3. Request and follow the magic sign-in link.
4. Complete every onboarding step.
5. On step 4, enter only a valid phone and contact email; leave all optional social fields empty.
6. Submit once and confirm loading feedback appears.
7. Confirm navigation to the authenticated home/member experience.
8. Confirm the invitation is claimed and the member/profile/social/resource/community rows are present.
9. Confirm all three profile-context embedding fields are populated.

Failure-feedback path:

1. Exercise a controlled non-production failure seam or test deployment; do not intentionally break production.
2. Confirm a toast appears, includes a reference, and contains no internal details.
3. Confirm the user remains on step 4, values remain present, and retry is enabled.
4. Resolve/remove the failure seam and confirm retry succeeds.
5. Check desktop and a mobile viewport such as 390×844, including toast visibility and button state.

### 10. Production verification and monitoring

After rollout, inspect Vercel production logs:

```bash
vercel logs --environment production --no-branch --level error --since 1h --limit 200 --json
vercel logs --environment production --no-branch --status-code 500 --since 1h --limit 200 --json
```

Confirm:

- No new `profiles_context_embedding_complete` violations.
- No new unhandled `POST /onboarding` 500 responses.
- Any controlled failure is findable by its diagnostic reference.
- Successful onboarding does not log personal form data.

Also inspect Supabase read-only state for the test account and remove test data only through an explicit, reviewed CLI/migration-safe cleanup process. Do not delete real-user records while investigating.

## Rollback and recovery

The migration is forward-only. If it introduces a regression, create another migration that recreates the last known-safe seven-argument function; do not roll back by editing migration history.

The application feedback changes are independently reversible through a Vercel rollback, but rolling back the feedback must not roll back the database correction. The corrected timestamp write is compatible with the existing schema constraint.

Before retrying affected real users, confirm their invite remains unclaimed and that there is no member row for their auth user. Do this read-only and avoid exposing their email or identifiers in shared logs. Once the fix is live, ask them to reopen the existing onboarding session or invitation and submit again; the saved browser draft should normally preserve their form data.

## Acceptance criteria

- A fresh invited user completes onboarding successfully in production.
- Step 4 requires only valid phone and contact email.
- Optional website/social fields may remain empty.
- Profile context embedding, input, and timestamp are all stored.
- Invite claiming and all profile-related writes remain atomic.
- No onboarding failure can return the button to idle without a toast or navigation explaining the outcome.
- Unexpected failures produce a safe support reference that can be correlated in Vercel logs.
- Draft data remains available after retryable failure.
- Focused, full, type-check, and lint gates pass with the local Supabase stack running.
- Desktop and mobile Chrome verification is documented in the handoff.
- Production logs remain free of `profiles_context_embedding_complete` violations after rollout.

## Explicit non-goals

- Making optional social fields mandatory.
- Replacing Sonner with inline error markup.
- Changing the AI Gateway provider or embedding model.
- Moving onboarding writes out of the atomic Supabase RPC.
- Editing Supabase or Vercel state manually in a dashboard.
- Broad onboarding UI redesign beyond the feedback and recovery behavior described here.
