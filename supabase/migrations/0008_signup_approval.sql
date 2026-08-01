-- Require owner/admin approval before a new signup can access the app.
--
-- is_active already exists (added in 0005) and is reused here as the
-- login gate for BOTH states:
--   * pending  -> approved_at is null,     is_active = false
--   * approved -> approved_at is not null, is_active = true
--   * removed  -> approved_at is not null, is_active = false
--     (handled by the existing remove-team-member function, which also
--     bans the Supabase Auth login, so removed members never even reach
--     a session in practice)

alter table public.profiles add column if not exists approved_at timestamptz;

-- Backfill: everyone who already exists today (owner + current team) is
-- grandfathered in as already-approved so nobody currently using the app
-- gets locked out.
update public.profiles set approved_at = created_at where approved_at is null;

-- New signups now start inactive + unapproved until an owner/admin
-- approves them from the Admin panel.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, is_active)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', false);
  return new;
end;
$$ language plpgsql security definer;

-- The existing "users update own profile" policy only checks row
-- ownership (auth.uid() = id), not which columns change — so a pending
-- signup could otherwise self-approve by calling
-- supabase.from('profiles').update({ is_active: true }) directly. This
-- trigger reverts role/is_active/approved_at on any update performed by
-- a non-admin authenticated user. auth.uid() is null for edge-function
-- calls made with the service role key, so those pass through untouched.
create or replace function public.protect_profile_privileges()
returns trigger as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    new.approved_at := old.approved_at;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_profile_privileges_trg on public.profiles;
create trigger protect_profile_privileges_trg
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- Owners/admins can update ANY profile row (needed to approve pending
-- signups and to change another member's role from the Admin panel).
-- Note: this also fixes a pre-existing bug where AdminPanel's role
-- dropdown silently did nothing for anyone other than yourself, because
-- no policy previously allowed updating someone else's row at all.
drop policy if exists "admins manage team profiles" on public.profiles;
create policy "admins manage team profiles" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

comment on column public.profiles.approved_at is
  'null = pending admin approval (cannot access the app past the pending screen). Set once an owner/admin approves the signup.';

-- "X joined the team" previously fired on raw signup (insert), which was
-- misleading once signups start out pending. Split it in two:
--   1. on insert, tell owners/admins a new signup is waiting for them
--   2. on approval, tell everyone else the member actually joined
create or replace function public.notify_on_signup_pending()
returns trigger as $$
begin
  insert into notifications (user_id, message, link)
  select p.id,
         coalesce(new.full_name, new.email) || ' signed up — pending your approval',
         '/admin'
  from profiles p
  where p.id <> new.id and p.role in ('owner','admin');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_member_joined on profiles;
drop trigger if exists trg_notify_on_signup_pending on profiles;
create trigger trg_notify_on_signup_pending
  after insert on profiles
  for each row execute function public.notify_on_signup_pending();

create or replace function public.notify_on_member_approved()
returns trigger as $$
begin
  if old.approved_at is null and new.approved_at is not null then
    insert into notifications (user_id, message, link)
    select p.id,
           coalesce(new.full_name, new.email) || ' joined the team',
           '/admin'
    from profiles p
    where p.id <> new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_member_approved on profiles;
create trigger trg_notify_on_member_approved
  after update of approved_at on profiles
  for each row execute function public.notify_on_member_approved();
