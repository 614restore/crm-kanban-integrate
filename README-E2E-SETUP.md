# Setup & Run E2E Invite Test

Follow these steps to run the end-to-end invite test and configure email sending and storage.

1) Create Supabase project and tables
- Ensure the database schema includes `companies`, `invites`, `team_members`, `profiles`, etc. (see repository SQL or use the Supabase SQL editor).

2) Create storage buckets
- Create buckets `company-logos` and `avatars` (public or private as you prefer). For private buckets, use signed URLs.

3) Add GitHub Secrets (for workflow)
- Go to repository Settings → Secrets → Actions and add:
  - `SUPABASE_URL` (e.g., https://xyz.supabase.co)
  - `SUPABASE_KEY` (service role key for admin operations)
  - `E2E_INVITEE_EMAIL` (optional)
  - `E2E_COMPANY_ID` (optional)
  - `E2E_INVITER_ID` (optional)
  - `RESEND_API_KEY` (for `api/send-invite` when deployed)

4) Local `.env` for development (do NOT commit)
Create a `.env` file in the project root with:

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_KEY=<service-role-or-anon-key>
VITE_RESEND_API_KEY=<only-if-you_accept_client_exposure>
RESEND_API_KEY=<server_side_key>
```

5) Run the E2E script locally

```
SUPABASE_URL=https://<your-project>.supabase.co \
SUPABASE_KEY=<service-role-key> \
INVITEE_EMAIL=test-e2e@example.com \
node scripts/e2e-invite.mjs
```

- The script will create a company (unless `COMPANY_ID` provided), an invite, attempt to create an auth user, accept the invite, create a `team_members` row, then optionally clean up created rows.
- To skip cleanup set `CLEANUP=false`.

6) Run the GitHub Actions workflow
- In Actions, select `E2E Invite Test` and click `Run workflow`.

7) Deploy serverless email endpoint
- The `api/send-invite.mjs` file is a minimal serverless handler that expects `RESEND_API_KEY` in env. Deploy it to Vercel or Netlify (or convert to your platform's function format) and ensure the production environment variable `RESEND_API_KEY` is configured.

Security notes
- Never expose `SUPABASE_KEY` service-role in the browser.
- Use server-side endpoints for email sending to keep `RESEND_API_KEY` secret.
- Use GitHub Secrets for CI workflows.

If you'd like, I can:
- Add a cleanup workflow step to remove created test rows automatically.
- Convert `api/send-invite.mjs` to a Vercel function format (I can create a `vercel.json` and small helper).

*** End of guide ***
