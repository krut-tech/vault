-- Follow-up to 0012: `revoke ... from public` didn't actually remove
-- anon/authenticated's access, because Supabase grants EXECUTE on
-- public-schema functions directly to anon/authenticated/service_role
-- via ALTER DEFAULT PRIVILEGES at function-creation time — not through
-- the PUBLIC pseudo-role. Revoking from PUBLIC only strips a grant
-- that was never actually the one giving them access. Revoking
-- directly from anon and authenticated is what's needed (confirmed by
-- re-running the security advisor after 0012 — these still showed up
-- as "Public Can Execute SECURITY DEFINER Function").
--
-- service_role is intentionally left untouched — it's the backend/
-- trusted role and normally bypasses RLS/ACL concerns anyway, and the
-- edge functions in this repo use it legitimately.

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.notify_on_comment() from anon, authenticated;
revoke execute on function public.notify_on_file_delete() from anon, authenticated;
revoke execute on function public.notify_on_file_edit() from anon, authenticated;
revoke execute on function public.notify_on_file_rename() from anon, authenticated;
revoke execute on function public.notify_on_file_upload() from anon, authenticated;
revoke execute on function public.notify_on_folder_create() from anon, authenticated;
revoke execute on function public.notify_on_folder_delete() from anon, authenticated;
revoke execute on function public.notify_on_folder_rename() from anon, authenticated;
revoke execute on function public.notify_on_member_approved() from anon, authenticated;
revoke execute on function public.notify_on_member_joined() from anon, authenticated;
revoke execute on function public.notify_on_project_create() from anon, authenticated;
revoke execute on function public.notify_on_project_delete() from anon, authenticated;
revoke execute on function public.notify_on_project_rename() from anon, authenticated;
revoke execute on function public.notify_on_role_change() from anon, authenticated;
revoke execute on function public.notify_on_signup_pending() from anon, authenticated;
revoke execute on function public.notify_on_task_assignment() from anon, authenticated;
revoke execute on function public.notify_on_task_create_unassigned() from anon, authenticated;
revoke execute on function public.notify_on_task_delete() from anon, authenticated;
revoke execute on function public.protect_owner_role() from anon, authenticated;
revoke execute on function public.protect_profile_privileges() from anon, authenticated;
