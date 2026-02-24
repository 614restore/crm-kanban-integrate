# Supabase Storage & RLS Examples

This file includes example SQL policies and storage settings for secure uploads of company logos and user avatars.

1) Create public buckets (or private with signed URLs)

-- Create buckets (run in Supabase Storage)
-- UI: Storage -> Create bucket -> `company-logos` (public) and `avatars` (public)

2) Example Row-Level Security (RLS) for `profiles` and `companies` tables

-- Enable RLS on `profiles`
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to update their own profile
CREATE POLICY "Allow users to update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow reading company data to authenticated users in the same company
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow company read for members"
ON public.companies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm WHERE tm.company_id = id AND tm.user_id = auth.uid()
  )
);

3) Storage: secure uploads via function (recommended for private buckets)

-- Example policy for private avatars bucket: allow uploads when user is authenticated and path starts with their uid
-- (in Storage -> Policies)
-- Policy expression (pseudocode):
-- request.auth != null && request.resource.name.startsWith(auth.uid() || '')

4) Serve public files (if bucket is public):
Use `supabase.storage.from('<bucket>').getPublicUrl(path)` to retrieve public URL.

Notes:
- Prefer private buckets + signed URLs for sensitive files.
- Ensure you use service-role key only on trusted server-side operations.
