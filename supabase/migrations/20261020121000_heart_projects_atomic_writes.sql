-- All Member writes use the transaction RPC, which validates the complete
-- ordered set and rematches links before publishing anything.
drop policy "members insert own heart projects" on public.heart_projects;
drop policy "members update own heart projects" on public.heart_projects;
drop policy "members delete own heart projects" on public.heart_projects;
