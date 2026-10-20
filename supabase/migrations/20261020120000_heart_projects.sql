-- Individual pursuits and the curated, versioned Theme catalog.
create table public.heart_projects (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  title text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  description text not null check (description = btrim(description) and char_length(description) >= 1),
  position smallint not null check (position between 0 and 9),
  embedding vector(1536),
  embedding_input text,
  embedded_at timestamptz,
  constraint heart_projects_position_unique unique (member_id, position) deferrable initially deferred,
  constraint heart_projects_embedding_complete check ((embedding is null) = (embedding_input is null))
);
create index heart_projects_member_order on public.heart_projects(member_id, position);

create table public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name = btrim(name) and char_length(name) between 1 and 120),
  description text not null check (description = btrim(description) and char_length(description) between 1 and 500),
  embedding vector(1536) not null,
  embedding_input text not null,
  embedded_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.heart_project_match_settings (
  singleton boolean primary key default true check (singleton),
  min_similarity float8 not null default 0.42 check (min_similarity between 0 and 1),
  catalog_version bigint not null default 1
);
insert into public.heart_project_match_settings(singleton) values (true);

create table public.heart_project_theme_links (
  heart_project_id uuid not null references public.heart_projects(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  similarity float8 not null check (similarity between -1 and 1),
  match_version bigint not null,
  primary key (heart_project_id, theme_id)
);
create index heart_project_theme_links_theme on public.heart_project_theme_links(theme_id);

alter table public.heart_projects enable row level security;
alter table public.themes enable row level security;
alter table public.heart_project_theme_links enable row level security;
alter table public.heart_project_match_settings enable row level security;
create policy "heart projects readable by members" on public.heart_projects for select to authenticated using (public.is_member());
create policy "members insert own heart projects" on public.heart_projects for insert to authenticated with check (member_id = auth.uid() and public.is_member());
create policy "members update own heart projects" on public.heart_projects for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "members delete own heart projects" on public.heart_projects for delete to authenticated using (member_id = auth.uid());
create policy "active themes readable by members" on public.themes for select to authenticated using (public.is_member() and archived_at is null or public.is_admin());
create policy "admins manage themes" on public.themes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "links readable by members" on public.heart_project_theme_links for select to authenticated using (public.is_member());
create policy "match settings readable by admins" on public.heart_project_match_settings for select to authenticated using (public.is_admin());

-- Called inside project and Theme transactions; clients never write links directly.
create function public.rematch_heart_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_version bigint; v_threshold float8;
begin
  select catalog_version, min_similarity into v_version, v_threshold from heart_project_match_settings where singleton;
  delete from heart_project_theme_links where heart_project_id = p_project_id;
  insert into heart_project_theme_links(heart_project_id, theme_id, similarity, match_version)
  select p_project_id, ranked.id, ranked.similarity, v_version from (
    select t.id, 1 - (p.embedding <=> t.embedding) as similarity
    from heart_projects p cross join themes t
    where p.id = p_project_id and p.embedding is not null and t.archived_at is null
    order by p.embedding <=> t.embedding, t.id
    limit 4
  ) ranked where ranked.similarity >= v_threshold;
end;
$$;
revoke all on function public.rematch_heart_project(uuid) from public, anon, authenticated;

create function public.rematch_all_heart_projects() returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  for v_id in select id from heart_projects where embedding is not null loop
    perform rematch_heart_project(v_id);
  end loop;
end;
$$;
revoke all on function public.rematch_all_heart_projects() from public, anon, authenticated;

create function public.on_theme_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update heart_project_match_settings set catalog_version = catalog_version + 1 where singleton;
  perform rematch_all_heart_projects();
  return coalesce(new, old);
end;
$$;
create trigger themes_rematch after insert or update of name, description, embedding, archived_at or delete on public.themes
for each row execute function public.on_theme_change();

create function public.on_heart_project_embedding_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform rematch_heart_project(new.id);
  return new;
end;
$$;
create trigger heart_projects_rematch after update of embedding on public.heart_projects
for each row when (old.embedding is distinct from new.embedding)
execute function public.on_heart_project_embedding_change();

-- Backfill legacy descriptions as visible projects. A CLI backfill supplies each
-- independent embedding once the Theme catalog is available.
insert into public.heart_projects(member_id, title, description, position)
select member_id, 'Soul project', btrim(heart_project_description), 0
from public.profiles where nullif(btrim(heart_project_description), '') is not null;

create function public.replace_heart_projects_for_member(p_member_id uuid, p_projects jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_member_id is null or not exists(select 1 from members where id = p_member_id) then
    raise exception 'not_a_member' using errcode = 'P0003';
  end if;
  if jsonb_typeof(p_projects) <> 'array' or jsonb_array_length(p_projects) > 10 then
    raise exception 'invalid_heart_projects' using errcode = '23514';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_projects) as p(id uuid, title text, description text, position smallint, embedding text, embedding_input text)
    where p.id is null or p.title is null or p.description is null or p.embedding is null or p.embedding_input is null
      or p.title <> btrim(p.title) or char_length(p.title) not between 1 and 120
      or p.description <> btrim(p.description) or char_length(p.description) not between 1 and 2000
      or p.position not between 0 and 9 or p.embedding_input <> p.title || E'\n' || p.description)
    or exists(select 1 from jsonb_to_recordset(p_projects) as p(id uuid) group by p.id having count(*) > 1)
    or exists(select 1 from jsonb_to_recordset(p_projects) as p(position smallint) group by p.position having count(*) > 1)
    or exists(select 1 from jsonb_to_recordset(p_projects) as p(id uuid) where exists(select 1 from heart_projects h where h.id = p.id and h.member_id <> p_member_id))
  then raise exception 'invalid_heart_projects' using errcode = '23514'; end if;
  perform 1 from profiles where member_id = p_member_id for update;
  delete from heart_projects h where h.member_id = p_member_id
    and not exists(select 1 from jsonb_to_recordset(p_projects) as p(id uuid) where p.id = h.id);
  update heart_projects h set
    title = p.title, description = p.description, position = p.position,
    embedding = case when h.embedding_input = p.embedding_input then h.embedding else p.embedding::vector end,
    embedding_input = p.embedding_input,
    embedded_at = case when h.embedding_input = p.embedding_input then h.embedded_at else now() end
  from jsonb_to_recordset(p_projects) as p(id uuid, title text, description text, position smallint, embedding text, embedding_input text)
  where h.id = p.id and h.member_id = p_member_id;
  insert into heart_projects(id, member_id, title, description, position, embedding, embedding_input, embedded_at)
  select p.id, p_member_id, p.title, p.description, p.position, p.embedding::vector, p.embedding_input, now()
  from jsonb_to_recordset(p_projects) as p(id uuid, title text, description text, position smallint, embedding text, embedding_input text)
  where not exists(select 1 from heart_projects h where h.id = p.id);
  for v_id in select id from heart_projects where member_id = p_member_id loop
    perform rematch_heart_project(v_id);
  end loop;
end;
$$;
revoke all on function public.replace_heart_projects_for_member(uuid,jsonb) from public, anon, authenticated;

create function public.replace_own_heart_projects(p_projects jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_a_member' using errcode = 'P0003'; end if;
  perform replace_heart_projects_for_member(auth.uid(), p_projects);
end;
$$;
revoke execute on function public.replace_own_heart_projects(jsonb) from public, anon;
grant execute on function public.replace_own_heart_projects(jsonb) to authenticated;

-- Extend the existing atomic writes without changing their established gates.
create function public.complete_onboarding(
  p_user_id uuid, p_email text, p_code text, p_profile jsonb,
  p_socials jsonb, p_resources jsonb, p_community_ids uuid[],
  p_is_universal boolean, p_projects jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_member_id uuid;
begin
  v_member_id := complete_onboarding(p_user_id, p_email, p_code, p_profile,
    p_socials, p_resources, p_community_ids, p_is_universal);
  perform replace_heart_projects_for_member(v_member_id, p_projects);
  return v_member_id;
end;
$$;
revoke execute on function public.complete_onboarding(uuid,text,text,jsonb,jsonb,jsonb,uuid[],boolean,jsonb) from public, anon, authenticated;
grant execute on function public.complete_onboarding(uuid,text,text,jsonb,jsonb,jsonb,uuid[],boolean,jsonb) to service_role;

create function public.update_own_profile(
  p_profile jsonb, p_socials jsonb, p_resources jsonb, p_community_ids uuid[], p_projects jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform update_own_profile(p_profile, p_socials, p_resources, p_community_ids);
  perform replace_own_heart_projects(p_projects);
end;
$$;
revoke execute on function public.update_own_profile(jsonb,jsonb,jsonb,uuid[],jsonb) from public, anon;
grant execute on function public.update_own_profile(jsonb,jsonb,jsonb,uuid[],jsonb) to authenticated;

-- Profile-context vectors now describe Passions and seeking only.
drop trigger if exists clear_profile_context_embedding_on_update on public.profiles;
create trigger clear_profile_context_embedding_on_update before update of passions, heart_project_seeking
on public.profiles for each row when (old.passions is distinct from new.passions or old.heart_project_seeking is distinct from new.heart_project_seeking)
execute function private.clear_stale_profile_context_embedding();
drop trigger if exists reembed_profile_on_update on public.profiles;
create trigger reembed_profile_on_update after update of passions, heart_project_seeking
on public.profiles for each row when (old.passions is distinct from new.passions or old.heart_project_seeking is distinct from new.heart_project_seeking)
execute function private.invoke_profile_reembed_webhook();

revoke execute on function public.complete_onboarding(uuid,text,text,jsonb,jsonb,jsonb,uuid[],boolean) from service_role;
revoke execute on function public.update_own_profile(jsonb,jsonb,jsonb,uuid[]) from authenticated;
