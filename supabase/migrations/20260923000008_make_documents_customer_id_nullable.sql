-- documents.customer_id was NOT NULL but TrussCTR CRM inserts use contact_id
-- (contacts table), not customer_id (customers table, a QuoteMGR artifact).
-- Every document upload was silently failing; making this nullable unblocks it.
ALTER TABLE documents ALTER COLUMN customer_id DROP NOT NULL;
