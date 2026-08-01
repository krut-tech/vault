-- Comprehensive activity notifications: create/rename/edit/delete for
-- projects, folders, files; role changes + new joiners for team members;
-- create/delete for tasks. Builds on 0004 (comment/task-assign/upload)
-- and 0006 (project/folder/file delete).
--
-- NOTE on file edits: CodeEditor autosaves ~1.2s after every keystroke
-- (see src/components/CodeEditor.tsx useDebouncedCallback). A trigger on
-- every content update would spam a notification every 1.2s while
-- someone types. notify_on_file_edit rate-limits itself to at most one
-- "edited" notification per file per 5-minute window.

------------------------------------------------------------------
-- Projects: create + rename (delete already handled in 0006)
------------------------------------------------------------------
create or replace function public.notify_on_project_create()
returns trigger as $$
begin
  insert into notifications (user_id, message, link)
  select p.id,
         coalesce((select full_name from profiles where id = new.created_by), 'Someone')
           || ' created project "' || new.name || '"',
         '/projects/' || new.id
  from profiles p
  where p.id <> new.created_by;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_project_create on projects;
create trigger trg_notify_on_project_create
  after insert on projects
  for each row execute function public.notify_on_project_create();

create or replace function public.notify_on_project_rename()
returns trigger as $$
begin
  if new.is_deleted = false and new.name is distinct from old.name then
    insert into notifications (user_id, message, link)
    select p.id,
           coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
             || ' renamed project "' || old.name || '" to "' || new.name || '"',
           '/projects/' || new.id
    from profiles p
    where p.id <> auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_project_rename on projects;
create trigger trg_notify_on_project_rename
  after update of name on projects
  for each row execute function public.notify_on_project_rename();

------------------------------------------------------------------
-- Folders: create + rename (delete already handled in 0006)
------------------------------------------------------------------
create or replace function public.notify_on_folder_create()
returns trigger as $$
begin
  insert into notifications (user_id, message, link)
  select p.id,
         coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
           || ' created folder "' || new.name || '"',
         '/projects/' || new.project_id
  from profiles p
  where p.id <> auth.uid();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_folder_create on folders;
create trigger trg_notify_on_folder_create
  after insert on folders
  for each row execute function public.notify_on_folder_create();

create or replace function public.notify_on_folder_rename()
returns trigger as $$
begin
  if new.is_deleted = false and new.name is distinct from old.name then
    insert into notifications (user_id, message, link)
    select p.id,
           coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
             || ' renamed folder "' || old.name || '" to "' || new.name || '"',
           '/projects/' || new.project_id
    from profiles p
    where p.id <> auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_folder_rename on folders;
create trigger trg_notify_on_folder_rename
  after update of name on folders
  for each row execute function public.notify_on_folder_rename();

------------------------------------------------------------------
-- Files: rename + rate-limited edit (create/upload + delete already
-- handled in 0004 / 0006)
------------------------------------------------------------------
create or replace function public.notify_on_file_rename()
returns trigger as $$
begin
  if new.is_deleted = false and new.name is distinct from old.name then
    insert into notifications (user_id, message, link)
    select p.id,
           coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
             || ' renamed "' || old.name || '" to "' || new.name || '"',
           '/files/' || new.id
    from profiles p
    where p.id <> auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_file_rename on files;
create trigger trg_notify_on_file_rename
  after update of name on files
  for each row execute function public.notify_on_file_rename();

create or replace function public.notify_on_file_edit()
returns trigger as $$
declare
  v_recent boolean;
begin
  if new.is_deleted = false and new.content is distinct from old.content then
    select exists(
      select 1 from notifications
      where link = '/files/' || new.id
        and message like '%edited "%'
        and created_at > now() - interval '5 minutes'
    ) into v_recent;

    if not v_recent then
      insert into notifications (user_id, message, link)
      select p.id,
             coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
               || ' edited "' || new.name || '"',
             '/files/' || new.id
      from profiles p
      where p.id <> auth.uid();
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_file_edit on files;
create trigger trg_notify_on_file_edit
  after update of content on files
  for each row execute function public.notify_on_file_edit();

------------------------------------------------------------------
-- Team members: role changes + new joiners (removal is handled inside
-- the remove-team-member edge function, since that runs on the service
-- role and has no auth.uid() to attribute the action to)
------------------------------------------------------------------
create or replace function public.notify_on_role_change()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    insert into notifications (user_id, message, link)
    select p.id,
           coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
             || ' changed ' || coalesce(new.full_name, new.email) || '''s role to ' || new.role,
           '/admin'
    from profiles p
    where p.id <> auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_role_change on profiles;
create trigger trg_notify_on_role_change
  after update of role on profiles
  for each row execute function public.notify_on_role_change();

create or replace function public.notify_on_member_joined()
returns trigger as $$
begin
  insert into notifications (user_id, message, link)
  select p.id,
         coalesce(new.full_name, new.email) || ' joined the team',
         '/admin'
  from profiles p
  where p.id <> new.id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_member_joined on profiles;
create trigger trg_notify_on_member_joined
  after insert on profiles
  for each row execute function public.notify_on_member_joined();

------------------------------------------------------------------
-- Tasks: broadcast create when unassigned (assigned case already
-- covered by 0004's notify_on_task_assignment) + delete (hard delete,
-- so this has to run BEFORE the row is gone)
------------------------------------------------------------------
create or replace function public.notify_on_task_create_unassigned()
returns trigger as $$
begin
  if new.assignee_id is null then
    insert into notifications (user_id, message, link)
    select p.id,
           coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
             || ' created task "' || new.title || '"',
           '/tasks/' || new.id
    from profiles p
    where p.id <> auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_task_create_unassigned on tasks;
create trigger trg_notify_on_task_create_unassigned
  after insert on tasks
  for each row execute function public.notify_on_task_create_unassigned();

create or replace function public.notify_on_task_delete()
returns trigger as $$
begin
  insert into notifications (user_id, message, link)
  select p.id,
         coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
           || ' deleted task "' || old.title || '"',
         '/tasks'
  from profiles p
  where p.id <> auth.uid();
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_task_delete on tasks;
create trigger trg_notify_on_task_delete
  before delete on tasks
  for each row execute function public.notify_on_task_delete();
