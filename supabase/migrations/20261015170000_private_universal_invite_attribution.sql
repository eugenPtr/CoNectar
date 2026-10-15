-- Keep invite provenance outside member-readable rows. Only the service role
-- reads this table for the admin dashboard.
create table public.universal_invite_signups (
  member_id uuid primary key references public.members(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);
create index universal_invite_signups_created_at_idx
  on public.universal_invite_signups (created_at desc);
alter table public.universal_invite_signups enable row level security;
revoke all on public.universal_invite_signups from public, anon, authenticated;
grant select, insert on public.universal_invite_signups to service_role;

insert into public.universal_invite_signups (member_id, code, created_at)
select id, universal_invite_code, created_at from public.members
where universal_invite_code is not null;

create or replace function public.complete_onboarding(
  p_user_id uuid, p_email text, p_code text, p_profile jsonb,
  p_socials jsonb, p_resources jsonb, p_community_ids uuid[],
  p_is_universal boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_invite invites%rowtype;
begin
  p_is_universal := coalesce(p_is_universal, false);
  if p_user_id is null then raise exception 'unauthenticated' using errcode = 'P0003'; end if;
  if p_is_universal then
    if p_code is null or p_code = '' then raise exception 'invite_not_found' using errcode = 'P0001'; end if;
    if exists (select 1 from invites where code = p_code) then
      raise exception 'universal_invite_collision' using errcode = 'P0004';
    end if;
  else
    select * into v_invite from invites where code = p_code for update;
    if not found then raise exception 'invite_not_found' using errcode = 'P0001'; end if;
    if v_invite.claimed_by is not null then raise exception 'invite_already_claimed' using errcode = 'P0002'; end if;
  end if;
  if jsonb_array_length(p_resources) < 1 then raise exception 'resource_required' using errcode = '23514'; end if;
  if coalesce(array_length(p_community_ids, 1), 0) < 1 or exists (
    select 1 from unnest(p_community_ids) id
    where not exists (select 1 from affiliated_communities c where c.id = id)
  ) then raise exception 'community_required' using errcode = '23514'; end if;

  insert into members (id, email) values (p_user_id, p_email)
  on conflict (id) do update set email = excluded.email;
  if p_is_universal then
    insert into universal_invite_signups (member_id, code) values (p_user_id, p_code);
  end if;
  insert into profiles (member_id, first_name, last_name, location, passions,
    heart_project_description, heart_project_seeking, profile_photo_path,
    profile_context_embedding, profile_context_embedding_input, profile_context_embedded_at)
  values (p_user_id, p_profile->>'first_name', p_profile->>'last_name',
    p_profile->>'location', p_profile->>'passions', nullif(p_profile->>'heart_project_description', ''),
    (p_profile->>'heart_project_seeking')::boolean, nullif(p_profile->>'profile_photo_path', ''),
    (p_profile->>'profile_context_embedding')::vector, p_profile->>'profile_context_embedding_input', now());
  insert into socials (member_id, phone, email, website, linkedin, facebook, instagram, x)
  values (p_user_id, p_socials->>'phone', p_socials->>'email', nullif(p_socials->>'website',''),
    nullif(p_socials->>'linkedin',''), nullif(p_socials->>'facebook',''),
    nullif(p_socials->>'instagram',''), nullif(p_socials->>'x',''));
  insert into resources (member_id, description, classification, position, embedding, embedding_input)
  select p_user_id, r.description, r.classification::resource_classification, r.position,
    r.embedding::vector, r.description from jsonb_to_recordset(p_resources)
    as r(description text, classification text, position smallint, embedding text);
  insert into profile_community_affiliations (member_id, community_id)
  select p_user_id, distinct_id from unnest(p_community_ids) distinct_id group by distinct_id;
  if not p_is_universal then
    update invites set claimed_by = p_user_id, claimed_at = now() where code = p_code;
  end if;
  return p_user_id;
end;
$$;

alter table public.members drop column universal_invite_code;
