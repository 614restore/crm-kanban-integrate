-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
-- Ported from QuoteMGR 20260917231220. Save Draft on the send screen saved the
-- subject and message but dropped any CC recipients typed into the same form; the
-- quote builder now stores them in last_sent_cc_emails so a reopened draft keeps
-- all three. Safe to run more than once.
alter table public.quotes
  add column if not exists last_sent_subject text,
  add column if not exists last_sent_message text,
  add column if not exists last_sent_cc_emails text;

notify pgrst, 'reload schema';
