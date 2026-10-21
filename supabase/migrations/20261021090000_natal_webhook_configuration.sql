-- Configure the DB webhook without storing its token in migration files.
-- Only a service-role client can set the project URL and shared webhook secret.
create function public.configure_natal_chart_webhook(p_project_url text, p_secret text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_project_url !~ '^https://[a-z0-9-]+[.]supabase[.]co$'
    or char_length(p_secret) < 20 then
    raise exception 'invalid_natal_webhook_configuration' using errcode = '23514';
  end if;

  select id into v_id from vault.decrypted_secrets where name = 'natal_chart_project_url';
  if v_id is null then
    perform vault.create_secret(p_project_url, 'natal_chart_project_url');
  else
    perform vault.update_secret(v_id, p_project_url, 'natal_chart_project_url');
  end if;

  select id into v_id from vault.decrypted_secrets where name = 'natal_chart_webhook_secret';
  if v_id is null then
    perform vault.create_secret(p_secret, 'natal_chart_webhook_secret');
  else
    perform vault.update_secret(v_id, p_secret, 'natal_chart_webhook_secret');
  end if;
end;
$$;
revoke execute on function public.configure_natal_chart_webhook(text,text) from public, anon, authenticated;
grant execute on function public.configure_natal_chart_webhook(text,text) to service_role;

create or replace function private.invoke_natal_chart_webhook() returns trigger
language plpgsql security definer set search_path = '' as $$
declare project_url text; webhook_secret text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'natal_chart_project_url';
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name = 'natal_chart_webhook_secret';
  if project_url is null or webhook_secret is null then
    raise warning 'Natal chart webhook skipped: configure_natal_chart_webhook must be called';
    update public.birth_details set chart_status = 'failed'
      where member_id = new.member_id and chart_generation = new.chart_generation;
    return new;
  end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/generate-natal-chart',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || webhook_secret),
    body := jsonb_build_object('member_id', new.member_id, 'generation', new.chart_generation),
    timeout_milliseconds := 10000
  );
  return new;
end;
$$;
