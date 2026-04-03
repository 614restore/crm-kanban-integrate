-- User notification preferences table
-- Allows users to configure alert thresholds, quiet hours, and notification channels
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL = company default
  
  -- Channel toggles
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  
  -- Notification type toggles
  hail_alerts_enabled BOOLEAN DEFAULT true,
  wind_alerts_enabled BOOLEAN DEFAULT true,
  appointment_alerts_enabled BOOLEAN DEFAULT true,
  lead_assignment_alerts_enabled BOOLEAN DEFAULT true,
  mention_alerts_enabled BOOLEAN DEFAULT true,
  
  -- Weather thresholds
  min_hail_size_inches DECIMAL(3,2) DEFAULT 0.75,
  min_wind_speed_mph INTEGER DEFAULT 40,
  min_severity TEXT DEFAULT 'moderate' CHECK (min_severity IN ('minor', 'moderate', 'severe', 'extreme')),
  
  -- Timing preferences
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  max_alerts_per_day INTEGER DEFAULT 10,
  
  -- Service area
  service_area_zip_codes TEXT[],
  service_area_radius_miles INTEGER DEFAULT 5,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (company_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_prefs_company ON notification_preferences(company_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view preferences for their company
CREATE POLICY notification_prefs_select_policy ON notification_preferences
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can insert preferences for their company
CREATE POLICY notification_prefs_insert_policy ON notification_preferences
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own preferences or company defaults
CREATE POLICY notification_prefs_update_policy ON notification_preferences
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- RLS Policy: Users can delete their own preferences
CREATE POLICY notification_prefs_delete_policy ON notification_preferences
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_notification_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_prefs_updated_at();
