import { db } from '@/lib/database';
import { toast } from 'sonner';

export interface AutomationContext {
  contactName?: string;
  contactId?: string;
  oldStatus?: string;
  newStatus?: string;
  invoiceNumber?: string;
  amount?: number;
  assignedTo?: string;
  [key: string]: any;
}

function buildNotificationMessage(actionName: string, eventType: string, ctx: AutomationContext): { title: string; message: string } {
  const name = ctx.contactName || 'a contact';

  if (eventType.includes('status')) {
    const change = ctx.oldStatus && ctx.newStatus ? ` from "${ctx.oldStatus}" to "${ctx.newStatus}"` : '';
    return {
      title: `Status Changed — ${actionName}`,
      message: `${name} status updated${change}.`,
    };
  }

  if (eventType.includes('invoice')) {
    const inv = ctx.invoiceNumber ? ` #${ctx.invoiceNumber}` : '';
    const amt = ctx.amount != null ? ` ($${ctx.amount.toFixed(2)})` : '';
    return {
      title: `Invoice${inv} — ${actionName}`,
      message: `Invoice${inv}${amt} created for ${name}.`,
    };
  }

  if (eventType.includes('payment') || eventType.includes('paid')) {
    const amt = ctx.amount != null ? ` of $${ctx.amount.toFixed(2)}` : '';
    return {
      title: `Payment Received — ${actionName}`,
      message: `Payment${amt} received from ${name}.`,
    };
  }

  if (eventType.includes('estimate')) {
    return {
      title: `Estimate Accepted — ${actionName}`,
      message: `${name} accepted an estimate.`,
    };
  }

  return {
    title: actionName,
    message: `Automation triggered for ${name}.`,
  };
}

async function executeAction(
  automationName: string,
  actionType: string,
  eventType: string,
  companyId: string,
  ctx: AutomationContext
): Promise<void> {
  const at = actionType.toLowerCase();

  if (at.includes('notification')) {
    const { title, message } = buildNotificationMessage(automationName, eventType, ctx);
    await db.createNotification({
      company_id: companyId,
      type: 'automation',
      title,
      message,
      related_id: ctx.contactId,
      related_type: ctx.contactId ? 'contact' : undefined,
      read: false,
    });
    toast.info(message, { description: title });
    return;
  }

  if (at.includes('email')) {
    console.log(`Automation: would send email for "${automationName}" — contact: ${ctx.contactName || 'unknown'}`);
    return;
  }

  if (at.includes('sms')) {
    console.log(`Automation: would send SMS for "${automationName}" — contact: ${ctx.contactName || 'unknown'}`);
    return;
  }

  if (at.includes('status')) {
    console.log(`Automation: would update status for "${automationName}" — new status: ${ctx.newStatus || 'unknown'}`);
    return;
  }

  if (at.includes('assign')) {
    console.log(`Automation: would assign team member for "${automationName}" — assignedTo: ${ctx.assignedTo || 'unknown'}`);
    return;
  }

  console.log(`Automation: unknown action_type "${actionType}" for "${automationName}"`);
}

export async function fireAutomationEvent(
  eventType: string,
  companyId: string,
  context: AutomationContext
): Promise<void> {
  try {
    const automations = await db.getAutomations(companyId);
    const active = automations.filter((a) => a.is_active);
    const needle = eventType.toLowerCase();
    const matching = active.filter((a) => a.trigger_event.toLowerCase().includes(needle) || needle.includes(a.trigger_event.toLowerCase()));

    for (const automation of matching) {
      try {
        await executeAction(automation.name, automation.action_type, eventType, companyId, context);
      } catch (err) {
        console.error(`Automation "${automation.name}" failed:`, err);
      }
    }
  } catch (err) {
    console.error('fireAutomationEvent error:', err);
  }
}
