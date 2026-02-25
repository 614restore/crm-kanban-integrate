-- Storage buckets + policies for upload features
-- Safe to run multiple times.

-- Buckets used by the app
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('company-logos', 'company-logos', true),
  ('avatars', 'avatars', true),
  ('projectceo-documents', 'projectceo-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow public read for app buckets'
  ) THEN
    CREATE POLICY "Allow public read for app buckets"
      ON storage.objects
      FOR SELECT
      USING (bucket_id IN ('company-logos', 'avatars', 'projectceo-documents'));
  END IF;
END $$;

-- Insert access for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated insert for app buckets'
  ) THEN
    CREATE POLICY "Allow authenticated insert for app buckets"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id IN ('company-logos', 'avatars', 'projectceo-documents'));
  END IF;
END $$;

-- Update access for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated update for app buckets'
  ) THEN
    CREATE POLICY "Allow authenticated update for app buckets"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id IN ('company-logos', 'avatars', 'projectceo-documents'))
      WITH CHECK (bucket_id IN ('company-logos', 'avatars', 'projectceo-documents'));
  END IF;
END $$;

-- Delete access for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated delete for app buckets'
  ) THEN
    CREATE POLICY "Allow authenticated delete for app buckets"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id IN ('company-logos', 'avatars', 'projectceo-documents'));
  END IF;
END $$;
