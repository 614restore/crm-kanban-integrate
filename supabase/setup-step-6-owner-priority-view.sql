-- ============================================================================
-- STEP 6: CREATE OWNER PRIORITY VIEW
-- Run this after Step 5
-- This powers the Owner Priority Board feature
-- ============================================================================

CREATE OR REPLACE VIEW v_owner_priority AS
SELECT 
  c.id,
  c.first_name,
  c.last_name,
  c.status,
  c.project_value,
  c.assigned_to,
  c.updated_at,
  c.company_id,
  EXTRACT(DAY FROM NOW() - c.status_changed_at)::INTEGER AS days_stale,
  CASE
    WHEN c.status = 'estimate_sent' AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 7 
      THEN 'stale_estimate'
    WHEN c.status = 'new_lead' AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 3 
      THEN 'no_touch'
    WHEN c.status = 'estimate_viewed' 
      THEN 'hot_lead'
    ELSE 'normal'
  END AS alert_type,
  CASE
    WHEN c.status = 'estimate_sent' THEN 7
    WHEN c.status = 'new_lead' THEN 3
    WHEN c.status = 'estimate_viewed' THEN 1
    ELSE 14
  END AS threshold_days,
  (
    EXTRACT(DAY FROM NOW() - c.status_changed_at)::INTEGER * 10 +
    CASE 
      WHEN c.project_value > 50000 THEN 100
      WHEN c.project_value > 25000 THEN 50
      WHEN c.project_value > 10000 THEN 25
      ELSE 0
    END +
    CASE WHEN c.status = 'estimate_viewed' THEN 200 ELSE 0 END +
    CASE WHEN c.assigned_to IS NULL THEN 50 ELSE 0 END
  )::INTEGER AS priority_score,
  CASE
    WHEN c.status IN ('invoice_sent', 'partial_payment') 
      AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 30 
      THEN 'payment'
    ELSE 'sales'
  END AS concern
FROM contacts c
WHERE 
  (
    (c.status = 'estimate_sent' AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 7) OR
    (c.status = 'new_lead' AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 3) OR
    (c.status = 'estimate_viewed') OR
    (c.status IN ('invoice_sent', 'partial_payment') AND EXTRACT(DAY FROM NOW() - c.status_changed_at) > 30)
  )
ORDER BY priority_score DESC;

GRANT SELECT ON v_owner_priority TO authenticated;
