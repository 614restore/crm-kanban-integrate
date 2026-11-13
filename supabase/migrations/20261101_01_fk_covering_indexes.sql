-- Every foreign key in public was missing an index on its referencing columns —
-- 89 of them. Postgres indexes the referenced side (the primary key) on its own
-- but never the referencing side, so each one meant a sequential scan: once per
-- join from the child table, and once per row when a parent is deleted or its
-- key updated, while the FK is checked.
--
-- Nothing here is slow today (the largest table holds 411 rows), which is the
-- reason to do it now: these are instant on an empty table and painful to add
-- once a company has a year of jobs. Plain create index, not concurrently, so
-- the whole file runs as one statement batch in the SQL Editor; the locks are
-- too brief to notice at this size.
--
-- Generated from pg_constraint: every contype='f' whose conkey is not the
-- leading column list of some existing index.

create index if not exists idx_ai_usage_log_quote_id on ai_usage_log (quote_id);
create index if not exists idx_app_events_team_member_id on app_events (team_member_id);
create index if not exists idx_appointments_assigned_to on appointments (assigned_to);
create index if not exists idx_automations_company_id on automations (company_id);
create index if not exists idx_change_orders_company_id on change_orders (company_id);
create index if not exists idx_commission_adjustments_created_by on commission_adjustments (created_by);
create index if not exists idx_communications_author_id on communications (author_id);
create index if not exists idx_companies_default_signer_id on companies (default_signer_id);
create index if not exists idx_company_files_company_id on company_files (company_id);
create index if not exists idx_company_files_uploaded_by on company_files (uploaded_by);
create index if not exists idx_company_price_updates_company_id on company_price_updates (company_id);
create index if not exists idx_company_price_updates_updated_by on company_price_updates (updated_by);
create index if not exists idx_company_pricing_company_id on company_pricing (company_id);
create index if not exists idx_company_pricing_owner_member_id on company_pricing (owner_member_id);
create index if not exists idx_customer_surveys_company_id on customer_surveys (company_id);
create index if not exists idx_customers_added_by on customers (added_by);
create index if not exists idx_customers_assigned_to on customers (assigned_to);
create index if not exists idx_customers_commission_paid_by on customers (commission_paid_by);
create index if not exists idx_customers_costs_confirmed_by on customers (costs_confirmed_by);
create index if not exists idx_customers_inspection_completed_by on customers (inspection_completed_by);
create index if not exists idx_customers_pickup_cleared_by on customers (pickup_cleared_by);
create index if not exists idx_device_tokens_company_id on device_tokens (company_id);
create index if not exists idx_document_templates_company_id on document_templates (company_id);
create index if not exists idx_documents_uploaded_by on documents (uploaded_by);
create index if not exists idx_estimate_items_estimate_id on estimate_items (estimate_id);
create index if not exists idx_estimates_company_id on estimates (company_id);
create index if not exists idx_estimates_contact_id on estimates (contact_id);
create index if not exists idx_financing_options_company_id on financing_options (company_id);
create index if not exists idx_inspections_author_id on inspections (author_id);
create index if not exists idx_insurance_claims_company_id on insurance_claims (company_id);
create index if not exists idx_insurance_claims_contact_id on insurance_claims (contact_id);
create index if not exists idx_insurance_scopes_claim_id on insurance_scopes (claim_id);
create index if not exists idx_invitations_company_id on invitations (company_id);
create index if not exists idx_invoice_items_invoice_id on invoice_items (invoice_id);
create index if not exists idx_invoice_payments_invoice_id on invoice_payments (invoice_id);
create index if not exists idx_invoices_company_id on invoices (company_id);
create index if not exists idx_invoices_customer_id on invoices (customer_id);
create index if not exists idx_invoices_quote_id on invoices (quote_id);
create index if not exists idx_job_costs_entered_by on job_costs (entered_by);
create index if not exists idx_jobs_company_id on jobs (company_id);
create index if not exists idx_kanban_boards_company_id on kanban_boards (company_id);
create index if not exists idx_kanban_columns_board_id on kanban_columns (board_id);
create index if not exists idx_kanban_columns_company_id on kanban_columns (company_id);
create index if not exists idx_lead_sources_company_id on lead_sources (company_id);
create index if not exists idx_material_orders_line_item_id on material_orders (line_item_id);
create index if not exists idx_notes_author_id on notes (author_id);
create index if not exists idx_notifications_user_id on notifications (user_id);
create index if not exists idx_payments_company_id on payments (company_id);
create index if not exists idx_payments_created_by on payments (created_by);
create index if not exists idx_payments_customer_id on payments (customer_id);
create index if not exists idx_payments_quote_id on payments (quote_id);
create index if not exists idx_permits_company_id on permits (company_id);
create index if not exists idx_price_list_imports_imported_by on price_list_imports (imported_by);
create index if not exists idx_pricing_presets_company_id on pricing_presets (company_id);
create index if not exists idx_pricing_presets_created_by on pricing_presets (created_by);
create index if not exists idx_pricing_presets_user_id on pricing_presets (user_id);
create index if not exists idx_quote_financing_financing_option_id on quote_financing (financing_option_id);
create index if not exists idx_quote_financing_quote_id on quote_financing (quote_id);
create index if not exists idx_quote_line_items_quote_id on quote_line_items (quote_id);
create index if not exists idx_quote_line_items_quote_option_id on quote_line_items (quote_option_id);
create index if not exists idx_quote_notifications_company_id on quote_notifications (company_id);
create index if not exists idx_quote_notifications_quote_id on quote_notifications (quote_id);
create index if not exists idx_quote_options_quote_id on quote_options (quote_id);
create index if not exists idx_quote_photos_quote_id on quote_photos (quote_id);
create index if not exists idx_quote_signatures_quote_id on quote_signatures (quote_id);
create index if not exists idx_quote_templates_company_id on quote_templates (company_id);
create index if not exists idx_quote_upgrades_quote_id on quote_upgrades (quote_id);
create index if not exists idx_quote_upgrades_quote_option_id on quote_upgrades (quote_option_id);
create index if not exists idx_quotes_company_id on quotes (company_id);
create index if not exists idx_quotes_created_by on quotes (created_by);
create index if not exists idx_quotes_customer_id on quotes (customer_id);
create index if not exists idx_storm_alert_log_customer_id on storm_alert_log (customer_id);
create index if not exists idx_subcontractor_crews_company_id on subcontractor_crews (company_id);
create index if not exists idx_supplements_claim_id on supplements (claim_id);
create index if not exists idx_supplements_company_id on supplements (company_id);
create index if not exists idx_suppliers_company_id on suppliers (company_id);
create index if not exists idx_team_invites_company_id on team_invites (company_id);
create index if not exists idx_team_invites_invited_by on team_invites (invited_by);
create index if not exists idx_team_members_company_id on team_members (company_id);
create index if not exists idx_team_members_user_id on team_members (user_id);
create index if not exists idx_user_pricing_overrides_company_id on user_pricing_overrides (company_id);
create index if not exists idx_user_push_tokens_user_id on user_push_tokens (user_id);
create index if not exists idx_weather_history_company_id on weather_history (company_id);
create index if not exists idx_work_order_tasks_completed_by on work_order_tasks (completed_by);
create index if not exists idx_work_order_tasks_work_order_id on work_order_tasks (work_order_id);
create index if not exists idx_work_orders_assigned_to on work_orders (assigned_to);
create index if not exists idx_work_orders_company_id on work_orders (company_id);
create index if not exists idx_work_orders_customer_id on work_orders (customer_id);
create index if not exists idx_work_orders_quote_id on work_orders (quote_id);

notify pgrst, 'reload schema';
