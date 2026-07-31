-- CodeVault core schema + RLS (fresh build)
create extension if not exists "uuid-ossp";

-- ========== PROFILES ==========
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'member' check (role in ('owner','admin','member')),
  totp_secret text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "profiles readable by team" on profiles for select using (auth.role() = 'authenticated');
create policy "users update own profile" on profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('owner','admin'));
$$ language sql stable security definer;

-- ========== APP SETTINGS (admin-editable branding: name + logo) ==========
create table app_settings (
  id boolean primary key default true check (id),
  app_name text not null default 'CodeVault',
  logo_url text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (true);

alter table app_settings enable row level security;
create policy "settings readable by anyone authenticated" on app_settings for select using (auth.role() = 'authenticated');
create policy "settings writable by admin" on app_settings for update using (is_admin()) with check (is_admin());

-- ========== LOGIN ATTEMPTS (rate limiting + login log) ==========
create table login_attempts (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  ip text,
  success boolean not null,
  created_at timestamptz not null default now()
);
alter table login_attempts enable row level security;
create policy "admin reads login attempts" on login_attempts for select using (is_admin());
create policy "anyone can insert login attempt" on login_attempts for insert with check (true);

-- ========== IP ALLOWLIST ==========
create table ip_allowlist (
  id uuid primary key default uuid_generate_v4(),
  ip text not null unique,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table ip_allowlist enable row level security;
create policy "team reads allowlist" on ip_allowlist for select using (auth.role() = 'authenticated');
create policy "admin writes allowlist" on ip_allowlist for all using (is_admin()) with check (is_admin());

-- ========== PROJECTS / FOLDERS / FILES ==========
create table projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  language text not null,
  created_by uuid not null references profiles(id),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table folders (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_id uuid references folders(id) on delete cascade,
  name text not null,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  folder_id uuid references folders(id) on delete cascade,
  name text not null,
  language text not null,
  content text not null default '',
  created_by uuid not null references profiles(id),
  is_favorite boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table file_versions (
  id uuid primary key default uuid_generate_v4(),
  file_id uuid not null references files(id) on delete cascade,
  content text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null
);

create table file_tags (
  file_id uuid references files(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (file_id, tag_id)
);

create table collections (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table collection_items (
  collection_id uuid references collections(id) on delete cascade,
  file_id uuid references files(id) on delete cascade,
  primary key (collection_id, file_id)
);

create table comments (
  id uuid primary key default uuid_generate_v4(),
  file_id uuid not null references files(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid not null references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- ========== NOTES & QUICK TASKS ==========
create table notes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  title text not null default 'Untitled note',
  body text not null default '',
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quick_tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- ========== KANBAN ==========
create table boards (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table board_columns (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid not null references boards(id) on delete cascade,
  name text not null,
  position int not null default 0
);

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  column_id uuid not null references board_columns(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references profiles(id),
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ========== TIME TRACKING ==========
create table time_entries (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  user_id uuid not null references profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text
);

-- ========== DEPLOYMENT (FTP/SFTP) ==========
create table deploy_targets (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  protocol text not null check (protocol in ('ftp','sftp')),
  host text not null,
  port int not null,
  username text not null,
  secret_ref text not null,
  remote_path text not null default '/',
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table deployments (
  id uuid primary key default uuid_generate_v4(),
  target_id uuid not null references deploy_targets(id) on delete cascade,
  status text not null check (status in ('queued','running','success','failed')),
  log text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ========== SITE MONITORING ==========
create table monitors (
  id uuid primary key default uuid_generate_v4(),
  url text not null,
  name text not null,
  interval_minutes int not null default 5,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table monitor_checks (
  id uuid primary key default uuid_generate_v4(),
  monitor_id uuid not null references monitors(id) on delete cascade,
  is_up boolean not null,
  status_code int,
  response_ms int,
  checked_at timestamptz not null default now()
);

-- ========== RLS: team-shared model ==========
do $$
declare t text;
begin
  for t in select unnest(array[
    'projects','folders','files','file_versions','tags','file_tags',
    'collections','collection_items','comments','notifications','activity_log',
    'notes','quick_tasks',
    'boards','board_columns','tasks','time_entries',
    'deploy_targets','deployments','monitors','monitor_checks'
  ])
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy "team read" on projects for select using (auth.role() = 'authenticated');
create policy "team write" on projects for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on folders for select using (auth.role() = 'authenticated');
create policy "team write" on folders for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on files for select using (auth.role() = 'authenticated');
create policy "team write" on files for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on file_versions for select using (auth.role() = 'authenticated');
create policy "team insert" on file_versions for insert with check (auth.role() = 'authenticated');

create policy "team read" on tags for select using (auth.role() = 'authenticated');
create policy "team write" on tags for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on file_tags for select using (auth.role() = 'authenticated');
create policy "team write" on file_tags for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on collections for select using (auth.role() = 'authenticated');
create policy "team write" on collections for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on collection_items for select using (auth.role() = 'authenticated');
create policy "team write" on collection_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on comments for select using (auth.role() = 'authenticated');
create policy "team insert own" on comments for insert with check (auth.uid() = author_id);
create policy "author or admin delete" on comments for delete using (auth.uid() = author_id or is_admin());

create policy "own notifications" on notifications for select using (auth.uid() = user_id);
create policy "own notifications update" on notifications for update using (auth.uid() = user_id);
create policy "system insert notifications" on notifications for insert with check (auth.role() = 'authenticated');

create policy "team read" on activity_log for select using (auth.role() = 'authenticated');
create policy "team insert" on activity_log for insert with check (auth.uid() = actor_id);

create policy "team read" on notes for select using (auth.role() = 'authenticated');
create policy "team write" on notes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on quick_tasks for select using (auth.role() = 'authenticated');
create policy "team write" on quick_tasks for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on boards for select using (auth.role() = 'authenticated');
create policy "team write" on boards for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on board_columns for select using (auth.role() = 'authenticated');
create policy "team write" on board_columns for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on tasks for select using (auth.role() = 'authenticated');
create policy "team write" on tasks for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "team read" on time_entries for select using (auth.role() = 'authenticated');
create policy "own write" on time_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "team read" on deploy_targets for select using (auth.role() = 'authenticated');
create policy "admin write" on deploy_targets for all using (is_admin()) with check (is_admin());

create policy "team read" on deployments for select using (auth.role() = 'authenticated');
create policy "admin write" on deployments for all using (is_admin()) with check (is_admin());

create policy "team read" on monitors for select using (auth.role() = 'authenticated');
create policy "admin write" on monitors for all using (is_admin()) with check (is_admin());

create policy "team read" on monitor_checks for select using (auth.role() = 'authenticated');
create policy "system insert" on monitor_checks for insert with check (auth.role() = 'authenticated');
