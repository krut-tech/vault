# CodeVault

A team-shared code vault, editor, and dev-ops hub. React + Vite + TypeScript + Tailwind (cyberpunk neon theme) on the frontend, Supabase for auth/DB/storage/realtime/edge functions/MFA, deployable to Vercel.

## What's built

- Auth (signup/login/logout, session persistence), rate-limited sign-in, real Supabase MFA (TOTP 2FA)
- Profile: avatar upload, settings, sign-out-everywhere session revocation
- Admin panel: team roles, **branding editor (app name + logo)**, IP allowlist, activity feed, stats
- Projects → Folders → Files, Monaco editor with autosave, version history + diff/restore
- Tags, favorites, comments, global search, in-app notifications, activity log, recycle bin
- Realtime sync across the team
- Run-code sandbox execution (edge function, 11 languages via Piston)
- Kanban board (drag-and-drop), Time tracking, Notes & quick tasks
- FTP/SFTP deployment (Vault-encrypted credentials, edge function upload)
- Site uptime monitoring (manual + cron-schedulable checks)
- Code scanner (secrets/TODO/large-file scan per project)
- Cinematic splash screen on first load per session
- PWA (installable, offline app-shell caching)

## 1. Set up Supabase

1. Create a project at supabase.com.
2. In the SQL editor, run migrations **in order**:
   - `supabase/migrations/0001_init.sql` — core schema + RLS
   - `supabase/migrations/0002_storage.sql` — avatar + branding storage buckets
   - `supabase/migrations/0003_vault_and_cron.sql` — Vault/pg_cron/pg_net (enable these extensions from **Database → Extensions** first if `create extension` fails)
3. **Enable MFA** in Supabase: Authentication → Providers → make sure TOTP/MFA is enabled for the project (on by default on most plans, but verify).
4. In **Project Settings → API**, copy your Project URL and anon public key.

## 2. Configure environment variables

Copy `.env.example` to `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Deploy the edge functions

Requires the Supabase CLI, logged in and linked (`supabase link --project-ref <ref>`):
```
supabase functions deploy run-code
supabase functions deploy save-deploy-secret
supabase functions deploy deploy-project
supabase functions deploy check-monitors
supabase functions deploy check-login-rate-limit
```
`save-deploy-secret`, `deploy-project`, and `check-monitors` need `SUPABASE_SERVICE_ROLE_KEY` as a function secret (Supabase sets this automatically in most projects — check **Edge Functions → Secrets** if you hit auth errors).

## 4. (Optional) Schedule automatic uptime checks

After deploying `check-monitors`, run in the SQL editor (fill in your project ref + anon key):
```sql
select cron.schedule(
  'run-monitor-checks-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/check-monitors',
    headers := jsonb_build_object('Authorization', 'Bearer <your-anon-key>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
```

## 5. Run locally

```
npm install
npm run dev
```

## 6. Deploy to Vercel

```
npm run build   # verify it's clean first
vercel
```

Framework preset: **Vite**. Build: `npm run build`. Output: `dist`. Add the two `VITE_SUPABASE_*` env vars in Vercel project settings — these are also read by `middleware.ts` for the optional IP allowlist feature, so use the exact same names there too.

## Feature-specific notes (read before relying on these in production)

- **2FA** uses Supabase's native MFA API (`auth.mfa.*`), not a custom implementation — this means it's actually enforced at the session level, not just a UI checkbox.
- **IP allowlist** is opt-in and enforced by `middleware.ts` (Vercel Edge Middleware), which Vercel auto-detects at the project root regardless of framework. While the `ip_allowlist` table is empty, there's no restriction; add one entry from the Admin panel to start enforcing.
- **Login rate limiting** goes through the `check-login-rate-limit` edge function (5 failed attempts / 15 min per email) rather than a client-side check, since `login_attempts` is intentionally admin-only to read directly.
- **FTP/SFTP deploy** — the upload libraries run through Deno's npm compatibility layer. Test one real deployment and check `supabase functions logs deploy-project`; see the comment at the top of that file if the stream type needs adjusting.
- **Code scanner** is a client-side regex scan (secrets, TODO/FIXME, large files) — a helpful first pass, not a substitute for a dedicated secret-scanning tool like gitleaks or truffleHog for anything security-critical.
- First team member should promote themselves to `owner` via SQL: `update profiles set role = 'owner' where email = '...'`.
