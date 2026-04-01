-- ============================================================================
-- STEP 7: CREATE STORAGE BUCKETS AND POLICIES
-- Run this after Step 6
-- IMPORTANT: First create the buckets in Supabase UI (Storage section)
-- Then run this SQL to set the policies
-- ============================================================================

-- Create company-logos bucket (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Company logos policies
DROP POLICY IF EXISTS "Public company-logos read" ON storage.objects;
CREATE POLICY "Public company-logos read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "Authenticated company-logos upload" ON storage.objects;
CREATE POLICY "Authenticated company-logos upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated company-logos update" ON storage.objects;
CREATE POLICY "Authenticated company-logos update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'company-logos' 
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated company-logos delete" ON storage.objects;
CREATE POLICY "Authenticated company-logos delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'company-logos' 
  AND auth.role() = 'authenticated'
);

-- Create avatars bucket (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Avatars policies
DROP POLICY IF EXISTS "Public avatars read" ON storage.objects;
CREATE POLICY "Public avatars read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated avatars upload" ON storage.objects;
CREATE POLICY "Authenticated avatars upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated avatars update" ON storage.objects;
CREATE POLICY "Authenticated avatars update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated avatars delete" ON storage.objects;
CREATE POLICY "Authenticated avatars delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- Create documents bucket (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('projectceo-documents', 'projectceo-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Documents policies
DROP POLICY IF EXISTS "Authenticated projectceo-documents read" ON storage.objects;
CREATE POLICY "Authenticated projectceo-documents read" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'projectceo-documents' 
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated projectceo-documents upload" ON storage.objects;
CREATE POLICY "Authenticated projectceo-documents upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'projectceo-documents' 
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated projectceo-documents update" ON storage.objects;
CREATE POLICY "Authenticated projectceo-documents update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'projectceo-documents' 
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated projectceo-documents delete" ON storage.objects;
CREATE POLICY "Authenticated projectceo-documents delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'projectceo-documents' 
  AND auth.role() = 'authenticated'
);
