-- storm_alert_log has row level security enabled but no policies at all, so
-- every read through the API returns nothing — the table may as well be empty
-- to the apps. The storm-alerts function writes it with the service role,
-- which bypasses RLS, so only a read policy is needed.
--
-- Company members may read their own company's alert history; nobody writes
-- through the API.

drop policy if exists storm_alert_log_select on public.storm_alert_log;
create policy storm_alert_log_select on public.storm_alert_log
  for select to authenticated
  using (company_id in (select public.get_my_company_ids()));

-- Make the API see the policy right away.
notify pgrst, 'reload schema';
