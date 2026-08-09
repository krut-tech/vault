-- 0014's search_files() passed raw file content straight into
-- ts_headline. ts_headline only wraps MATCHED terms in <mark>...</mark>
-- — it does NOT escape the rest of the text. Since the frontend renders
-- this snippet with dangerouslySetInnerHTML (needed to render the
-- <mark> tags as real highlighting), any file containing literal
-- <, >, or & — completely normal in HTML/JSX/XML files, or just a
-- `a < b` comparison in any language — would inject raw markup into
-- the page. Fix: HTML-escape the content BEFORE handing it to
-- ts_headline, so the only real tags left in the output are the
-- <mark> ones we deliberately add via StartSel/StopSel.

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
      -- escape & first, then < and >, so the entity-escaping itself
      -- can't be double-escaped by the later replacements
      replace(replace(replace(f.content, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
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

revoke execute on function public.search_files(text, uuid, uuid, text, boolean, uuid, int) from public, anon;
grant execute on function public.search_files(text, uuid, uuid, text, boolean, uuid, int) to authenticated;
