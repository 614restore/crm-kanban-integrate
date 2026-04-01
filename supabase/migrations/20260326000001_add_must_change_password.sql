-- Add must_change_password flag to profiles.
-- Used by the temp-password-reset flow: when an admin generates a temporary
-- password for a user, this flag is set to true. On next login the app
-- redirects the user to the Set New Password screen and clears this flag
-- once they successfully set a permanent password.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'True when the user signed in with a temporary password and must set a permanent one before proceeding.';
