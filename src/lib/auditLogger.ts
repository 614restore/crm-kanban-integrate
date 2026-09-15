import { supabase } from './supabase'

interface AuditEntry {
  companyId: string
  userId: string
  userEmail: string
  action: string
  entityType: string
  entityId?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  // audit_logs keeps the details in one jsonb column; company_id is required by RLS.
  const { error } = await supabase.from('audit_logs').insert({
    company_id:  entry.companyId,
    user_id:     entry.userId || null,
    action:      entry.action,
    entity_type: entry.entityType,
    entity_id:   entry.entityId ?? null,
    data: {
      user_email: entry.userEmail,
      old_value:  entry.oldValue ?? null,
      new_value:  entry.newValue ?? null,
      metadata:   entry.metadata ?? null,
    },
  })

  if (error) {
    console.error('[auditLogger] Failed to log audit entry:', error.message)
  }
}
