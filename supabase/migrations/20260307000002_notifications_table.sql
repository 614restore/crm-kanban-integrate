-- Migration: Create notifications table for in-app alerts
-- Supports: unassigned appointment alerts, @mention notifications, general alerts

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- target user (NULL = company-wide)
  type TEXT NOT NULL DEFAULT 'info',  -- 'info', 'warning', 'error', 'success', 'unassigned_appointment', 'mention'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,         -- appointment_id, contact_id, etc.
  related_type TEXT,        -- 'appointment', 'contact', 'job', etc.
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 3. RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_tenant_select ON notifications;
DROP POLICY IF EXISTS notifications_tenant_insert ON notifications;
DROP POLICY IF EXISTS notifications_tenant_update ON notifications;
DROP POLICY IF EXISTS notifications_tenant_delete ON notifications;

CREATE POLICY notifications_tenant_select ON notifications
  FOR SELECT USING (company_id = public.get_my_company_id());

CREATE POLICY notifications_tenant_insert ON notifications
  FOR INSERT WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY notifications_tenant_update ON notifications
  FOR UPDATE USING (company_id = public.get_my_company_id());

CREATE POLICY notifications_tenant_delete ON notifications
  FOR DELETE USING (company_id = public.get_my_company_id());
