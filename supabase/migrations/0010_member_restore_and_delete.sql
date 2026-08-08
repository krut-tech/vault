-- Lets an owner/admin either restore a removed member (undo remove-team-member)
-- or permanently delete one.
--
-- True hard-delete isn't always possible: projects/files/file_versions/
-- collections/comments/activity_log/notes/quick_tasks/boards/time_entries/
-- deploy_targets/monitors all have "created_by/author_id/actor_id/user_id
-- uuid not null references profiles(id)" WITHOUT on delete cascade, by
-- design (0005's comment: "their projects/files/comments keep showing
-- them as the author"). So:
--   * a member with zero authored rows anywhere -> auth user + profile
--     row are both actually deleted (deleted_at is moot, row is gone).
--   * a member with authored rows -> the profile row is kept (so FK'd
--     history keeps resolving) but PII is scrubbed and deleted_at is
--     set. The delete-team-member edge function decides which path
--     applies per-member; this migration just adds the column + guards.

alter table public.profiles add column if not exists deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  'Set by delete-team-member when a removed member is permanently deleted but their row must be kept for FK integrity (they authored projects/files/etc). Their email/full_name/avatar_url/totp_secret are scrubbed at the same time. Row is left alone (deleted_at stays null forever) for anyone who was actually hard-deleted, since that row no longer exists.';

-- Extend the existing privilege guard so a member can't self-serve their
-- own deleted_at via the "users update own profile" policy either.
create or replace function public.protect_profile_privileges()
returns trigger as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    new.approved_at := old.approved_at;
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
