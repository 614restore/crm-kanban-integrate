import { supabase } from './supabase'
import { logAudit } from './auditLogger'

export async function handleAutoProgression(
  contactId: string,
  newStatus: string,
  userId: string,
  userEmail: string
) {
  // When a job is signed/won, advance to ordering material on Production Board
  if (newStatus === 'signed' || newStatus === 'approved') {
    await moveToBoard(contactId, 'production', 'ordering_material', userId, userEmail)
  }
  // When a job is completed, advance to invoicing on Billing Board
  if (newStatus === 'completed') {
    await moveToBoard(contactId, 'billing', 'invoicing', userId, userEmail)
  }
  // When invoicing is done, advance to pending payment
  if (newStatus === 'invoicing') {
    await moveToBoard(contactId, 'billing', 'pending_payment', userId, userEmail)
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

  if (!board) {
    console.warn(`Board type "${boardType}" not found for auto-progression`)
    return
  }

  // Actually update the contact status
  const { error } = await supabase
    .from('contacts')
    .update({ 
      status: initialStatus,
      status_changed_at: new Date().toISOString()
    })
    .eq('id', contactId)

  if (error) {
    console.error('Auto-progression update failed:', error)
    return
  }

  await logAudit({
    userId,
    userEmail,
    action: 'auto_board_progression',
    entityType: 'contact',
    entityId: contactId,
    oldValue: { note: 'Auto-advanced by progression rules' },
    newValue: { board: boardType, status: initialStatus },
  })
}
