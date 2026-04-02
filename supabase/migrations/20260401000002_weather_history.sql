-- Migration: 20260401000002_weather_history.sql
-- Creates the weather_history table for tracking weather conditions by project
-- with severity levels and delay recommendations.

CREATE TABLE IF NOT EXISTS weather_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  city              TEXT NOT NULL,
  temperature       NUMERIC(5, 2),
  weather_condition TEXT NOT NULL,
  severity_level    TEXT CHECK (severity_level IN ('low', 'moderate', 'high', 'severe', 'extreme')),
  forecast_data     JSONB,
  delay_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  delay_days        INT,
  recorded_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_history_company ON weather_history(company_id);
CREATE INDEX IF NOT EXISTS idx_weather_history_project ON weather_history(project_id);
CREATE INDEX IF NOT EXISTS idx_weather_history_date    ON weather_history(recorded_date);

ALTER TABLE weather_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weather_history_tenant_select" ON weather_history
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "weather_history_tenant_insert" ON weather_history
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "weather_history_tenant_update" ON weather_history
  FOR UPDATE USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "weather_history_tenant_delete" ON weather_history
  FOR DELETE USING (company_id = get_my_company_id());
