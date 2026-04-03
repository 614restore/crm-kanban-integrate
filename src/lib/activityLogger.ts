import { supabase } from './supabase';

interface ActivityEntry {
  contactId: string;
  companyId: string;
  userId?: string;
  content: string;
}

/**
 * Log an automated activity note to the communications table for a contact.
 * Used to record system-generated events (estimate edits, sends, signings, etc.)
 * so they appear in the contact's communication timeline.
 */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  const { error } = await supabase.from('communications').insert({
    contact_id: entry.contactId,
    company_id: entry.companyId,
    type: 'note',
    direction: 'internal',
    content: entry.content,
    status: 'completed',
    created_by: entry.userId ?? null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.warn('[activityLogger] Failed to log activity:', error.message);
  }
}
