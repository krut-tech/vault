-- Avatars: public read, user writes own folder only.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar images are publicly readable"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Branding: public read (logo shown to everyone incl. login screen), admin-only write.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "branding assets are publicly readable"
  on storage.objects for select using (bucket_id = 'branding');

create policy "admins can upload branding assets"
  on storage.objects for insert
  with check (bucket_id = 'branding' and is_admin());

create policy "admins can update branding assets"
  on storage.objects for update
  using (bucket_id = 'branding' and is_admin());

create policy "admins can delete branding assets"
  on storage.objects for delete
  using (bucket_id = 'branding' and is_admin());
