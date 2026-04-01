-- Migration: Weather History Tracking
-- Created: 2026-04-01
-- Purpose: Store historical weather data for projects and enable weather-aware scheduling

-- Create weather_history table
CREATE TABLE IF NOT EXISTS weather_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Location data
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  location_name TEXT,
  
  -- Weather data
  temperature DECIMAL(5, 2),
  conditions TEXT, -- sunny, cloudy, rainy, stormy, etc.
  wind_speed DECIMAL(5, 2),
  precipitation DECIMAL(5, 2),
  humidity INTEGER,
  
  -- Severity and alerts
  severity TEXT CHECK (severity IN ('normal', 'moderate', 'severe', 'extreme')),
  hail_risk TEXT CHECK (hail_risk IN ('none', 'low', 'moderate', 'high')),
  has_alert BOOLEAN DEFAULT FALSE,
  alert_message TEXT,
  
  -- Forecast data (JSON for 5-day forecast)
  forecast_data JSONB,
  
  -- Impact flags
  delays_recommended BOOLEAN DEFAULT FALSE,
  crew_pause_recommended BOOLEAN DEFAULT FALSE,
  material_delay_recommended BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  weather_date TIMESTAMP WITH TIME ZONE NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_weather_history_company ON weather_history(company_id);
CREATE INDEX idx_weather_history_project ON weather_history(project_id);
CREATE INDEX idx_weather_history_contact ON weather_history(contact_id);
CREATE INDEX idx_weather_history_date ON weather_history(weather_date);
CREATE INDEX idx_weather_history_severity ON weather_history(severity) WHERE severity IN ('severe', 'extreme');
CREATE INDEX idx_weather_history_alerts ON weather_history(has_alert) WHERE has_alert = TRUE;

-- Enable RLS
ALTER TABLE weather_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view weather for their company"
  ON weather_history FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert weather for their company"
  ON weather_history FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update weather for their company"
  ON weather_history FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_weather_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weather_history_updated_at
  BEFORE UPDATE ON weather_history
  FOR EACH ROW
  EXECUTE FUNCTION update_weather_history_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON weather_history TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
