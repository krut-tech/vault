-- Advanced Search (P1). Adds real file-content search without pulling
-- rows into the browser: a generated tsvector column (name weighted
-- above content) + GIN index, and a SECURITY INVOKER RPC that ranks
-- and snippets results server-side. security invoker (the default —
-- stated explicitly here) means this function runs as the CALLING
-- user, so the existing "files write" RLS policy still filters which
-- rows it can even see — no access-control logic is duplicated here.

alter table public.files
  add column if not exists content_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B')
  ) stored;

create index if not exists idx_files_content_tsv on public.files using gin (content_tsv);

create or replace function public.search_files(
  query text,
  p_project_id uuid default null,
  p_folder_id uuid default null,
  p_language text default null,
  p_favorites_only boolean default false,
  p_tag_id uuid default null,
  p_limit int default 30
)
returns table (
  id uuid,
  project_id uuid,
  folder_id uuid,
  name text,
  language text,
  is_favorite boolean,
  updated_at timestamptz,
  snippet text,
  rank real
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    f.id,
    f.project_id,
    f.folder_id,
    f.name,
    f.language,
    f.is_favorite,
    f.updated_at,
    ts_headline(
      'simple',
      f.content,
      websearch_to_tsquery('simple', query),
      'MaxFragments=2, MinWords=5, MaxWords=14, StartSel=<mark>, StopSel=</mark>'
    ) as snippet,
    ts_rank(f.content_tsv, websearch_to_tsquery('simple', query)) as rank
  from public.files f
  where f.is_deleted = false
    and f.content_tsv @@ websearch_to_tsquery('simple', query)
    and (p_project_id is null or f.project_id = p_project_id)
    and (p_folder_id is null or f.folder_id = p_folder_id)
    and (p_language is null or f.language = p_language)
    and (p_favorites_only is false or f.is_favorite = true)
    and (
      p_tag_id is null
      or exists (select 1 from public.file_tags ft where ft.file_id = f.id and ft.tag_id = p_tag_id)
    )
  order by rank desc, f.updated_at desc
  limit greatest(1, least(p_limit, 100));
$$;

-- RLS on `files` still applies (security invoker), but restrict who
-- can even call this to signed-in users, same as the rest of the app.
revoke execute on function public.search_files(text, uuid, uuid, text, boolean, uuid, int) from public, anon;
grant execute on function public.search_files(text, uuid, uuid, text, boolean, uuid, int) to authenticated;

comment on function public.search_files is
  'Full-text search over file name+content (name weighted higher). security invoker: runs as the caller, so the files select RLS policy still filters results — no project-access logic duplicated here.';
