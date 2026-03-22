-- Create the document storage bucket for TrussCTR CRM
-- Run this in Supabase Dashboard → SQL Editor
--
-- This creates a PRIVATE bucket (signed URLs only — no public links).
-- Files are uploaded at: projectceo-documents/{company_id}/{filename}
--                    or: projectceo-documents/{company_id}/{contact_id}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'projectceo-documents',
  'projectceo-documents',
  false,           -- private bucket (access via signed URLs only)
  15728640,        -- 15 MB file size limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to their company folder
CREATE POLICY "company_documents_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'projectceo-documents'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- Allow authenticated users to read files from their company folder (generates signed URLs)
CREATE POLICY "company_documents_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'projectceo-documents'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- Allow authenticated users to delete files from their company folder
CREATE POLICY "company_documents_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'projectceo-documents'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);
