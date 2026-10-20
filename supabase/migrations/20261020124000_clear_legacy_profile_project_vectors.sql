-- Older Profile-context vectors blend Passions with the legacy scalar Heart
-- Project. Remove only those vectors; the CLI backfill restores Passions-only
-- vectors after Gateway credits are available. This update does not fire the
-- Passions/seeking re-embedding trigger.
update public.profiles
set profile_context_embedding = null,
    profile_context_embedding_input = null,
    profile_context_embedded_at = null
where profile_context_embedding_input like E'%Proiect de suflet:%';
