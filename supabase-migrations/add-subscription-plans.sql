-- Add subscription fields to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'trial' CHECK (subscription_plan IN ('trial','starter','pro','business','scale')),
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trialing' CHECK (subscription_status IN ('active','past_due','canceled','trialing')),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (NOW() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

COMMENT ON COLUMN public.companies.subscription_plan IS 'TrussCTR subscription plan tier';
COMMENT ON COLUMN public.companies.trial_ends_at IS '14-day free trial expiry';
