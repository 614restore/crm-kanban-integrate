import { supabase } from './supabase'
import { logAudit } from './auditLogger'

// Maps a contact status to the next board type and the status the contact
// should receive when they auto-advance into that board.
const AUTO_ADVANCE_MAP: Record<string, { boardType: string; nextStatus: string }> = {
  // Signing a contract → Production Board
  signed:            { boardType: 'production', nextStatus: 'ordering_material' },
  // Job complete → Billing Board
  completed:         { boardType: 'billing',    nextStatus: 'invoicing' },
  // Invoice sent → pending payment
  invoicing:         { boardType: 'billing',    nextStatus: 'pending_payment' },
};

/**
 * Call this whenever a contact's status changes.  If the new status has an
 * auto-advancement rule the contact's status is updated and an audit entry is
 * created — but ONLY when the DB already has a board of the target type for
 * this company, so companies that haven't customised their boards aren't
 * broken.
 */
export async function handleAutoProgression(
  contactId: string,
  newStatus: string,
  companyId: string,
  userId: string,
  userEmail: string
) {
  const rule = AUTO_ADVANCE_MAP[newStatus];
  if (!rule) return; // no auto-advance for this status

  // Verify the target board exists for this company
  const { data: board } = await supabase
    .from('kanban_boards')
    .select('id')
    .eq('company_id', companyId)
    .eq('type', rule.boardType)
    .maybeSingle();

  if (!board) return; // board not set up — skip silently

  // Advance the contact to the new status
  const { error } = await supabase
    .from('contacts')
    .update({ status: rule.nextStatus, status_changed_at: new Date().toISOString() })
    .eq('id', contactId);

  if (error) {
    console.error('[handleAutoProgression] Failed to advance contact:', error);
    return;
  }

  await logAudit({
    userId,
    userEmail,
    action: 'auto_board_progression',
    entityType: 'contact',
    entityId: contactId,
    oldValue: { status: newStatus },
    newValue: { status: rule.nextStatus, boardType: rule.boardType },
  });
}

export async function checkDownPaymentGate(
  contactId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { data: payments } = await supabase
    .from('payments')
    .select('amount, type')
    .eq('contact_id', contactId)

  const hasDownPayment = payments?.some(p => p.type === 'down_payment')
  if (!hasDownPayment) {
    return { allowed: false, reason: 'Down payment required before moving to In Progress.' }
  }
  return { allowed: true }
}
