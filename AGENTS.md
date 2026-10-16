<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git workflow

- Implement all work on the currently checked-out branch unless the user explicitly specifies a different branch.
- Never commit directly to `main`.

# Tooling

Stack is Supabase + Vercel (ADR-0003). Infrastructure and schema changes must go through their CLI so they are reproducible, reviewable, and in git. **No manual dashboard changes** — the dashboard is read-only for inspection.

## Supabase

- Use the Supabase CLI for schema and platform changes: `supabase start` for the local stack, migrations in `supabase/migrations/`, `supabase functions deploy` for Edge Functions, `supabase gen types` for generated types.
- Schema, RLS policies, triggers, and DB webhooks are defined as migrations — never hand-edited in the dashboard.
- For data-only inserts into existing tables, insert directly into the intended database when possible; do not create a migration solely for the insert. Use the Supabase CLI if it supports the operation, otherwise use a service-role client. Check for an existing row first and verify the inserted row afterward.
- Tests run against the local stack (`supabase start`), not a remote project.

## Vercel

- Use the Vercel CLI for env vars (`vercel env`), project linking, and deploys.
- Environment variables are managed via `vercel env` (and pulled locally with `vercel env pull`) — not added by hand in the dashboard.

# UI feedback

- All transient feedback to the user — errors and confirmations alike — is shown as a **toast** (`sonner`), not inline `<p>` markup. `<Toaster />` is mounted once in `app/layout.tsx`; server actions pass feedback via a redirect query param (`?error=` / `?sent=`) that a client component reads, surfaces as a toast, then strips from the URL. Default duration 5s.

# UI verification

- Any change that affects the rendered UI or user interactions must be tested manually in a browser before handoff. Exercise the affected flow at desktop and mobile viewport sizes, verify relevant interactive and validation states, and report what was checked.
- If the in-app browser session is unavailable, use a local browser automation tool such as `agent-browser` or Playwright for that verification. Do not stop at a browser connection error when a local browser can run.

# Navigation

- Back affordances use the reusable `<BackButton>` component (history-aware: `router.back()` when in-app history exists, else navigates to `fallbackHref`). Don't hand-roll `router.back()` per page.

# People Search (AI)

- Embeddings and LLM answers both go through the **Vercel AI Gateway** (one key, `AI_GATEWAY_API_KEY`) — see ADR-0008. Embeddings: `openai/text-embedding-3-small` (1536-dim). Answers: `claude-haiku-4-5`. Never wire providers directly.
- Each Resource is embedded independently from its normalized description; synchronous indexing must succeed before Resources are published.
