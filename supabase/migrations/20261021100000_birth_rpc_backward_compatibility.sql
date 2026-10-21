-- Keep the currently deployed application working until the new frontend ships.
-- The legacy RPCs do not touch birth_details; the new overloads save it atomically.
grant execute on function public.complete_onboarding(uuid,text,text,jsonb,jsonb,jsonb,uuid[],boolean,jsonb)
  to service_role;
grant execute on function public.update_own_profile(jsonb,jsonb,jsonb,uuid[],jsonb)
  to authenticated;
