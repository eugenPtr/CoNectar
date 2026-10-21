-- Birth information is isolated from the member-readable profiles row.
create table public.birth_details (
  member_id uuid primary key references public.members(id) on delete cascade,
  birth_date date not null check (birth_date <= current_date),
  birth_time time(0) without time zone not null,
  birthplace text not null check (char_length(btrim(birthplace)) between 2 and 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  timezone text not null check (char_length(btrim(timezone)) between 3 and 100),
  is_visible boolean not null default true,
  chart_status text not null default 'pending' check (chart_status in ('pending', 'ready', 'failed')),
  chart_path text,
  chart_generation uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  constraint birth_chart_ready_has_path check ((chart_status = 'ready') = (chart_path is not null))
);

alter table public.birth_details enable row level security;
create policy "birth details visible to owner or members when shared"
  on public.birth_details for select to authenticated
  using (public.is_member() and (member_id = auth.uid() or is_visible));
revoke all on public.birth_details from public, anon, authenticated;
grant select on public.birth_details to authenticated;
grant all on public.birth_details to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('natal-charts', 'natal-charts', false, 2097152, array['image/svg+xml'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = array['image/svg+xml'];

create policy "natal charts follow birth visibility" on storage.objects
  for select to authenticated using (
    bucket_id = 'natal-charts' and public.is_member() and exists (
      select 1 from public.birth_details b
      where b.chart_path = name and b.chart_status = 'ready'
        and (b.member_id = auth.uid() or b.is_visible)
    )
  );
create policy "owners delete old natal charts" on storage.objects
  for delete to authenticated using (
    bucket_id = 'natal-charts' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the established transaction RPCs call this helper.
create function private.save_member_birth_data(p_member_id uuid, p_birth jsonb)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if p_birth is null or p_birth = 'null'::jsonb then
    delete from public.birth_details where member_id = p_member_id;
    return;
  end if;
  if jsonb_typeof(p_birth) <> 'object'
    or nullif(btrim(p_birth->>'birth_date'), '') is null
    or nullif(btrim(p_birth->>'birth_time'), '') is null
    or nullif(btrim(p_birth->>'birthplace'), '') is null
    or nullif(btrim(p_birth->>'timezone'), '') is null
    or p_birth->>'latitude' is null or p_birth->>'longitude' is null
  then raise exception 'invalid_birth_data' using errcode = '23514'; end if;

  insert into public.birth_details (member_id, birth_date, birth_time, birthplace,
    latitude, longitude, timezone, is_visible)
  values (p_member_id, (p_birth->>'birth_date')::date, (p_birth->>'birth_time')::time,
    btrim(p_birth->>'birthplace'), (p_birth->>'latitude')::double precision,
    (p_birth->>'longitude')::double precision, btrim(p_birth->>'timezone'),
    coalesce((p_birth->>'is_visible')::boolean, true))
  on conflict (member_id) do update set
    birth_date = excluded.birth_date, birth_time = excluded.birth_time,
    birthplace = excluded.birthplace, latitude = excluded.latitude,
    longitude = excluded.longitude, timezone = excluded.timezone,
    is_visible = excluded.is_visible, updated_at = now();
end;
$$;
revoke all on function private.save_member_birth_data(uuid,jsonb) from public, anon, authenticated;

create function private.invalidate_birth_chart() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.birth_date is distinct from new.birth_date
    or old.birth_time is distinct from new.birth_time
    or old.birthplace is distinct from new.birthplace
    or old.latitude is distinct from new.latitude
    or old.longitude is distinct from new.longitude
    or old.timezone is distinct from new.timezone then
    new.chart_generation := gen_random_uuid();
    new.chart_status := 'pending';
    new.chart_path := null;
  end if;
  return new;
end;
$$;
create trigger invalidate_birth_chart before update on public.birth_details
for each row execute function private.invalidate_birth_chart();

create function private.invoke_natal_chart_webhook() returns trigger
language plpgsql security definer set search_path = '' as $$
declare project_url text; service_role_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_role_key from vault.decrypted_secrets where name = 'service_role_key';
  if project_url is null or service_role_key is null then
    raise warning 'Natal chart webhook skipped: Vault secrets project_url and service_role_key are required';
    update public.birth_details set chart_status = 'failed'
      where member_id = new.member_id and chart_generation = new.chart_generation;
    return new;
  end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/generate-natal-chart',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key),
    body := jsonb_build_object('member_id', new.member_id, 'generation', new.chart_generation),
    timeout_milliseconds := 10000
  );
  return new;
end;
$$;
create trigger generate_natal_chart_after_insert after insert on public.birth_details
for each row execute function private.invoke_natal_chart_webhook();
create trigger generate_natal_chart_after_change after update of chart_generation on public.birth_details
for each row when (old.chart_generation is distinct from new.chart_generation)
execute function private.invoke_natal_chart_webhook();

create function public.retry_own_natal_chart() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'not_a_member' using errcode = 'P0003'; end if;
  update public.birth_details set chart_generation = gen_random_uuid(),
    chart_status = 'pending', chart_path = null, updated_at = now()
  where member_id = auth.uid() and chart_status = 'failed';
  if not found then raise exception 'chart_not_retryable' using errcode = 'P0004'; end if;
end;
$$;
revoke execute on function public.retry_own_natal_chart() from public, anon;
grant execute on function public.retry_own_natal_chart() to authenticated;

create function public.complete_onboarding(
  p_user_id uuid, p_email text, p_code text, p_profile jsonb,
  p_socials jsonb, p_resources jsonb, p_community_ids uuid[],
  p_is_universal boolean, p_projects jsonb, p_birth jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_member_id uuid;
begin
  v_member_id := public.complete_onboarding(p_user_id, p_email, p_code, p_profile,
    p_socials, p_resources, p_community_ids, p_is_universal, p_projects);
  perform private.save_member_birth_data(v_member_id, p_birth);
  return v_member_id;
end;
$$;
revoke execute on function public.complete_onboarding(uuid,text,text,jsonb,jsonb,jsonb,uuid[],boolean,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.complete_onboarding(uuid,text,text,jsonb,jsonb,jsonb,uuid[],boolean,jsonb,jsonb) to service_role;
revoke execute on function public.complete_onboarding(uuid,text,text,jsonb,jsonb,jsonb,uuid[],boolean,jsonb) from service_role;

create function public.update_own_profile(
  p_profile jsonb, p_socials jsonb, p_resources jsonb, p_community_ids uuid[],
  p_projects jsonb, p_birth jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.update_own_profile(p_profile, p_socials, p_resources, p_community_ids, p_projects);
  perform private.save_member_birth_data(auth.uid(), p_birth);
end;
$$;
revoke execute on function public.update_own_profile(jsonb,jsonb,jsonb,uuid[],jsonb,jsonb) from public, anon;
grant execute on function public.update_own_profile(jsonb,jsonb,jsonb,uuid[],jsonb,jsonb) to authenticated;
revoke execute on function public.update_own_profile(jsonb,jsonb,jsonb,uuid[],jsonb) from authenticated;
