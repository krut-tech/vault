-- Enables Supabase Vault (encrypted secrets) for FTP/SFTP credentials,
-- and pg_cron + pg_net for scheduled uptime checks.
--
-- IMPORTANT — one-time manual step: enable these extensions from the
-- Supabase Dashboard (Database > Extensions) first if `create extension` fails.

create extension if not exists supabase_vault;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.vault_upsert_secret(secret_name text, secret_value text)
returns uuid as $$
declare
  existing_id uuid;
  new_id uuid;
begin
  select id into existing_id from vault.secrets where name = secret_name;
  if existing_id is not null then
    perform vault.update_secret(existing_id, secret_value);
    return existing_id;
  else
    select vault.create_secret(secret_value, secret_name) into new_id;
    return new_id;
  end if;
end;
$$ language plpgsql security definer;

revoke all on function public.vault_upsert_secret(text, text) from public, anon, authenticated;

create or replace function public.vault_read_secret(secret_id uuid)
returns text as $$
  select decrypted_secret from vault.decrypted_secrets where id = secret_id;
$$ language sql security definer;

revoke all on function public.vault_read_secret(uuid) from public, anon, authenticated;

-- ==========================================================================
-- After `supabase functions deploy check-monitors`, run this manually in the
-- SQL editor, substituting your project ref and anon key:
--
-- select cron.schedule(
--   'run-monitor-checks-every-5-min',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<your-project-ref>.supabase.co/functions/v1/check-monitors',
--     headers := jsonb_build_object('Authorization', 'Bearer <your-anon-key>', 'Content-Type', 'application/json'),
--     body := '{}'::jsonb
--   );
--   $$
-- );
-- ==========================================================================
