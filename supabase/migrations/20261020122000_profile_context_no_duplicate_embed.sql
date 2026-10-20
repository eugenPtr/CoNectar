-- Server actions provide a fresh Profile-context vector synchronously. Keep it,
-- and reserve the webhook for writes that did not provide one.
create or replace function private.clear_stale_profile_context_embedding()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.profile_context_embedding is not null
     and new.profile_context_embedding_input is distinct from old.profile_context_embedding_input then
    return new;
  end if;
  new.profile_context_embedding := null;
  new.profile_context_embedding_input := null;
  new.profile_context_embedded_at := null;
  return new;
end;
$$;

drop trigger if exists reembed_profile_on_insert on public.profiles;
create trigger reembed_profile_on_insert after insert on public.profiles
for each row when (new.profile_context_embedding is null)
execute function private.invoke_profile_reembed_webhook();

drop trigger if exists reembed_profile_on_update on public.profiles;
create trigger reembed_profile_on_update after update of passions, heart_project_seeking
on public.profiles for each row
when ((old.passions is distinct from new.passions or old.heart_project_seeking is distinct from new.heart_project_seeking)
  and new.profile_context_embedding is null)
execute function private.invoke_profile_reembed_webhook();
