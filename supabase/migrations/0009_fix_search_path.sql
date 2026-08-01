-- Root cause of "relation notifications does not exist" errors seen
-- during signup: none of these SECURITY DEFINER trigger functions
-- pinned search_path, so they resolve unqualified table names (like
-- `notifications`, `profiles`) using whatever search_path the CALLING
-- session happens to have. That's fine for calls that come in through
-- PostgREST (role `authenticated`, search_path includes `public`), but
-- signup runs handle_new_user() -> profiles insert -> notify triggers
-- inside Supabase Auth's own Postgres session, whose search_path does
-- NOT include `public` — so any bare table reference in that chain
-- fails with 42P01, aborts the transaction, and the whole signup 500s.
--
-- Pinning search_path on every SECURITY DEFINER function removes the
-- ambient dependency entirely (and is also standard Postgres security
-- practice for SECURITY DEFINER functions, independent of this bug).
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.is_admin() set search_path = public, pg_temp;
alter function public.notify_on_comment() set search_path = public, pg_temp;
alter function public.notify_on_file_delete() set search_path = public, pg_temp;
alter function public.notify_on_file_edit() set search_path = public, pg_temp;
alter function public.notify_on_file_rename() set search_path = public, pg_temp;
alter function public.notify_on_file_upload() set search_path = public, pg_temp;
alter function public.notify_on_folder_create() set search_path = public, pg_temp;
alter function public.notify_on_folder_delete() set search_path = public, pg_temp;
alter function public.notify_on_folder_rename() set search_path = public, pg_temp;
alter function public.notify_on_member_approved() set search_path = public, pg_temp;
alter function public.notify_on_member_joined() set search_path = public, pg_temp;
alter function public.notify_on_project_create() set search_path = public, pg_temp;
alter function public.notify_on_project_delete() set search_path = public, pg_temp;
alter function public.notify_on_project_rename() set search_path = public, pg_temp;
alter function public.notify_on_role_change() set search_path = public, pg_temp;
alter function public.notify_on_signup_pending() set search_path = public, pg_temp;
alter function public.notify_on_task_assignment() set search_path = public, pg_temp;
alter function public.notify_on_task_create_unassigned() set search_path = public, pg_temp;
alter function public.notify_on_task_delete() set search_path = public, pg_temp;
alter function public.protect_profile_privileges() set search_path = public, pg_temp;
alter function public.vault_read_secret(uuid) set search_path = public, pg_temp;
alter function public.vault_upsert_secret(text, text) set search_path = public, pg_temp;
