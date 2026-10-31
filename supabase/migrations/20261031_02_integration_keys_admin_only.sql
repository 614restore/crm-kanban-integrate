-- Integration keys: only owners, admins and managers can read or change the keys for
-- integrations that hold secrets. Target: llamtjsquoqlejznmyjl (shared TrussCTR/TrussCENTER backend).
--
-- company_integrations.credentials holds each company's Stripe secret key, Twilio Auth Token,
-- SendGrid key and so on. Every signed-in team member could read them, so a salesperson could
-- copy the company's Stripe key out of the browser. The app now sends texts, payment links and
-- email through /api/send, which reads the keys on the server, so nobody else needs them.
--
-- Everyone in the company can still see whether an integration is connected and switched on,
-- without the keys, through get_my_integration_status(). Integrations without secrets the browser
-- needs (weather, maps, EagleView, HailTrace, Roofr) are unchanged.
-- Safe to run more than once.

create or replace function public.is_integration_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
     where tm.company_id = p_company_id
       and tm.user_id = auth.uid()
       and tm.is_active
       and tm.role in ('owner', 'admin', 'manager')
  );
$$;

revoke all on function public.is_integration_admin(uuid) from public, anon;
grant execute on function public.is_integration_admin(uuid) to authenticated;

-- The integrations whose credentials are secrets the browser must not hold.
create or replace function public.is_secret_integration(p_integration_id text)
returns boolean
language sql
immutable
as $$
  select p_integration_id in ('stripe', 'twilio', 'sendgrid', 'quickbooks', 'resend');
$$;

drop policy if exists company_integrations_sel on public.company_integrations;
create policy company_integrations_sel on public.company_integrations
  for select using (
    company_id in (select public.get_my_company_ids())
    and (not public.is_secret_integration(integration_id) or public.is_integration_admin(company_id))
  );

drop policy if exists company_integrations_ins on public.company_integrations;
create policy company_integrations_ins on public.company_integrations
  for insert with check (
    company_id in (select public.get_my_company_ids())
    and (not public.is_secret_integration(integration_id) or public.is_integration_admin(company_id))
  );

drop policy if exists company_integrations_upd on public.company_integrations;
create policy company_integrations_upd on public.company_integrations
  for update using (
    company_id in (select public.get_my_company_ids())
    and (not public.is_secret_integration(integration_id) or public.is_integration_admin(company_id))
  ) with check (
    company_id in (select public.get_my_company_ids())
    and (not public.is_secret_integration(integration_id) or public.is_integration_admin(company_id))
  );

drop policy if exists company_integrations_del on public.company_integrations;
create policy company_integrations_del on public.company_integrations
  for delete using (
    company_id in (select public.get_my_company_ids())
    and (not public.is_secret_integration(integration_id) or public.is_integration_admin(company_id))
  );

-- Which integrations the company has connected, without any keys.
create or replace function public.get_my_integration_status(p_company_id uuid)
returns table (integration_id text, enabled boolean, configured boolean)
language sql
stable
security definer
set search_path = public
as $$
  select ci.integration_id::text,
         coalesce(ci.enabled, false),
         case ci.integration_id::text
           when 'twilio' then coalesce(ci.credentials ->> 'accountSid', '') <> ''
                          and coalesce(ci.credentials ->> 'authToken', '') <> ''
                          and coalesce(ci.credentials ->> 'fromNumber', '') <> ''
           when 'stripe' then coalesce(ci.credentials ->> 'secretKey', ci.credentials ->> 'apiKey', '') <> ''
           else coalesce(ci.credentials, '{}'::jsonb) <> '{}'::jsonb
         end
    from public.company_integrations ci
   where ci.company_id = p_company_id
     and p_company_id in (select public.get_my_company_ids());
$$;

revoke all on function public.get_my_integration_status(uuid) from public, anon;
grant execute on function public.get_my_integration_status(uuid) to authenticated;

notify pgrst, 'reload schema';
