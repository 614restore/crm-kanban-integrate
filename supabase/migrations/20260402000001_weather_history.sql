-- Migration file to create the weather_history table

CREATE TABLE weather_history (
    id SERIAL PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL,
    city VARCHAR(255) NOT NULL,
    temperature DECIMAL(5, 2) NOT NULL,
    weather_condition VARCHAR(255) NOT NULL,
    severity_level VARCHAR(50),
    forecast_data JSONB,
    delay_recommended BOOLEAN DEFAULT FALSE,
    delay_days INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_date DATE NOT NULL
);

-- Create indexes
CREATE INDEX idx_weather_history_company ON weather_history(company_id);
CREATE INDEX idx_weather_history_project ON weather_history(project_id);
CREATE INDEX idx_weather_history_city ON weather_history(city);

-- Row Level Security
ALTER TABLE weather_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weather_history_tenant_select" ON weather_history
    FOR SELECT TO authenticated
    USING (company_id = get_my_company_id());

CREATE POLICY "weather_history_tenant_insert" ON weather_history
    FOR INSERT TO authenticated
    WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "weather_history_tenant_update" ON weather_history
    FOR UPDATE TO authenticated
    USING (company_id = get_my_company_id())
    WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "weather_history_tenant_delete" ON weather_history
    FOR DELETE TO authenticated
    USING (company_id = get_my_company_id());
