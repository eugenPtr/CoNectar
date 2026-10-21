-- Signed Storage URLs can outlive a later visibility change. Serve charts only
-- through the authenticated application route, which checks birth_details RLS
-- on every request. The worker and route use the service role for object IO.
drop policy "natal charts follow birth visibility" on storage.objects;
drop policy "owners delete old natal charts" on storage.objects;
