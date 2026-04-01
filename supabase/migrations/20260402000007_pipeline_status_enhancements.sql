-- Pipeline Status System Enhancement Migration
-- Adds database-level validation, enhanced automation, and better status tracking

-- 1. Add database constraint for valid statuses
DO $$ 
BEGIN
    -- Drop constraint if it exists (for reruns)
    ALTER TABLE contacts DROP CONSTRAINT IF EXISTS valid_contact_status;
    
    -- Add comprehensive status validation
    ALTER TABLE contacts ADD CONSTRAINT valid_contact_status 
    CHECK (status IN (
        -- Sales Pipeline
        'prospect', 'lead', 'appt_set', 'inspection_completed', 'estimating', 
        'estimate_sent', 'contingency', 'signed', 'retail',
        
        -- Production Pipeline  
        'ordering_material', 'in_progress', 'build_phase', 'cleanup', 'completed',
        
        -- Billing Pipeline
        'invoicing', 'pending_payment',
        
        -- Insurance Pipeline
        'claim_filed', 'adjuster_scheduled', 'supplement_filed', 'approved',
        
        -- Terminal States
        'lost', 'cancelled', 'dead', 'declined', 'closed-lost', 'rejected', 
        'not-interested', 'paid'
    ));
    
    RAISE NOTICE 'Added status validation constraint';
END $$;

-- 2. Enhance automation system with delay support and better event tracking
CREATE TABLE IF NOT EXISTS automation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    automation_id UUID NOT NULL REFERENCES automations(id),
    event_type TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'cancelled')),
    context JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_queue_scheduled 
ON automation_queue(scheduled_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_automation_queue_company_contact 
ON automation_queue(company_id, contact_id);

-- 3. Add function to process delayed automations
CREATE OR REPLACE FUNCTION process_automation_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    processed_count INTEGER := 0;
    queue_item RECORD;
BEGIN
    -- Process all pending automations that are due
    FOR queue_item IN 
        SELECT aq.*, a.action_type, a.name as automation_name
        FROM automation_queue aq
        JOIN automations a ON a.id = aq.automation_id
        WHERE aq.status = 'pending' 
        AND aq.scheduled_at <= NOW()
        ORDER BY aq.scheduled_at
        LIMIT 100  -- Process in batches
    LOOP
        BEGIN
            -- Mark as executed immediately to prevent double-processing
            UPDATE automation_queue 
            SET status = 'executed', executed_at = NOW()
            WHERE id = queue_item.id;
            
            -- Here we would trigger the actual automation
            -- For now, just log the event
            INSERT INTO audit_logs (
                user_id, user_email, action, entity_type, entity_id,
                old_value, new_value, company_id
            ) VALUES (
                'system'::UUID, 'system@automation', 'delayed_automation_executed',
                'contact', queue_item.contact_id,
                jsonb_build_object('automation_id', queue_item.automation_id),
                jsonb_build_object('event_type', queue_item.event_type, 'context', queue_item.context),
                queue_item.company_id
            );
            
            processed_count := processed_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Mark as failed and record error
            UPDATE automation_queue 
            SET status = 'failed', 
                executed_at = NOW(),
                error_message = SQLERRM
            WHERE id = queue_item.id;
        END;
    END LOOP;
    
    RETURN processed_count;
END;
$$;

-- 4. Add function to schedule delayed automation
CREATE OR REPLACE FUNCTION schedule_automation(
    p_company_id UUID,
    p_contact_id UUID,
    p_automation_id UUID,
    p_event_type TEXT,
    p_delay_minutes INTEGER DEFAULT 0,
    p_context JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    queue_id UUID;
BEGIN
    INSERT INTO automation_queue (
        company_id, contact_id, automation_id, event_type,
        scheduled_at, context
    ) VALUES (
        p_company_id, p_contact_id, p_automation_id, p_event_type,
        NOW() + (p_delay_minutes || ' minutes')::INTERVAL,
        p_context
    ) RETURNING id INTO queue_id;
    
    RETURN queue_id;
END;
$$;

-- 5. Add status transition audit trigger
CREATE OR REPLACE FUNCTION audit_status_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only log when status actually changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO audit_logs (
            user_id, user_email, action, entity_type, entity_id,
            old_value, new_value, company_id
        ) VALUES (
            COALESCE(current_setting('app.user_id', TRUE)::UUID, 'system'::UUID),
            COALESCE(current_setting('app.user_email', TRUE), 'system@trussctr.com'),
            'status_change',
            'contact',
            NEW.id,
            jsonb_build_object('status', OLD.status, 'changed_at', OLD.status_changed_at),
            jsonb_build_object('status', NEW.status, 'changed_at', NEW.status_changed_at),
            NEW.company_id
        );
        
        -- Set status_changed_at if not already set
        IF NEW.status_changed_at IS NULL OR NEW.status_changed_at = OLD.status_changed_at THEN
            NEW.status_changed_at = NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop and recreate trigger to ensure it's current
DROP TRIGGER IF EXISTS tr_audit_status_transitions ON contacts;
CREATE TRIGGER tr_audit_status_transitions
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION audit_status_transitions();

-- 6. Add function to get status transition history
CREATE OR REPLACE FUNCTION get_contact_status_history(p_contact_id UUID)
RETURNS TABLE(
    status TEXT,
    changed_at TIMESTAMPTZ,
    changed_by_email TEXT,
    duration_in_stage INTERVAL,
    source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH status_changes AS (
        SELECT 
            (new_value->>'status') as status,
            (new_value->>'changed_at')::TIMESTAMPTZ as changed_at,
            user_email as changed_by_email,
            (new_value->>'source') as source,
            created_at,
            LAG((new_value->>'changed_at')::TIMESTAMPTZ) OVER (ORDER BY created_at) as prev_changed_at
        FROM audit_logs 
        WHERE entity_id = p_contact_id 
        AND entity_type = 'contact'
        AND action = 'status_change'
        ORDER BY created_at DESC
    )
    SELECT 
        sc.status,
        sc.changed_at,
        sc.changed_by_email,
        CASE 
            WHEN sc.prev_changed_at IS NOT NULL 
            THEN sc.prev_changed_at - sc.changed_at
            ELSE NULL 
        END as duration_in_stage,
        COALESCE(sc.source, 'unknown') as source
    FROM status_changes sc
    ORDER BY sc.changed_at DESC;
END;
$$;

-- 7. Create view for pipeline analytics
CREATE OR REPLACE VIEW pipeline_analytics AS
WITH status_durations AS (
    SELECT 
        c.id,
        c.company_id,
        c.status,
        c.status_changed_at,
        COALESCE(
            EXTRACT(EPOCH FROM (NOW() - c.status_changed_at)) / 86400,  -- Days in current stage
            EXTRACT(EPOCH FROM (NOW() - c.updated_at)) / 86400,        -- Fallback to updated_at
            EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 86400         -- Fallback to created_at
        )::INTEGER as days_in_stage,
        CASE 
            WHEN c.claim_number IS NOT NULL OR c.insurance_company IS NOT NULL THEN 'insurance'
            WHEN c.is_retail = TRUE THEN 'retail'
            ELSE 'shared'
        END as pipeline_type
    FROM contacts c
    WHERE c.status NOT IN ('completed', 'lost', 'cancelled', 'paid')
)
SELECT 
    company_id,
    status,
    pipeline_type,
    COUNT(*) as contact_count,
    AVG(days_in_stage)::INTEGER as avg_days_in_stage,
    MIN(days_in_stage) as min_days_in_stage,
    MAX(days_in_stage) as max_days_in_stage,
    COUNT(*) FILTER (WHERE days_in_stage >= 21) as stale_contacts_21_plus,
    COUNT(*) FILTER (WHERE days_in_stage BETWEEN 14 AND 20) as aging_contacts_14_20,
    COUNT(*) FILTER (WHERE days_in_stage BETWEEN 7 AND 13) as warning_contacts_7_13
FROM status_durations
GROUP BY company_id, status, pipeline_type
ORDER BY company_id, pipeline_type, status;

-- 8. Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON automation_queue TO authenticated;
GRANT EXECUTE ON FUNCTION process_automation_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_automation(UUID, UUID, UUID, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_status_history(UUID) TO authenticated;
GRANT SELECT ON pipeline_analytics TO authenticated;

-- Final notification
DO $$ 
BEGIN
    RAISE NOTICE 'Pipeline status system enhancement completed:';
    RAISE NOTICE '- Added database-level status validation';
    RAISE NOTICE '- Created automation queue for delayed triggers';
    RAISE NOTICE '- Added status transition audit logging';
    RAISE NOTICE '- Created pipeline analytics view';
    RAISE NOTICE '- Added helper functions for status management';
END $$;