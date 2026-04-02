import { supabase } from './supabase'
import { logAudit } from './auditLogger'

export async function handleAutoProgression(
  contactId: string,
  newStatus: string,
  userId: string,
  userEmail: string
) {
  // Early sales pipeline progression based on scheduled activities
  await checkTimeBasedProgression(contactId, newStatus, userId, userEmail);
  
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

// Check for time-based progression based on scheduled appointments/inspections
async function checkTimeBasedProgression(
  contactId: string,
  currentStatus: string,
  userId: string,
  userEmail: string
) {
  try {
    // Check upcoming appointments to trigger status changes
    const { data: appointments } = await supabase
      .from('appointments')
      .select('scheduled_date, type, status')
      .eq('contact_id', contactId)
      .eq('status', 'scheduled')
      .order('scheduled_date', { ascending: true });

    if (!appointments?.length) return;

    const now = new Date();
    
    for (const appointment of appointments) {
      const appointmentDate = new Date(appointment.scheduled_date);
      const timeDiff = appointmentDate.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // If inspection is scheduled and we're still in lead status, move to appointment set
      if (appointment.type === 'inspection' && currentStatus === 'lead' && hoursDiff > 0) {
        await autoUpdateStatus(contactId, 'appt_set', 'time_based', 'Inspection scheduled', userId, userEmail);
        break;
      }
      
      // If inspection time has passed and we're in appt_set, move to inspection_completed
      if (appointment.type === 'inspection' && currentStatus === 'appt_set' && hoursDiff <= -1) {
        await autoUpdateStatus(contactId, 'inspection_completed', 'time_based', 'Inspection completed based on schedule', userId, userEmail);
        
        // Auto progress to estimating after inspection completion
        setTimeout(async () => {
          await autoUpdateStatus(contactId, 'estimating', 'auto_progression', 'Auto-progressed to estimating after inspection', userId, userEmail);
        }, 5000); // 5 second delay
        break;
      }
    }
  } catch (error) {
    console.warn('Error checking time-based progression:', error);
  }
}

// Helper to update status through the centralized system
async function autoUpdateStatus(
  contactId: string,
  newStatus: string,
  source: string,
  reason: string,
  userId: string,
  userEmail: string
) {
  try {
    const { updateContactStatus } = await import('./statusManager');
    
    // Get current contact data
    const { data: contact } = await supabase
      .from('contacts')
      .select('status, name, email, company_id')
      .eq('id', contactId)
      .single();

    if (!contact) return;

    await updateContactStatus({
      contactId,
      newStatus,
      oldStatus: contact.status,
      contactName: contact.name,
      contactEmail: contact.email,
      userId,
      userEmail,
      companyId: contact.company_id,
      source,
      reason,
      skipAutomation: false
    });
  } catch (error) {
    console.error('Auto status update failed:', error);
  }
}
