-- Quote columns the QuoteMGR quote builder and documents wizard write, missing
-- on the shared TrussCTR/TrussCENTER backend (llamtjsquoqlejznmyjl). Additive.
--
-- Copied from QuoteMGR migrations (read-only reference):
--   20260902000001_cover_photo_positioning.sql   cover photo zoom and offsets
--   20260828_standalone_cancel_notice.sql        digital Right-to-Cancel link
--
-- Without them, saving a quote fails with:
--   Could not find the 'cover_photo_offset_x' column of 'quotes' in the schema cache

-- ── Cover (property) photo positioning, like sales_rep_photo_zoom/offset_x/offset_y ─
alter table public.quotes
  add column if not exists cover_photo_zoom     numeric(6,3) default 1,
  add column if not exists cover_photo_offset_x numeric(6,3) default 50,
  add column if not exists cover_photo_offset_y numeric(6,3) default 50;

-- ── Standalone digital "3-Day Right to Cancel" signing ─────────────────────────
-- An owner/admin enables the ?token=...&cancel_notice=1 link per quote; a bare
-- share token never exposes it.
alter table public.quotes
  add column if not exists standalone_cancel_share_enabled boolean not null default false,
  add column if not exists standalone_cancel_signature_data text,
  add column if not exists standalone_cancel_signed_by text,
  add column if not exists standalone_cancel_signed_at timestamptz,
  add column if not exists standalone_cancel_sent_at timestamptz,
  add column if not exists standalone_cancel_sent_by uuid;

comment on column public.quotes.standalone_cancel_share_enabled is
  'Gates the digital Right-to-Cancel signing link (?token=...&cancel_notice=1). Off by default; an owner/admin enables it per quote.';

-- standalone_cancel_sent_by has no foreign key to team_members on purpose: a
-- second quotes → team_members FK makes PostgREST embedded selects ambiguous
-- (PGRST201). It is only an audit trail of who shared the link.
alter table public.quotes
  drop constraint if exists quotes_standalone_cancel_sent_by_fkey;

-- Make the API see the new columns right away.
notify pgrst, 'reload schema';
