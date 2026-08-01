-- Add is_active to profiles so removed team members can be soft-banned
-- (login revoked, hidden from the active team list) without deleting
-- anything they authored — their projects/files/comments keep showing
-- them as the author, per AdminPanel.tsx's "removed member(s)" note.

alter table public.profiles
  add column if not exists is_active boolean not null default true;

-- Owners/admins should be able to see inactive profiles too (needed for
-- the "N removed member(s)" count and for past-work attribution lookups).
-- Existing profiles select policy already scopes by authenticated role,
-- so no policy change is required here — is_active is just a plain column.

comment on column public.profiles.is_active is
  'false = member removed from the team (login banned via remove-team-member edge function); their past work stays attributed to them.';
