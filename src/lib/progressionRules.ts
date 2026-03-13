import { supabase } from './supabaseClient'
import { logAudit } from './auditLogger'

export async function handleAutoProgression(
  contactId: string,
  newStatus: string,
  userId: string,
  userEmail: string
) {
  if (newStatus === 'signed_won') {
    await moveToBoard(contactId, 'project', 'project_scheduled', userId, userEmail)
  }
  if (newStatus === 'complete') {
    await moveToBoard(contactId, 'financial', 'invoice_sent', userId, userEmail)
  }
  if (newStatus === 'needs_attention') {
    await moveToBoard(contactId, 'owner', 'needs_attention', userId, userEmail)
  }
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

async function moveToBoard(
  contactId: string,
  boardType: string,
  initialStatus: string,
  userId: string,
  userEmail: string
) {
  const { data: board } = await supabase
    .from('kanban_boards')
    .select('id')
    .eq('type', boardType)
    .single()

  if (!board) return

  await logAudit({
    userId,
    userEmail,
    action: 'auto_board_progression',
    entityType: 'contact',
    entityId: contactId,
    newValue: { board: boardType, status: initialStatus },
  })
}
