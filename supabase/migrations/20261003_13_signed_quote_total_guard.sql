-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- A SIGNED QUOTE'S TOTAL CANNOT BE WIPED TO ZERO.
--
-- A signed contract (QT-2026-3142, $2,575) had every total set to $0.00 when its editor saved while holding
-- no line items. The app now refuses to save a signed or still-loading quote, but the database should not
-- depend on every screen and script behaving, so this refuses the one write that is never right: changing a
-- signed (non-inspection) quote that has a total so that all of its totals are zero.
--
-- Deliberately narrow, so every legitimate write to a signed quote still works (signed pdf url, financing
-- status, certificate timestamps, countersignature, notes). Line items on signed quotes are already frozen
-- for app users by the quote_line_items row-level security policies, so no line-item trigger is added.
--
-- A deliberate correction (for example a change to the pricing a customer re-signed) can set, inside one
-- transaction:   select set_config('app.allow_signed_edit', 'on', true);
--
-- Inspection reports have no totals and are not affected. Safe to run more than once. Changes no row.

create or replace function public.trg_guard_signed_quote_totals()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_old_total numeric;
  v_new_total numeric;
begin
  if coalesce(current_setting('app.allow_signed_edit', true), '') = 'on' then
    return new;
  end if;
  if not (old.status = 'signed' or old.signed_at is not null) then
    return new;
  end if;
  if coalesce(old.project_type, '') = 'inspection_report' then
    return new;
  end if;

  -- With manual totals on, the manual figures are the total; otherwise the tier totals are.
  v_old_total := case when old.use_manual_totals is true
                      then coalesce(old.manual_good_total, 0) + coalesce(old.manual_better_total, 0) + coalesce(old.manual_best_total, 0)
                      else coalesce(old.good_total, 0) + coalesce(old.better_total, 0) + coalesce(old.best_total, 0) end;
  v_new_total := case when new.use_manual_totals is true
                      then coalesce(new.manual_good_total, 0) + coalesce(new.manual_better_total, 0) + coalesce(new.manual_best_total, 0)
                      else coalesce(new.good_total, 0) + coalesce(new.better_total, 0) + coalesce(new.best_total, 0) end;

  if v_old_total > 0 and v_new_total <= 0 then
    raise exception 'This quote is signed, so its totals cannot be set to zero (it was $% when signed). Reload the quote; to correct it on purpose, set app.allow_signed_edit to on for the transaction.', v_old_total
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_signed_quote_totals on public.quotes;
create trigger trg_guard_signed_quote_totals
  before update of good_total, better_total, best_total, manual_good_total, manual_better_total, manual_best_total, use_manual_totals
  on public.quotes
  for each row
  execute function public.trg_guard_signed_quote_totals();

notify pgrst, 'reload schema';
