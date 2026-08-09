-- P0 security + performance pass. No RLS is disabled, no authorization
-- outcome changes — every rewritten policy is checked line-by-line
-- against the previous `pg_policies` output before being dropped and
-- recreated. Three independent things are happening in this file:
--
--   A) auth_rls_initplan (52 advisor warnings): every RLS policy calls
--      auth.uid()/auth.role() (or a helper function that internally
--      calls them) directly, which Postgres re-evaluates PER ROW. This
--      wraps every such call in `(select ...)`, which lets the planner
--      hoist it into an InitPlan computed once per statement. Applied
--      both inside the six helper functions (is_admin, is_owner, etc.)
--      and at every policy call site.
--
--   B) multiple_permissive_policies (90 advisor warnings): most of
--      these come from a table having both a `for all` policy and a
--      separate `for select` policy — for a SELECT query, Postgres has
--      to evaluate BOTH and OR the results, which is pure overhead.
--      Two fix patterns, chosen per-table to keep behavior identical:
--        - identical qual on both     -> drop the redundant select
--          policy, keep the (now sole) `for all` policy.
--        - different qual on each     -> split the `for all` policy
--          into separate insert/update/delete policies so it no
--          longer overlaps the select policy at all.
--      profiles.update had a genuine case: two different UPDATE
--      policies (admin-manages-anyone, user-updates-own) that were
--      always both evaluated and OR'd together — merged into one
--      policy with an OR'd qual, which is exactly what two permissive
--      policies already produce, just evaluated once instead of twice.
--
--   C) unindexed_foreign_keys (39 advisor warnings): every FK column
--      the advisor flagged gets a plain btree index. These are pure
--      additions — nothing here changes query results, only how fast
--      joins/cascades/RLS EXISTS-subqueries against these columns run.
--
-- Two smaller items, unrelated to RLS performance:
--   D) `pg_net` was registered in the `public` schema (its actual
--      `net.http_post` etc. functions already live in their own `net`
--      schema and are called schema-qualified everywhere in this repo
--      — check-monitors' migration only ever calls `net.http_post`, so
--      moving the extension's own schema tag doesn't touch that).
--   E) trigger-only functions (handle_new_user, the notify_on_* fleet,
--      protect_owner_role, protect_profile_privileges) were callable
--      directly via PostgREST RPC by anyone, signed in or not — they
--      were never meant to be called that way, only fired by their
--      triggers. Revoking EXECUTE from PUBLIC closes that off; trigger
--      firing does NOT require the triggering session to hold EXECUTE
--      on the trigger function, so this cannot break any trigger.
--
-- NOT touched here, on purpose: is_admin/is_owner/is_owner_or_admin/
-- can_access_project/has_project_access/is_project_creator/
-- transfer_ownership stay callable — they're either meant to be called
-- directly (transfer_ownership) or just report the caller's own
-- membership status, which isn't sensitive to expose.
--
-- Also NOT touched here: Supabase Auth's leaked-password-protection
-- (HaveIBeenPwned check) toggle. That's an Auth service config flag,
-- not part of the Postgres schema — there's no SQL for it. It has to
-- be flipped on in Dashboard > Authentication > Policies (or via the
-- Management API with a token this migration doesn't have). Flagged
-- in the P0 report as a manual step.

-- ============================================================
-- A) Helper functions: wrap auth.uid() so it's computed once.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from profiles where id = (select auth.uid()) and role in ('owner','admin'));
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'owner');
$$;

create or replace function public.is_owner_or_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('owner','admin'));
$$;

create or replace function public.is_project_creator(pid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.projects where id = pid and created_by = (select auth.uid()));
$$;

create or replace function public.has_project_access(pid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.project_access where project_id = pid and user_id = (select auth.uid()));
$$;

create or replace function public.can_access_project(pid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid
      and (
        p.is_private = false
        or p.created_by = (select auth.uid())
        or public.has_project_access(p.id)
        or public.is_owner()
      )
  );
$$;

-- ============================================================
-- B) RLS policies: wrapped auth calls + redundancy removed.
-- ============================================================

-- activity_log: already cmd-specific (insert/select), just wrap.
drop policy if exists "team insert" on public.activity_log;
create policy "team insert" on public.activity_log for insert
  with check ((select auth.uid()) = actor_id);

drop policy if exists "team read" on public.activity_log;
create policy "team read" on public.activity_log for select
  using ((select auth.role()) = 'authenticated');

-- app_settings: already cmd-specific (select/update), just wrap.
drop policy if exists "settings readable by anyone authenticated" on public.app_settings;
create policy "settings readable by anyone authenticated" on public.app_settings for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists "settings writable by admin" on public.app_settings;
create policy "settings writable by admin" on public.app_settings for update
  using ((select is_admin()))
  with check ((select is_admin()));

-- board_columns: select's qual was identical to write's -> redundant, drop it.
drop policy if exists "board_columns select" on public.board_columns;
drop policy if exists "board_columns write" on public.board_columns;
create policy "board_columns write" on public.board_columns for all
  using ((select auth.role()) = 'authenticated' and exists (
    select 1 from boards b where b.id = board_columns.board_id and (select can_access_project(b.project_id))
  ))
  with check ((select auth.role()) = 'authenticated' and exists (
    select 1 from boards b where b.id = board_columns.board_id and (select can_access_project(b.project_id))
  ));

-- boards: same redundant-select pattern.
drop policy if exists "boards select" on public.boards;
drop policy if exists "boards write" on public.boards;
create policy "boards write" on public.boards for all
  using ((select auth.role()) = 'authenticated' and (select can_access_project(project_id)))
  with check ((select auth.role()) = 'authenticated' and (select can_access_project(project_id)));

-- collection_items: same redundant-select pattern.
drop policy if exists "collection_items select" on public.collection_items;
drop policy if exists "collection_items write" on public.collection_items;
create policy "collection_items write" on public.collection_items for all
  using ((select auth.role()) = 'authenticated' and (
    file_id is null or exists (select 1 from files f where f.id = collection_items.file_id and (select can_access_project(f.project_id)))
  ))
  with check ((select auth.role()) = 'authenticated' and (
    file_id is null or exists (select 1 from files f where f.id = collection_items.file_id and (select can_access_project(f.project_id)))
  ));

-- collections: "team read"/"team write" had identical quals -> redundant, drop read.
drop policy if exists "team read" on public.collections;
drop policy if exists "team write" on public.collections;
create policy "team write" on public.collections for all
  using ((select auth.role()) = 'authenticated')
  with check ((select auth.role()) = 'authenticated');

-- comments: already cmd-specific (delete/insert/select), just wrap.
drop policy if exists "author or admin delete" on public.comments;
create policy "author or admin delete" on public.comments for delete
  using ((select auth.uid()) = author_id or (select is_admin()));

drop policy if exists "comments insert" on public.comments;
create policy "comments insert" on public.comments for insert
  with check ((select auth.uid()) = author_id and exists (
    select 1 from files f where f.id = comments.file_id and (select can_access_project(f.project_id))
  ));

drop policy if exists "comments select" on public.comments;
create policy "comments select" on public.comments for select
  using ((select auth.role()) = 'authenticated' and exists (
    select 1 from files f where f.id = comments.file_id and (select can_access_project(f.project_id))
  ));

-- deploy_targets: write(is_admin) vs select(any authenticated w/ access)
-- have DIFFERENT quals, so the select policy can't just be dropped.
-- Split "write" into insert/update/delete so it stops overlapping select.
drop policy if exists "deploy_targets select" on public.deploy_targets;
create policy "deploy_targets select" on public.deploy_targets for select
  using ((select auth.role()) = 'authenticated' and (select can_access_project(project_id)));

drop policy if exists "deploy_targets write" on public.deploy_targets;
create policy "deploy_targets insert" on public.deploy_targets for insert
  with check ((select is_admin()) and (select can_access_project(project_id)));
create policy "deploy_targets update" on public.deploy_targets for update
  using ((select is_admin()) and (select can_access_project(project_id)))
  with check ((select is_admin()) and (select can_access_project(project_id)));
create policy "deploy_targets delete" on public.deploy_targets for delete
  using ((select is_admin()) and (select can_access_project(project_id)));

-- deployments: same admin-write-vs-any-read split as deploy_targets.
drop policy if exists "deployments select" on public.deployments;
create policy "deployments select" on public.deployments for select
  using ((select auth.role()) = 'authenticated' and exists (
    select 1 from deploy_targets dt where dt.id = deployments.target_id and (select can_access_project(dt.project_id))
  ));

drop policy if exists "deployments write" on public.deployments;
create policy "deployments insert" on public.deployments for insert
  with check ((select is_admin()) and exists (
    select 1 from deploy_targets dt where dt.id = deployments.target_id and (select can_access_project(dt.project_id))
  ));
create policy "deployments update" on public.deployments for update
  using ((select is_admin()) and exists (
    select 1 from deploy_targets dt where dt.id = deployments.target_id and (select can_access_project(dt.project_id))
  ))
  with check ((select is_admin()) and exists (
    select 1 from deploy_targets dt where dt.id = deployments.target_id and (select can_access_project(dt.project_id))
  ));
create policy "deployments delete" on public.deployments for delete
  using ((select is_admin()) and exists (
    select 1 from deploy_targets dt where dt.id = deployments.target_id and (select can_access_project(dt.project_id))
  ));

-- file_tags: redundant-select pattern again.
drop policy if exists "file_tags select" on public.file_tags;
drop policy if exists "file_tags write" on public.file_tags;
create policy "file_tags write" on public.file_tags for all
  using ((select auth.role()) = 'authenticated' and exists (
    select 1 from files f where f.id = file_tags.file_id and (select can_access_project(f.project_id))
  ))
  with check ((select auth.role()) = 'authenticated' and exists (
    select 1 from files f where f.id = file_tags.file_id and (select can_access_project(f.project_id))
  ));

-- file_versions: already cmd-specific (insert/select), just wrap.
-- (No update/delete policy exists on purpose — versions are immutable.)
drop policy if exists "file_versions insert" on public.file_versions;
create policy "file_versions insert" on public.file_versions for insert
  with check ((select auth.role()) = 'authenticated' and exists (
    select 1 from files f where f.id = file_versions.file_id and (select can_access_project(f.project_id))
  ));

drop policy if exists "file_versions select" on public.file_versions;
create policy "file_versions select" on public.file_versions for select
  using ((select auth.role()) = 'authenticated' and exists (
    select 1 from files f where f.id = file_versions.file_id and (select can_access_project(f.project_id))
  ));

-- files: redundant-select pattern.
drop policy if exists "files select" on public.files;
drop policy if exists "files write" on public.files;
create policy "files write" on public.files for all
  using ((select auth.role()) = 'authenticated' and (select can_access_project(project_id)))
  with check ((select auth.role()) = 'authenticated' and (select can_access_project(project_id)));

-- folders: redundant-select pattern.
drop policy if exists "folders select" on public.folders;
drop policy if exists "folders write" on public.folders;
create policy "folders write" on public.folders for all
  using ((select auth.role()) = 'authenticated' and (select can_access_project(project_id)))
  with check ((select auth.role()) = 'authenticated' and (select can_access_project(project_id)));

-- ip_allowlist: admin-write vs any-authenticated-read differ -> split.
drop policy if exists "team reads allowlist" on public.ip_allowlist;
create policy "team reads allowlist" on public.ip_allowlist for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists "admin writes allowlist" on public.ip_allowlist;
create policy "admin inserts allowlist" on public.ip_allowlist for insert
  with check ((select is_admin()));
create policy "admin updates allowlist" on public.ip_allowlist for update
  using ((select is_admin()))
  with check ((select is_admin()));
create policy "admin deletes allowlist" on public.ip_allowlist for delete
  using ((select is_admin()));

-- login_attempts: already cmd-specific (insert/select). insert's
-- with_check is a bare `true`, nothing to wrap there.
drop policy if exists "admin reads login attempts" on public.login_attempts;
create policy "admin reads login attempts" on public.login_attempts for select
  using ((select is_admin()));

-- monitor_checks: already cmd-specific (insert/select), just wrap.
drop policy if exists "system insert" on public.monitor_checks;
create policy "system insert" on public.monitor_checks for insert
  with check ((select auth.role()) = 'authenticated');

drop policy if exists "team read" on public.monitor_checks;
create policy "team read" on public.monitor_checks for select
  using ((select auth.role()) = 'authenticated');

-- monitors: admin-write vs any-authenticated-read differ -> split.
drop policy if exists "team read" on public.monitors;
create policy "team read" on public.monitors for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists "admin write" on public.monitors;
create policy "admin insert" on public.monitors for insert
  with check ((select is_admin()));
create policy "admin update" on public.monitors for update
  using ((select is_admin()))
  with check ((select is_admin()));
create policy "admin delete" on public.monitors for delete
  using ((select is_admin()));

-- notes: redundant-select pattern.
drop policy if exists "team read" on public.notes;
drop policy if exists "team write" on public.notes;
create policy "team write" on public.notes for all
  using ((select auth.role()) = 'authenticated')
  with check ((select auth.role()) = 'authenticated');

-- notifications: already cmd-specific (insert/select/update), just wrap.
drop policy if exists "system insert notifications" on public.notifications;
create policy "system insert notifications" on public.notifications for insert
  with check ((select auth.role()) = 'authenticated');

drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications for select
  using ((select auth.uid()) = user_id);

drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications update" on public.notifications for update
  using ((select auth.uid()) = user_id);

-- pdf_files: redundant-select pattern.
drop policy if exists "pdf_files select" on public.pdf_files;
drop policy if exists "pdf_files write" on public.pdf_files;
create policy "pdf_files write" on public.pdf_files for all
  using ((select auth.role()) = 'authenticated' and (select can_access_project(project_id)))
  with check ((select auth.role()) = 'authenticated' and (select can_access_project(project_id)));

-- profiles: "admins manage team profiles" and "users update own
-- profile" are BOTH permissive UPDATE policies with different quals —
-- genuinely evaluated together and OR'd every time. Merge into one
-- policy with the same OR, which two permissive policies already
-- compute, just without doing it twice.
drop policy if exists "profiles readable by team" on public.profiles;
create policy "profiles readable by team" on public.profiles for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists "admins manage team profiles" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
create policy "profiles update" on public.profiles for update
  using ((select is_admin()) or (select auth.uid()) = id)
  with check ((select is_admin()) or (select auth.uid()) = id);

-- project_access: already cmd-specific (delete/insert/select), just wrap.
drop policy if exists "project_access delete" on public.project_access;
create policy "project_access delete" on public.project_access for delete
  using ((select auth.role()) = 'authenticated' and ((select is_project_creator(project_id)) or (select is_owner())));

drop policy if exists "project_access insert" on public.project_access;
create policy "project_access insert" on public.project_access for insert
  with check ((select auth.role()) = 'authenticated' and ((select is_project_creator(project_id)) or (select is_owner())));

drop policy if exists "project_access select" on public.project_access;
create policy "project_access select" on public.project_access for select
  using ((select auth.role()) = 'authenticated' and (
    user_id = (select auth.uid()) or (select is_project_creator(project_id)) or (select is_owner())
  ));

-- projects: already cmd-specific (delete/insert/select/update), just wrap.
drop policy if exists "projects delete" on public.projects;
create policy "projects delete" on public.projects for delete
  using ((select auth.role()) = 'authenticated' and (created_by = (select auth.uid()) or (select is_owner())));

drop policy if exists "projects insert" on public.projects;
create policy "projects insert" on public.projects for insert
  with check ((select auth.role()) = 'authenticated' and (is_private = false or (select is_owner_or_admin())));

drop policy if exists "projects select" on public.projects;
create policy "projects select" on public.projects for select
  using ((select auth.role()) = 'authenticated' and (
    is_private = false or created_by = (select auth.uid()) or (select has_project_access(id)) or (select is_owner())
  ));

drop policy if exists "projects update" on public.projects;
create policy "projects update" on public.projects for update
  using ((select auth.role()) = 'authenticated' and (
    is_private = false or created_by = (select auth.uid()) or (select has_project_access(id)) or (select is_owner())
  ))
  with check (is_private = false or (select is_owner_or_admin()));

-- quick_tasks: redundant-select pattern.
drop policy if exists "team read" on public.quick_tasks;
drop policy if exists "team write" on public.quick_tasks;
create policy "team write" on public.quick_tasks for all
  using ((select auth.role()) = 'authenticated')
  with check ((select auth.role()) = 'authenticated');

-- tags: redundant-select pattern.
drop policy if exists "team read" on public.tags;
drop policy if exists "team write" on public.tags;
create policy "team write" on public.tags for all
  using ((select auth.role()) = 'authenticated')
  with check ((select auth.role()) = 'authenticated');

-- tasks: redundant-select pattern.
drop policy if exists "tasks select" on public.tasks;
drop policy if exists "tasks write" on public.tasks;
create policy "tasks write" on public.tasks for all
  using ((select auth.role()) = 'authenticated' and exists (
    select 1 from board_columns bc join boards b on b.id = bc.board_id
    where bc.id = tasks.column_id and (select can_access_project(b.project_id))
  ))
  with check ((select auth.role()) = 'authenticated' and exists (
    select 1 from board_columns bc join boards b on b.id = bc.board_id
    where bc.id = tasks.column_id and (select can_access_project(b.project_id))
  ));

-- time_entries: "own write" (auth.uid()=user_id) vs "team read" (any
-- authenticated) differ -> split "own write" so it stops overlapping select.
drop policy if exists "team read" on public.time_entries;
create policy "team read" on public.time_entries for select
  using ((select auth.role()) = 'authenticated');

drop policy if exists "own write" on public.time_entries;
create policy "own insert" on public.time_entries for insert
  with check ((select auth.uid()) = user_id);
create policy "own update" on public.time_entries for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own delete" on public.time_entries for delete
  using ((select auth.uid()) = user_id);

-- ============================================================
-- C) Missing indexes on FK columns the advisor flagged.
-- ============================================================

create index if not exists idx_activity_log_actor_id on public.activity_log(actor_id);
create index if not exists idx_app_settings_updated_by on public.app_settings(updated_by);
create index if not exists idx_board_columns_board_id on public.board_columns(board_id);
create index if not exists idx_boards_created_by on public.boards(created_by);
create index if not exists idx_boards_project_id on public.boards(project_id);
create index if not exists idx_collection_items_file_id on public.collection_items(file_id);
create index if not exists idx_collections_created_by on public.collections(created_by);
create index if not exists idx_comments_author_id on public.comments(author_id);
create index if not exists idx_comments_file_id on public.comments(file_id);
create index if not exists idx_deploy_targets_created_by on public.deploy_targets(created_by);
create index if not exists idx_deploy_targets_project_id on public.deploy_targets(project_id);
create index if not exists idx_deployments_target_id on public.deployments(target_id);
create index if not exists idx_file_tags_tag_id on public.file_tags(tag_id);
create index if not exists idx_file_versions_created_by on public.file_versions(created_by);
create index if not exists idx_file_versions_file_id on public.file_versions(file_id);
create index if not exists idx_files_created_by on public.files(created_by);
create index if not exists idx_files_folder_id on public.files(folder_id);
create index if not exists idx_files_project_id on public.files(project_id);
create index if not exists idx_folders_parent_id on public.folders(parent_id);
create index if not exists idx_folders_project_id on public.folders(project_id);
create index if not exists idx_ip_allowlist_created_by on public.ip_allowlist(created_by);
create index if not exists idx_monitor_checks_monitor_id on public.monitor_checks(monitor_id);
create index if not exists idx_monitors_created_by on public.monitors(created_by);
create index if not exists idx_notes_created_by on public.notes(created_by);
create index if not exists idx_notes_project_id on public.notes(project_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_pdf_files_folder_id on public.pdf_files(folder_id);
create index if not exists idx_pdf_files_project_id on public.pdf_files(project_id);
create index if not exists idx_pdf_files_uploaded_by on public.pdf_files(uploaded_by);
create index if not exists idx_project_access_granted_by on public.project_access(granted_by);
create index if not exists idx_project_access_user_id on public.project_access(user_id);
create index if not exists idx_projects_created_by on public.projects(created_by);
create index if not exists idx_quick_tasks_created_by on public.quick_tasks(created_by);
create index if not exists idx_quick_tasks_project_id on public.quick_tasks(project_id);
create index if not exists idx_tasks_assignee_id on public.tasks(assignee_id);
create index if not exists idx_tasks_column_id on public.tasks(column_id);
create index if not exists idx_time_entries_project_id on public.time_entries(project_id);
create index if not exists idx_time_entries_task_id on public.time_entries(task_id);
create index if not exists idx_time_entries_user_id on public.time_entries(user_id);

-- ============================================================
-- D) Move pg_net out of the public schema — NOT DONE.
-- ============================================================
-- `alter extension pg_net set schema extensions` fails with
-- "extension pg_net does not support SET SCHEMA": Supabase ships
-- pg_net marked non-relocatable in its control file. The only way to
-- actually move it is `drop extension pg_net` + `create extension
-- pg_net with schema extensions`, which would drop and recreate every
-- net.* object — a real risk to the check-monitors cron job for a
-- cosmetic schema-placement lint. Per the "don't modify/delete
-- production data, don't break working features" instruction, this is
-- left as-is. Its actual functions already live in their own `net`
-- schema (called schema-qualified everywhere), so this is a linter
-- nitpick about the extension's registration, not a real exposure —
-- documented as a remaining warning in the P0 report instead.

-- ============================================================
-- E) Trigger-only functions: close off direct RPC exposure.
-- ============================================================
-- None of these are meant to be called directly (only fired by their
-- triggers), and revoking EXECUTE from PUBLIC does not affect trigger
-- firing — Postgres's trigger mechanism doesn't check EXECUTE grants
-- on the trigger function for the session that caused the triggering
-- statement, only explicit calls (like PostgREST's /rpc/<fn>) do.

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.notify_on_comment() from public;
revoke execute on function public.notify_on_file_delete() from public;
revoke execute on function public.notify_on_file_edit() from public;
revoke execute on function public.notify_on_file_rename() from public;
revoke execute on function public.notify_on_file_upload() from public;
revoke execute on function public.notify_on_folder_create() from public;
revoke execute on function public.notify_on_folder_delete() from public;
revoke execute on function public.notify_on_folder_rename() from public;
revoke execute on function public.notify_on_member_approved() from public;
revoke execute on function public.notify_on_member_joined() from public;
revoke execute on function public.notify_on_project_create() from public;
revoke execute on function public.notify_on_project_delete() from public;
revoke execute on function public.notify_on_project_rename() from public;
revoke execute on function public.notify_on_role_change() from public;
revoke execute on function public.notify_on_signup_pending() from public;
revoke execute on function public.notify_on_task_assignment() from public;
revoke execute on function public.notify_on_task_create_unassigned() from public;
revoke execute on function public.notify_on_task_delete() from public;
revoke execute on function public.protect_owner_role() from public;
revoke execute on function public.protect_profile_privileges() from public;
