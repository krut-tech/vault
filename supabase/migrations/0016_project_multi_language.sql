-- Projects previously had exactly one `language`. This makes it a
-- proper multi-select: `languages text[]`, so a project can be tagged
-- Python + JavaScript, for example. Only projects.language is touched
-- — files.language stays a single value (a given file genuinely has
-- one language; that's correct and unrelated to this change).
--
-- Verified before writing this: no RLS policy, trigger, or function
-- anywhere references projects.language (the notify_on_project_rename
-- trigger only watches the `name` column), so dropping the old column
-- is safe with nothing else to update on the DB side.

alter table public.projects add column languages text[] not null default '{}';

-- Backfill: every existing project's one language becomes a one-item array.
update public.projects set languages = array[language] where languages = '{}';

-- cardinality() (not array_length()) because array_length() of an
-- empty array returns NULL, not 0 — a check using array_length would
-- silently accept empty arrays (NULL comparisons pass CHECK
-- constraints in Postgres). cardinality() correctly returns 0.
alter table public.projects add constraint projects_languages_not_empty check (cardinality(languages) > 0);

alter table public.projects drop column language;
