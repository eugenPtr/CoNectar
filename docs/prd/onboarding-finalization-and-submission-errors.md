# Reliable Onboarding Finalization and Submission Feedback

## Problem Statement

An invited, authenticated person could complete every onboarding step but could not become a Member. Final submission generated People Search embeddings and then failed when the atomic onboarding operation inserted an incomplete set of Profile context-embedding metadata. The interface returned the finalization button to its idle state without explaining the failure, leaving the person unsure whether any data had been saved or whether retrying was safe.

The failure affected otherwise valid submissions and was unrelated to optional website or social-profile fields. The system also lacked a stable public contract for distinguishing validation, invitation, photo, AI processing, and database failures.

## Solution

Make onboarding finalization reliable, atomic, recoverable, and understandable:

- Store the Profile context embedding, normalized embedding input, and embedding timestamp together in the atomic onboarding operation.
- Keep phone and contact email as the only required fields on the Contact step.
- Store empty optional web and social fields as null.
- Return an exhaustive, typed result from the onboarding server action.
- Convert all anticipated and unexpected failures into safe Sonner toast feedback.
- Preserve the onboarding draft and allow deliberate retry after retryable failures.
- Give unexpected failures a short, non-sensitive support reference that can be correlated with structured server logs.
- Keep invitation claiming and all Member-related writes in one transaction, with the invitation claimed last.
- Keep selected-photo state truthful when a failed transaction causes an uploaded photo to be removed.

## User Stories

1. As an invited person, I want to complete onboarding after supplying all required information, so that I can become a Member.
2. As an invited person, I want phone and contact email to be the only mandatory Contact fields, so that I am not forced to maintain social profiles.
3. As an invited person, I want my phone number interpreted using the selected country, so that I do not need to manually construct an international number.
4. As an invited person, I want invalid phone numbers identified before submission, so that I can correct them immediately.
5. As an invited person, I want malformed contact emails identified before submission, so that my visible Member contact information is usable.
6. As an invited person, I want blank website and social fields accepted, so that optional information does not block registration.
7. As an invited person, I want blank optional fields stored as absent values, so that the directory does not contain misleading empty strings.
8. As an invited person, I want the finalization button disabled during submission, so that I cannot accidentally submit twice.
9. As an invited person, I want the button to show that finalization is in progress, so that I understand the delay while embeddings are generated.
10. As an invited person, I want successful onboarding to navigate me into the authenticated Member experience, so that completion is unambiguous.
11. As an invited person, I want my local draft removed only after successful completion, so that failed submissions do not destroy my work.
12. As an invited person, I want a visible toast for every failure, so that the interface never appears to fail silently.
13. As an invited person, I want infrastructure failures to keep me on the Contact step, so that I can retry without re-entering the form.
14. As an invited person, I want stale or missing earlier-step information highlighted on the earliest affected step, so that I know what to repair.
15. As an invited person, I want an invalid invitation explained safely, so that I know to request a replacement link.
16. As an invited person, I want an already-used invitation explained safely, so that I know to authenticate or contact an administrator.
17. As an invited person, I want AI processing outages distinguished from general submission failures, so that the feedback reflects the temporary service condition.
18. As an invited person, I want unexpected failures to include a support reference, so that an administrator can investigate without exposing internal details.
19. As an invited person, I want a cleaned-up photo selection removed from the preview, so that the interface does not imply it will be reused.
20. As an invited person, I want to retry after a transient failure and succeed, so that temporary outages do not permanently block registration.
21. As a Member, I want my Profile context embedding metadata stored consistently, so that People Search can index and retrieve my Profile safely.
22. As a Member, I want each offered Resource embedded and published with my Profile, so that other Members can discover what I offer.
23. As a Member, I want my selected affiliated communities stored with my Profile, so that my community context is represented.
24. As an administrator, I want invitation claiming to occur only after every onboarding write succeeds, so that failed registrations do not consume invitations.
25. As an administrator, I want failed onboarding transactions to publish no partial Member data, so that production data remains internally consistent.
26. As an administrator, I want support references logged with safe stage and database metadata, so that failures can be correlated in Vercel logs.
27. As an administrator, I want logs to exclude form contents, email, phone, invitation codes, embeddings, and credentials, so that diagnosis does not leak personal or secret data.
28. As an administrator, I want photo cleanup failures logged separately, so that cleanup problems do not obscure the original onboarding failure.
29. As an operator, I want schema and function corrections delivered as forward-only Supabase migrations, so that production history remains reproducible and reviewable.
30. As an operator, I want the onboarding operation executable only by the service role, so that clients cannot bind arbitrary users to invitations.
31. As an operator, I want the production migration applied before exercising the fixed flow, so that the application cannot call an incompatible database function.
32. As a developer, I want the action result to be exhaustive, so that adding a new failure category produces a compile-time obligation in the client.
33. As a developer, I want embedding and database failures represented by a typed internal boundary, so that error handling does not depend on matching human-readable messages.
34. As a developer, I want local and production-like end-to-end verification, so that unit tests are supported by evidence from the actual UI and database transaction.

## Implementation Decisions

- Preserve the existing four-step onboarding experience and its versioned browser draft.
- Preserve the Contact validation contract: a possible international phone number and syntactically valid contact email are required; website, LinkedIn, Facebook, Instagram, and X are optional.
- Normalize the phone number before persistence and normalize blank optional contact values to null.
- Correct the current seven-argument atomic onboarding database function with a forward-only migration. Historical migrations remain unchanged.
- Insert the Profile context embedding, embedding input, and `profile_context_embedded_at` timestamp in the same Profile statement.
- Preserve the transaction's authentication guard, locked invitation lookup, domain error codes, Resource validation, community validation, Member upsert, Profile insertion, Social insertion, Resource insertion, community-affiliation insertion, and invitation claim at the end.
- Preserve the function as security-definer with a restricted search path.
- Revoke execution from public, anonymous, and authenticated roles; grant execution only to the service role.
- Define a named discriminated server-action result covering success, invalid photo, photo upload failure, missing fields, already-claimed invitation, invalid invitation, embedding failure, and unexpected submission failure.
- Use a typed internal infrastructure error to distinguish embedding failures from database-operation failures while retaining the existing invitation-domain mappings.
- Generate short random diagnostic references that contain no user, email, invitation, or other personal information.
- Log unexpected failures with the reference, processing stage, safe database code, constraint name when available, error object, and safe deployment/request metadata.
- Return only the public failure category and diagnostic reference to the browser; never return raw database, AI Gateway, storage, stack, or credential details.
- Keep Sonner as the single transient-feedback mechanism. Do not add inline error paragraphs.
- Use longer toast visibility for failures containing a support reference and the normal duration for ordinary validation feedback.
- Preserve draft values after all failures and remove the draft only after success.
- For missing fields, calculate the earliest invalid onboarding step from current client state, navigate there, and mark the relevant controls invalid.
- Keep retryable infrastructure failures on the Contact step and always reset the submitting state.
- Upload Profile photos before the atomic operation when present. If a later operation fails, remove the uploaded object best-effort.
- If a server-side failure caused an uploaded photo to be removed, clear the selected file and preview and tell the person to select it again.
- A photo-cleanup failure must be logged independently and must never replace the original submission result.
- Keep Profile and Resource embeddings routed through Vercel AI Gateway using the established models and key.
- Use Supabase CLI for migration history, dry runs, application, and local resets. No database dashboard mutation is permitted.
- Use the existing Vercel deployment triggered by a push to `main`; no separate manual Vercel deployment flow is required for this change.

## Testing Decisions

- Tests assert externally observable behavior and durable contracts rather than private implementation details.
- The highest primary seam is the full browser registration flow: valid invitation, magic-link authentication, four onboarding steps, Contact-only required values, final submission, and authenticated navigation.
- The database side of the same seam verifies the resulting Member, Profile, Social, Resource, community affiliation, Profile embedding metadata, and claimed invitation.
- Component tests exercise Contact completion, disabled/loading button behavior, exhaustive toast feedback, retained visible values, retained draft, deliberate retry, successful navigation, and draft removal.
- Domain tests exercise required-field validation before database access, optional Social normalization, expected invitation results, typed embedding failures, typed unexpected database failures, and no writes when indexing fails.
- Database integration tests exercise successful atomic onboarding, populated embedding metadata, null optional Social values, stored Resources and affiliations, invitation claiming, and transaction rollback after a forced Profile failure.
- Privilege inspection verifies the current function signature, security-definer behavior, restricted search path, and service-role-only execution.
- Migration verification uses a full local Supabase reset and a linked-project dry run before remote application.
- Repository gates include focused onboarding tests, the complete test suite with the local Supabase stack running, type checking, linting, and diff whitespace validation.
- Manual UI verification covers desktop and a 390×844 mobile viewport, including Contact-only completion, optional blank fields, submission feedback, button recovery, navigation, and absence of horizontal overflow.
- Production-like verification uses a disposable identity and a designated unclaimed invitation, then queries the resulting records. Test data is removed afterward and the designated invitation is restored to an unclaimed state.
- Existing onboarding form tests, onboarding domain tests, PGlite transaction adapter tests, and live local Supabase RLS/RPC suites are the prior art to extend.

## Out of Scope

- Requiring website or any social-profile field.
- Replacing Sonner with inline feedback.
- Redesigning the onboarding steps or general visual language.
- Changing the AI Gateway provider, embedding model, or answer model.
- Moving onboarding writes out of the atomic Supabase operation.
- Changing invitation issuance or enumeration-safe authentication messaging.
- Persisting photo files in the browser draft.
- Editing historical migration files or rewriting production migration history.
- Manual Supabase or Vercel dashboard changes.
- Keeping disposable verification users or consumed test invitations in production.

## Further Notes

- The production incident was caused by a later migration recreating the onboarding function without assigning the Profile context embedding timestamp required by the existing completeness constraint.
- The production correction was applied through Supabase CLI before the successful end-to-end verification.
- The verified registration used the real localhost interface connected to production Supabase, including invitation validation, emailed magic-link authentication, onboarding submission, AI Gateway embedding, and final navigation.
- Supabase redirected the issued magic link to the configured production site URL. The returned authorization code was passed through the localhost callback to continue the explicitly requested localhost flow; the onboarding form and final submission were completed through the UI.
- After verification, the disposable auth user and all dependent Member data were deleted, and the designated invitation was reset to unclaimed.
- The implementation was committed and pushed to `main`, allowing the repository's Vercel integration to deploy it.
