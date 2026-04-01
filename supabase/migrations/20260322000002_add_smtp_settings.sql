-- Migration: add SMTP settings columns to companies table
-- Allows each company to configure their own outbound email server
-- instead of using the system-wide Resend account.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS smtp_host    text,
  ADD COLUMN IF NOT EXISTS smtp_port    integer DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_user    text,
  ADD COLUMN IF NOT EXISTS smtp_pass    text,
  ADD COLUMN IF NOT EXISTS smtp_secure  boolean DEFAULT false;

COMMENT ON COLUMN companies.smtp_host   IS 'SMTP server hostname, e.g. smtp.gmail.com';
COMMENT ON COLUMN companies.smtp_port   IS 'SMTP port — 587 (STARTTLS) or 465 (SSL)';
COMMENT ON COLUMN companies.smtp_user   IS 'SMTP login username (usually the sending email address)';
COMMENT ON COLUMN companies.smtp_pass   IS 'SMTP password or app-specific password';
COMMENT ON COLUMN companies.smtp_secure IS 'true = SSL/TLS on connect (port 465); false = STARTTLS (port 587)';
