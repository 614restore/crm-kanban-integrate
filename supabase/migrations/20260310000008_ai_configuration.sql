-- AI Configuration Tables for Supabase
-- Handles secure storage and team permissions

-- AI Configuration table
CREATE TABLE IF NOT EXISTS ai_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
  api_key_encrypted TEXT NOT NULL,
  organization_id TEXT,
  region TEXT,
  model TEXT NOT NULL,
  max_tokens INTEGER DEFAULT 1000,
  temperature DECIMAL DEFAULT 0.3,
  system_prompt TEXT,
  features JSONB DEFAULT '{
    "customerSupport": true,
    "emailDrafting": true,
    "contractAnalysis": false,
    "estimateReview": true,
    "leadScoring": true
  }',
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approval_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_ai_per_company_user UNIQUE (company_id, user_id, provider)
);

-- AI Access Approvals table for team permissions
CREATE TABLE IF NOT EXISTS ai_access_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id),
  ai_config_id UUID NOT NULL REFERENCES ai_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'admin')),
  approved_by UUID REFERENCES auth.users(id),
  approval_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_approval UNIQUE (ai_config_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_configs_company ON ai_configurations(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_configs_user ON ai_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_configs_approved ON ai_configurations(is_approved);
CREATE INDEX IF NOT EXISTS idx_ai_access_config ON ai_access_approvals(ai_config_id);
CREATE INDEX IF NOT EXISTS idx_ai_access_user ON ai_access_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_access_company ON ai_access_approvals(company_id);

-- Row-Level Security Policies
-- Enable RLS
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_access_approvals ENABLE ROW LEVEL SECURITY;

-- Companies can view their own AI configurations
CREATE POLICY "Users can view company ai_configurations" ON ai_configurations
  FOR SELECT USING (
    auth.uid() = company_id OR
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.company_id = ai_configurations.company_id
      AND team_members.user_id = auth.uid()
      AND team_members.is_approved = true
    )
  );

-- Users can only insert their own configurations
CREATE POLICY "Users can create their own ai_configurations" ON ai_configurations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins and config owners can update
CREATE POLICY "Admins and config owners can update ai_configurations" ON ai_configurations
  FOR UPDATE USING (
    auth.uid() = user_id OR
    auth.uid() = approved_by OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.company_id = ai_configurations.company_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('admin', 'owner')
    )
  );

-- Only approved configurations or creator can view access approvals
CREATE POLICY "View ai_access_approvals" ON ai_access_approvals
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() = approved_by OR
    EXISTS (
      SELECT 1 FROM ai_configurations
      WHERE ai_configurations.id = ai_access_approvals.ai_config_id
      AND (ai_configurations.user_id = auth.uid() OR ai_configurations.is_approved = true)
    )
  );

-- Admins and config owners can manage access
CREATE POLICY "Manage ai_access_approvals" ON ai_access_approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ai_configurations
      WHERE ai_configurations.id = ai_access_approvals.ai_config_id
      AND (ai_configurations.user_id = auth.uid() OR ai_configurations.approved_by = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.company_id = ai_access_approvals.company_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('admin', 'owner')
    )
  );
