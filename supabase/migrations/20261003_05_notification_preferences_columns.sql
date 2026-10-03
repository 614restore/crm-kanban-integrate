-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- The Notification Preferences screen (web, and now mobile) saves one row per person with flat columns
-- (email / SMS / push on-off, which alerts, hail and wind thresholds, quiet hours, service-area ZIPs).
-- The `notification_preferences` table here only had a single `preferences` jsonb column, so saving from
-- the web app failed with "column does not exist". It also had no unique key on (company, user), so the
-- screen's save could not update an existing row.
--
-- This adds the columns (with the same defaults the screen uses) and the unique key. The table is empty
-- today, so adding the key cannot clash with existing rows.
--
-- Safe to run more than once. Adds columns and an index only; the old `preferences` column is untouched.

alter table public.notification_preferences add column if not exists email_enabled                  boolean not null default true;
alter table public.notification_preferences add column if not exists sms_enabled                    boolean not null default true;
alter table public.notification_preferences add column if not exists push_enabled                   boolean not null default true;
alter table public.notification_preferences add column if not exists hail_alerts_enabled            boolean not null default true;
alter table public.notification_preferences add column if not exists wind_alerts_enabled            boolean not null default true;
alter table public.notification_preferences add column if not exists appointment_alerts_enabled     boolean not null default true;
alter table public.notification_preferences add column if not exists lead_assignment_alerts_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists mention_alerts_enabled         boolean not null default true;
alter table public.notification_preferences add column if not exists min_hail_size_inches           numeric not null default 0.75;
alter table public.notification_preferences add column if not exists min_wind_speed_mph             integer not null default 40;
alter table public.notification_preferences add column if not exists min_severity                   text    not null default 'moderate';
alter table public.notification_preferences add column if not exists quiet_hours_start              time;
alter table public.notification_preferences add column if not exists quiet_hours_end                time;
alter table public.notification_preferences add column if not exists service_area_zip_codes         text[]  not null default '{}';

create unique index if not exists notification_preferences_company_user_key
  on public.notification_preferences (company_id, user_id);

notify pgrst, 'reload schema';
