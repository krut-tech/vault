-- Notify the rest of the team when someone deletes a project, folder, or
-- file. Mirrors notify_on_file_upload from 0004 (only new.is_deleted flips
-- true -> counts as a delete; toggling it back false via Recycle Bin
-- "restore" does not re-fire this).

create or replace function public.notify_on_project_delete()
returns trigger as $$
begin
  if new.is_deleted = true and old.is_deleted = false then
    insert into notifications (user_id, message, link)
    select p.id,
           coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
             || ' deleted project "' || new.name || '"',
           '/recycle-bin'
    from profiles p
    where p.id <> auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_project_delete on projects;
create trigger trg_notify_on_project_delete
  after update of is_deleted on projects
  for each row execute function public.notify_on_project_delete();

create or replace function public.notify_on_folder_delete()
returns trigger as $$
begin
  if new.is_deleted = true and old.is_deleted = false then
    insert into notifications (user_id, message, link)
    select p.id,
           coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
             || ' deleted folder "' || new.name || '"',
           '/recycle-bin'
    from profiles p
    where p.id <> auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_folder_delete on folders;
create trigger trg_notify_on_folder_delete
  after update of is_deleted on folders
  for each row execute function public.notify_on_folder_delete();

create or replace function public.notify_on_file_delete()
returns trigger as $$
begin
  if new.is_deleted = true and old.is_deleted = false then
    insert into notifications (user_id, message, link)
    select p.id,
           coalesce((select full_name from profiles where id = auth.uid()), 'Someone')
             || ' deleted file "' || new.name || '"',
           '/recycle-bin'
    from profiles p
    where p.id <> auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_on_file_delete on files;
create trigger trg_notify_on_file_delete
  after update of is_deleted on files
  for each row execute function public.notify_on_file_delete();
