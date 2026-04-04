-- Add limited seat tracking columns to companies table
-- Required for canvasser/field_contractor role seat limits

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS limited_seats_total integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS limited_seats_used  integer NOT NULL DEFAULT 0;
