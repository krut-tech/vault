-- Fix notifications: (1) add table to realtime publication so the
-- NotificationBell's postgres_changes subscription actually fires,
-- (2) add triggers so notification rows actually get created on the
-- events that matter (nothing was calling notifyUser() anywhere).

-- 1. Enable realtime push for notifications
alter publication supabase_realtime add table notifications;

-- 2. New comment -> notify the file's owner (if someone else commented)
create or replace function public.notify_on_comment()
returns trigger as $$
declare
  v_file_owner uuid;
  v_file_name text;
begin
  select created_by, name into v_file_owner, v_file_name
  from files where id = new.file_id;

  if v_file_owner is not null and v_file_owner <> new.author_id then
    insert into notifications (user_id, message, link)
    values (
      v_file_owner,
      'New comment on "' || coalesce(v_file_name, 'a file') || '"',
      '/files/' || new.file_id
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_comment on comments;
create trigger trg_notify_on_comment
  after insert on comments
  for each row execute function public.notify_on_comment();

-- 3. Task assigned / reassigned -> notify the new assignee
create or replace function public.notify_on_task_assignment()
returns trigger as $$
begin
  if new.assignee_id is not null
     and new.assignee_id is distinct from coalesce(old.assignee_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and new.assignee_id <> auth.uid()
  then
    insert into notifications (user_id, message, link)
    values (
      new.assignee_id,
      'You were assigned to "' || new.title || '"',
      '/tasks/' || new.id
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_task_insert on tasks;
create trigger trg_notify_on_task_insert
  after insert on tasks
  for each row execute function public.notify_on_task_assignment();

drop trigger if exists trg_notify_on_task_update on tasks;
create trigger trg_notify_on_task_update
  after update of assignee_id on tasks
  for each row execute function public.notify_on_task_assignment();

-- 4. New file uploaded -> notify the rest of the team
create or replace function public.notify_on_file_upload()
returns trigger as $$
declare
  v_project_name text;
begin
  select name into v_project_name from projects where id = new.project_id;

  insert into notifications (user_id, message, link)
  select p.id,
         coalesce((select full_name from profiles where id = new.created_by), 'Someone')
           || ' added "' || new.name || '" to ' || coalesce(v_project_name, 'a project'),
         '/files/' || new.id
  from profiles p
  where p.id <> new.created_by;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_file_upload on files;
create trigger trg_notify_on_file_upload
  after insert on files
  for each row execute function public.notify_on_file_upload();
