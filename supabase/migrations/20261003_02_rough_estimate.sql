-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- A rough estimate (a ballpark entered before any quote exists) was being saved into project_value,
-- which feeds the pipeline totals, the reports, sales analytics and commission payroll. That made an
-- unquoted guess look like real pipeline. This gives the estimate its own column, rough_estimate,
-- which none of those totals read.
--
-- `contacts` is a view over `customers` with an explicit column list, so it is re-created with the new
-- column added at the end (the same columns in the same order, plus rough_estimate). It stays a
-- security_invoker view, so row-level security still applies exactly as before.
--
-- Safe to run more than once. Adds one nullable column; no existing row or value changes. It does NOT
-- move any existing project_value into rough_estimate.

alter table public.customers add column if not exists rough_estimate numeric;

create or replace view public.contacts with (security_invoker = true) as
 select id,
    company_id,
    first_name,
    last_name,
    email,
    phone,
    address,
    city,
    state,
    zip,
    created_at,
    quickbooks_id,
    added_by,
    needs_sales_pickup,
    pickup_cleared_at,
    pickup_cleared_by,
    contingency_signature_data,
    contingency_signed_at,
    contingency_signed_by_name,
    inspection_completed,
    inspection_completed_at,
    inspection_completed_by,
    assigned_to,
    canvasser_photo_urls,
    claim_denied,
    claim_denied_at,
    claim_denied_note,
    pipeline_stage,
    status,
    stage,
    lead_source,
    notes,
    secondary_phone,
    insurance_company,
    policy_number,
    claim_number,
    deductible,
    project_type,
    date_of_loss,
    damage_type,
    appointment_date,
    updated_at,
    is_archived,
    archived_at,
    status_changed_at,
    tags,
    adjuster_name,
    adjuster_phone,
    adjuster_email,
    project_value,
    deposit_amount,
    deposit_paid,
    deposit_date,
    final_payment_amount,
    final_payment_paid,
    final_payment_date,
    is_retail,
    retail_notes,
    phone1,
    phone2,
    rough_estimate
   from public.customers;

notify pgrst, 'reload schema';
