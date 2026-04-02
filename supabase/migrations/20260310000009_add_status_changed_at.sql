-- Migration: Add status_changed_at to contacts
-- Purpose: Track when a contact's status last changed for time-in-stage alerts
-- Run this in the Supabase SQL editor

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Backfill existing contacts using updated_at as a best approximation
UPDATE contacts
SET status_changed_at = updated_at
WHERE status_changed_at IS NULL;
