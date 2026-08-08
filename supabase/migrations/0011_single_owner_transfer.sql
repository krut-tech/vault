-- Nothing today stops an admin from picking "Owner" in the role dropdown
-- for anyone (or themselves) — updateMemberRole is a plain client-side
-- `profiles.update({role})`, and the RLS policy from 0008 only checks
-- that the CALLER is an owner/admin, not what role they're assigning.
-- That means multiple owners (or an admin self-promoting) was possible.
--
-- Fixes, in two parts:
--   1. DB-level invariant: at most one profile can have role = 'owner'
--      at any time, enforced by a partial unique index (not just app
--      logic, so it holds even against direct SQL/future bugs).
--   2. transfer_ownership(): the only way to grant someone 'owner' now.
--      Atomically flips the caller (who must already be the current
--      owner) to 'admin' and the target to 'owner' in one statement, so
--      the unique index above is never even momentarily violated.

create unique index if not exists profiles_single_owner_idx
  on public.profiles ((role))
  where role = 'owner';

comment on index public.profiles_single_owner_idx is
  'Enforces at most one owner across the whole team. Ownership changes hands only via transfer_ownership(), never a plain role update.';

create or replace function public.transfer_ownership(new_owner_id uuid)
returns void as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  target_role text;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into caller_role from public.profiles where id = caller_id;
  if caller_role is distinct from 'owner' then
    raise exception 'Only the current owner can transfer ownership';
  end if;

  if new_owner_id = caller_id then
    raise exception 'You are already the owner';
  end if;

  select role into target_role from public.profiles where id = new_owner_id;
  if target_role is null then
    raise exception 'Target member not found';
  end if;
  if target_role <> 'admin' then
    raise exception 'Only an existing admin can be promoted to owner — promote them to admin first';
  end if;

  -- Lets protect_owner_role() (below) know this specific statement is
  -- the sanctioned ownership handoff, not a plain client update trying
  -- to sneak past it. is_local=true so it self-clears at end of tx.
  perform set_config('app.allow_owner_transfer', 'true', true);

  -- Two sequential statements, not one combined update: demote the
  -- current owner FIRST so the unique index never has to reason about
  -- an in-flight swap (Postgres doesn't guarantee row-processing order
  -- within a single multi-row UPDATE), then promote the target. At
  -- every statement boundary there's at most one owner.
  update public.profiles set role = 'admin' where id = caller_id;
  update public.profiles set role = 'owner' where id = new_owner_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

comment on function public.transfer_ownership(uuid) is
  'Atomically hands ownership to an existing admin and demotes the caller to admin. Only callable by the current owner.';

grant execute on function public.transfer_ownership(uuid) to authenticated;

-- Belt-and-suspenders: even though the UI only offers "Owner" through
-- transfer_ownership(), RLS alone previously let any admin plain-update
-- ANY profile's role (including granting themselves owner, or demoting
-- the real owner) straight through PostgREST. Block both directly at
-- the DB, so the only path to changing who's owner is the RPC above.
create or replace function public.protect_owner_role()
returns trigger as $$
begin
  if current_setting('app.allow_owner_transfer', true) = 'true' then
    return new; -- transfer_ownership() is performing this exact update; allow it
  end if;
  if old.role = 'owner' and new.role is distinct from old.role then
    raise exception 'The owner''s role can only change via transfer_ownership()';
  end if;
  if new.role = 'owner' and old.role is distinct from 'owner' then
    raise exception 'Cannot grant owner directly — use transfer_ownership()';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists protect_owner_role_trg on public.profiles;
create trigger protect_owner_role_trg
  before update on public.profiles
  for each row execute function public.protect_owner_role();
