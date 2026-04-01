-- Add custom message body and trigger delay hours to automations
-- message_body: stores the custom email/SMS message template for an automation
-- trigger_delay_hours: configures how many hours of inactivity trigger a stale-lead alert (default 24)

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS message_body TEXT,
  ADD COLUMN IF NOT EXISTS trigger_delay_hours INTEGER DEFAULT 24;

COMMENT ON COLUMN automations.message_body IS
  'Custom message template for email/SMS automations. Supports {name}, {company}, {amount} placeholders.';

COMMENT ON COLUMN automations.trigger_delay_hours IS
  'Hours of lead inactivity before a stale-lead alert fires. Defaults to 24.';
