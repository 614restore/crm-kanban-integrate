import { supabase } from '@/lib/supabase';

export type AuditAction =
  | 'contact_created'
  | 'contact_updated'
  | 'contact_deleted'
  | 'status_changed'
  | 'estimate_sent'
  | 'estimate_viewed'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'document_created'
  | 'document_signed'
  | 'board_created'
  | 'board_updated'
  | 'board_deleted'
  | 'user_login'
  | 'settings_changed';

export interface AuditEntry {
  company_id: string;
  user_id?: string;
  user_email?: string;
  action: AuditAction;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      ...entry,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking — never throw from audit log
    console.warn('[auditLogger] Failed to write audit entry:', err);
  }
}

export async function getAuditLog(
  companyId: string,
  options?: { limit?: number; entity_type?: string; action?: AuditAction }
) {
  let query = supabase
    .from('audit_log')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.entity_type) query = query.eq('entity_type', options.entity_type);
  if (options?.action) query = query.eq('action', options.action);

  const { data, error } = await query;
  if (error) console.warn('[auditLogger] getAuditLog error:', error);
  return data ?? [];
}
