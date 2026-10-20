-- Keep the backfill callable for local migration integration tests and for
-- retrying an interrupted data import. Existing projects are never overwritten.
create function public.backfill_legacy_heart_projects() returns integer
language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  insert into heart_projects(member_id, title, description, position)
  select p.member_id, 'Soul project', btrim(p.heart_project_description), 0
  from profiles p
  where nullif(btrim(p.heart_project_description), '') is not null
    and not exists(select 1 from heart_projects h where h.member_id = p.member_id);
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke all on function public.backfill_legacy_heart_projects() from public, anon, authenticated;
grant execute on function public.backfill_legacy_heart_projects() to service_role;

select public.backfill_legacy_heart_projects();
