Vercel deployment and environment setup
=====================================

Steps to deploy the serverless invite endpoint and configure secrets.

1) Create a Vercel project
   - Sign in to Vercel and import this repository (614restore/crm-kanban-integrate).
   - Vercel will detect the Vite app and deploy the frontend. Serverless functions under `api/` will be deployed automatically.

2) Add environment variables
   - In the Vercel project dashboard go to Settings → Environment Variables.
   - Add `RESEND_API_KEY` (your Resend API key) for the `Production` (and `Preview` / `Development` as needed).
   - Optionally add `SUPABASE_URL` and `SUPABASE_ANON_KEY` for server-side uses if needed.

3) Verify the endpoint
   - The serverless function is available at `https://<your-vercel-project>.vercel.app/api/send-invite`.
   - Test it using curl (do not expose the `RESEND_API_KEY`):

```bash
curl -X POST "https://<your-vercel-project>.vercel.app/api/send-invite" \
  -H "Content-Type: application/json" \
  -d '{"to":"you@example.com","subject":"Test","html":"<p>Hi</p>"}'
```

4) CI: GitHub Actions
   - Add repository secrets: `E2E_SUPABASE_URL`, `E2E_SUPABASE_KEY`, `E2E_INVITEE_EMAIL` (and `VERCEL_TOKEN` if you want CI deploys).
   - The repository contains `.github/workflows/e2e-invite.yml` which runs the `scripts/e2e-invite.mjs` script using the `E2E_SUPABASE_KEY` service role key.

Security notes
--------------
- Never commit service role keys or `RESEND_API_KEY` to the repo.
- Use scoped CI secrets and rotate keys if they are exposed.

If you want, I can add a Vercel-specific `vercel.json` or a GitHub Action to automatically deploy on push using `VERCEL_TOKEN`.
