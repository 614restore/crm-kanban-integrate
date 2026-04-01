-- Migration file to create the weather_history table

CREATE TABLE weather_history (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL,
    project_id INT NOT NULL,
    city VARCHAR(255) NOT NULL,
    temperature DECIMAL(5, 2) NOT NULL,
    weather_condition VARCHAR(255) NOT NULL,
    severity_level VARCHAR(50),
    forecast_data JSONB,
    delay_recommended BOOLEAN DEFAULT FALSE,
    delay_days INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_date DATE NOT NULL
);

-- Create indexes
CREATE INDEX idx_weather_history_company ON weather_history(company_id);
CREATE INDEX idx_weather_history_project ON weather_history(project_id);
CREATE INDEX idx_weather_history_city ON weather_history(city);

-- Row Level Security
ALTER TABLE weather_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_weather_history ON weather_history
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = weather_history.company_id
    ));

CREATE POLICY insert_weather_history ON weather_history
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = weather_history.company_id
    ));

CREATE POLICY update_weather_history ON weather_history
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = weather_history.company_id
    ));

CREATE POLICY delete_weather_history ON weather_history
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = weather_history.company_id
    ));
