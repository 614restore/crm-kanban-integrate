-- Migration: Add signing/tracking columns to the documents table
-- Purpose: Enable Send-for-Signing flow from Document Templates builder
-- Documents sent for signing get a unique sign_token, track open/sign events,
-- store the signed HTML, and fire email notifications back to the sender.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS sign_token     TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sent_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS contact_email  TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS viewed_at      TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_by      TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_at      TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS html_content   TEXT;

-- Fast token lookup (partial index — only rows that have a token)
CREATE INDEX IF NOT EXISTS idx_documents_sign_token
  ON documents(sign_token)
  WHERE sign_token IS NOT NULL;
