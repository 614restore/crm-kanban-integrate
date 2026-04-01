-- Customer Surveys Table
-- Stores post-job customer satisfaction surveys

CREATE TABLE IF NOT EXISTS customer_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  
  -- Survey responses
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  timeliness_rating INTEGER CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5),
  professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  
  -- Open-ended feedback
  what_went_well TEXT,
  what_could_improve TEXT,
  additional_comments TEXT,
  
  -- Review consent
  willing_to_review BOOLEAN DEFAULT false,
  review_submitted BOOLEAN DEFAULT false,
  review_submitted_at TIMESTAMPTZ,
  
  -- Metadata
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_surveys_company ON customer_surveys(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_surveys_contact ON customer_surveys(contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_surveys_work_order ON customer_surveys(work_order_id);
CREATE INDEX IF NOT EXISTS idx_customer_surveys_submitted ON customer_surveys(submitted_at DESC);

-- RLS Policies
ALTER TABLE customer_surveys ENABLE ROW LEVEL SECURITY;

-- Users can view surveys for their company
CREATE POLICY "Users can view company surveys"
  ON customer_surveys FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can insert surveys for their company
CREATE POLICY "Users can create company surveys"
  ON customer_surveys FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can update surveys for their company
CREATE POLICY "Users can update company surveys"
  ON customer_surveys FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_customer_surveys_updated_at
  BEFORE UPDATE ON customer_surveys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
