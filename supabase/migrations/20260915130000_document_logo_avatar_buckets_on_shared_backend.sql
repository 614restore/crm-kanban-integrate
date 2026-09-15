-- Storage buckets the TrussCTR web app uploads to, missing on the shared
-- TrussCTR/TrussCENTER backend (llamtjsquoqlejznmyjl). Uploading from
-- More → Documents failed with:
--   {"statusCode":"404","error":"Bucket not found","code":"NoSuchBucket"}
--
-- Additive: new buckets and new policies only; existing buckets and policies
-- (company-files, profile-photos, quote-photos, signed-quotes) are untouched.
-- Based on the original TrussCTR setup in
-- 20260225173000_tenant_isolation_hardening.sql, using get_my_company_ids()
-- (team_members) instead of the retired get_my_company_id().

-- ── projectceo-documents: private, company-only ─────────────────────────────
-- Contracts, insurance papers and scanned documents. Paths start with the
-- company id (uploadDocument writes {company_id}/{contact_id}/{file}); the app
-- opens files through signed URLs.
insert into storage.buckets (id, name, public)
values ('projectceo-documents', 'projectceo-documents', false)
on conflict (id) do update set public = false;

drop policy if exists projectceo_documents_select on storage.objects;
create policy projectceo_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'projectceo-documents'
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );

drop policy if exists projectceo_documents_insert on storage.objects;
create policy projectceo_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'projectceo-documents'
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );

drop policy if exists projectceo_documents_update on storage.objects;
create policy projectceo_documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'projectceo-documents'
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  )
  with check (
    bucket_id = 'projectceo-documents'
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );

drop policy if exists projectceo_documents_delete on storage.objects;
create policy projectceo_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'projectceo-documents'
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );

-- ── company-logos: public read, company members write their own folder ─────
-- Settings → Company logo (uploadCompanyLogo writes {company_id}/{file}).
insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

drop policy if exists company_logos_insert on storage.objects;
create policy company_logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-logos'
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );

drop policy if exists company_logos_update on storage.objects;
create policy company_logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'company-logos'
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );

drop policy if exists company_logos_delete on storage.objects;
create policy company_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-logos'
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );

-- ── avatars: public read, people write their own folder ─────────────────────
-- Settings → Profile photo (uploadUserAvatar writes {user_id}/{file}).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

-- ── expense-receipts and projectceo-photos: public read, company-folder writes ─
-- Expenses → receipt upload writes {company_id}/{expense_id}/{file} with upsert
-- and shows the public URL; the Photos page (secureUpload) writes
-- {company_id}/{contact_id}/{file}. Upsert also needs select, so members can
-- list their own company's folder.
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', true),
       ('projectceo-photos', 'projectceo-photos', true)
on conflict (id) do nothing;

drop policy if exists company_uploads_select on storage.objects;
create policy company_uploads_select on storage.objects
  for select to authenticated
  using (
    bucket_id in ('expense-receipts', 'projectceo-photos')
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );

drop policy if exists company_uploads_insert on storage.objects;
create policy company_uploads_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('expense-receipts', 'projectceo-photos')
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );

drop policy if exists company_uploads_update on storage.objects;
create policy company_uploads_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('expense-receipts', 'projectceo-photos')
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );

drop policy if exists company_uploads_delete on storage.objects;
create policy company_uploads_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('expense-receipts', 'projectceo-photos')
    and split_part(name, '/', 1) in (select public.get_my_company_ids()::text)
  );
