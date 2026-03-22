-- Fix subscription_plan CHECK constraint to match app's expected values.
-- The old migration (supabase-migrations/add-subscription-plans.sql) used
-- 'professional' and 'enterprise' but the app and Stripe webhook use
-- 'pro', 'business', and 'scale'. This caused silent webhook failures.

-- Ensure all subscription columns exist with correct types
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_plan    text DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_status  text DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_ends_at        timestamptz DEFAULT (NOW() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id   text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Drop old mismatched CHECK constraints if they exist
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_subscription_plan_check,
  DROP CONSTRAINT IF EXISTS companies_subscription_status_check;

-- Add correct CHECK constraints matching the app and webhook
ALTER TABLE public.companies
  ADD CONSTRAINT companies_subscription_plan_check
    CHECK (subscription_plan IN ('trial', 'starter', 'pro', 'business', 'scale')),
  ADD CONSTRAINT companies_subscription_status_check
    CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing'));

-- Fix any stale plan values that used old names
UPDATE public.companies SET subscription_plan = 'pro'      WHERE subscription_plan = 'professional';
UPDATE public.companies SET subscription_plan = 'business' WHERE subscription_plan = 'enterprise';

COMMENT ON COLUMN public.companies.subscription_plan   IS 'TrussCTR plan: trial | starter | pro | business | scale';
COMMENT ON COLUMN public.companies.subscription_status IS 'Stripe subscription status: active | past_due | canceled | trialing';
COMMENT ON COLUMN public.companies.trial_ends_at       IS '14-day free trial expiry — app blocks access after this date if still trialing';
