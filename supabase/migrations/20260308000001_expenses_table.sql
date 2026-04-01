-- Expenses table for tracking business expenses, receipts, and reimbursements
-- Supports tenant isolation via company_id

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Other',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  job_name TEXT DEFAULT '',
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name TEXT DEFAULT '',
  receipt_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_name TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by_name TEXT DEFAULT '',
  approved_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  mileage NUMERIC(10,2),
  location TEXT DEFAULT '',
  vendor TEXT DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'card', 'check', 'company_card')),
  reimbursable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_submitted_by ON expenses(submitted_by);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies using the existing get_my_company_id() helper
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (company_id = get_my_company_id());

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (company_id = get_my_company_id());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;

-- Storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for expense receipts
CREATE POLICY "expense_receipts_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "expense_receipts_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "expense_receipts_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);
