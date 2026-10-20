-- Retrieve each published Heart Project as pursuit evidence, independently of
-- Resource offers and Profile Passions. This function runs with the caller's
-- privileges, so the Heart Project and Profile SELECT policies remain active.
create index heart_projects_embedding_hnsw
  on public.heart_projects using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create function public.match_heart_projects(
  query_embedding vector(1536), match_count int, min_similarity float
) returns table (
  member_id uuid, first_name text, last_name text,
  project_id uuid, title text, description text, similarity float
) language sql stable security invoker as $$
  select p.member_id, p.first_name, p.last_name,
    h.id, h.title, h.description, 1 - (h.embedding <=> query_embedding)
  from public.heart_projects h
  join public.profiles p on p.member_id = h.member_id
  where h.embedding is not null
    and 1 - (h.embedding <=> query_embedding) >= min_similarity
  order by h.embedding <=> query_embedding, h.id
  limit match_count;
$$;

revoke all on function public.match_heart_projects(vector(1536), int, float) from public, anon;
grant execute on function public.match_heart_projects(vector(1536), int, float) to authenticated;
