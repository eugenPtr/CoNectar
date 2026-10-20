-- Eight Admin-entered Romanian Themes and five representative Romanian
-- projects were scored with text-embedding-3-small. At 0.48, the dance space,
-- therapy school, and agroforestry project keep their expected multi-label
-- matches; incidental bicycle repairs remain unmatched.
update public.heart_project_match_settings
set min_similarity = 0.48, catalog_version = catalog_version + 1
where singleton;
select public.rematch_all_heart_projects();
