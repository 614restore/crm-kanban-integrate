-- Migration: Add features JSONB column to companies table
-- Purpose: Persist Feature Toggle settings per company in the database
--          instead of relying on localStorage (which clears on different browsers/devices)

ALTER TABLE companies ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;
