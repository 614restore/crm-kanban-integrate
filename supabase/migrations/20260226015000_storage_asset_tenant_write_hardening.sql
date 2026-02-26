-- Harden avatar/logo writes so users can only write inside allowed tenant paths.
-- Keeps public-read behavior for compatibility with current app URLs.

-- Remove broad write policies created by prior migration.
DROP POLICY IF EXISTS storage_authenticated_write_assets ON storage.objects;
DROP POLICY IF EXISTS storage_authenticated_update_assets ON storage.objects;
DROP POLICY IF EXISTS storage_authenticated_delete_assets ON storage.objects;

-- Avatar bucket: each user can only write/update/delete under "<auth.uid()>/..."
CREATE POLICY storage_avatars_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY storage_avatars_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY storage_avatars_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Company logo bucket: company members can write/update/delete under "<company_id>/..."
CREATE POLICY storage_company_logos_insert_tenant
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  );

CREATE POLICY storage_company_logos_update_tenant
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  );

CREATE POLICY storage_company_logos_delete_tenant
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND split_part(name, '/', 1) = public.get_my_company_id()::text
  );
