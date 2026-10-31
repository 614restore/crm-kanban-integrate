-- 47 SECURITY DEFINER functions were callable by anonymous visitors, because
-- Postgres grants EXECUTE to PUBLIC by default. Those functions run as their
-- owner and bypass row level security, so anyone with the project's publishable
-- key could invoke them — including update_my_password_hash,
-- create_company_and_owner, next_receipt_number and the pipeline advancers.
--
-- Anonymous access is kept only where a customer genuinely has no login:
--   * the public quote portal (view, sign, mark viewed, certificate signing)
--   * the three helpers used inside row level security policies, which return
--     nothing when there is no logged-in user. Anonymous visitors must keep
--     EXECUTE on these: 196 policies across ~60 tables call them, and without
--     the grant those queries fail outright instead of returning no rows.
--
-- Revoking from PUBLIC is what actually removes anonymous access; revoking from
-- anon alone would leave the PUBLIC grant in place.

do $$
declare
  fn record;
  -- Customers use these without logging in, from a quote or certificate link.
  portal_functions text[] := array[
    'get_public_quote',
    'get_quote_for_customer',
    'get_quote_row_for_customer',
    'get_quote_line_items_for_customer',
    'get_quote_options_for_customer',
    'get_quote_photos_for_customer',
    'sign_quote_customer',
    'mark_quote_viewed',
    'mark_certificate_viewed',
    'get_pending_invite'
  ];
  -- Called inside RLS policies, so every role that reads a table needs them.
  policy_helpers text[] := array[
    'get_my_company_ids',
    'is_company_admin',
    'is_manager_role'
  ];
  -- Maintenance only: not for the apps, not for signed-in users.
  admin_only text[] := array['rls_auto_enable'];
begin
  for fn in
    select p.oid::regprocedure as signature, p.proname as name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
  loop
    if fn.name = any(portal_functions) or fn.name = any(policy_helpers) then
      execute format('grant execute on function %s to anon, authenticated, service_role', fn.signature);
    elsif fn.name = any(admin_only) then
      execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
      execute format('grant execute on function %s to service_role', fn.signature);
    else
      execute format('revoke execute on function %s from public, anon', fn.signature);
      execute format('grant execute on function %s to authenticated, service_role', fn.signature);
    end if;
  end loop;
end $$;

-- New functions default to PUBLIC again, so take that default away. Existing
-- grants above are unaffected.
alter default privileges in schema public revoke execute on functions from public;

notify pgrst, 'reload schema';
