-- Storm report attached to a quote or inspection report. Target: llamtjsquoqlejznmyjl.
--
-- The Quote Builder's Storm Report section saves the storms picked from the storm history
-- around the property ({address, radiusMiles, months, generatedAt, entries[]}), and the quote
-- shows them as a Storm Report page. Customers read it through get_quote_row_for_customer,
-- which returns the whole quotes row. Additive and nullable; safe to run more than once.

alter table public.quotes add column if not exists storm_report jsonb;

notify pgrst, 'reload schema';
