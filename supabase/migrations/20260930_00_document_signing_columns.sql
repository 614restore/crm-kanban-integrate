-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- "Send a document for signature" (Documents > Templates) saves the document with its signing
-- link and HTML, emails the customer, and the customer signs on /sign-doc. The documents table
-- here had none of the columns for that (only company_id and name of the lot), so sending failed
-- at the save with a "column does not exist" error and nothing reached the customer.
--
-- Additive and safe to run more than once. Existing rows keep null in every new column.
-- The signing page reads and writes these through the server (service role), so no new
-- policy is needed: a customer never queries this table directly.

alter table public.documents
  add column if not exists html_content   text,
  add column if not exists sign_token     text,
  add column if not exists sent_by        uuid,
  add column if not exists contact_email  text,
  add column if not exists status         text,
  add column if not exists sent_at        timestamptz,
  add column if not exists viewed_at      timestamptz,
  add column if not exists signed_at      timestamptz,
  add column if not exists signed_by      text,
  add column if not exists signature_data text,
  add column if not exists signed_ip      text;

-- A signing link finds its document by token, so tokens must be unique and quick to look up.
create unique index if not exists documents_sign_token_key
  on public.documents (sign_token)
  where sign_token is not null;

notify pgrst, 'reload schema';
