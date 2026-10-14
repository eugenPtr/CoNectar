-- Authenticated invitees need the community choices before they become members.
-- Affiliation rows remain member-only; only the public community names are exposed.
drop policy "communities readable by members" on public.affiliated_communities;

create policy "communities readable by authenticated users"
  on public.affiliated_communities
  for select
  to authenticated
  using (true);
