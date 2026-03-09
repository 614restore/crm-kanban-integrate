import { db } from '@/lib/database';
import { sendEmail } from '@/lib/emailApi';
import { toast } from 'sonner';

export interface AutomationContext {
  contactName?: string;
  contactEmail?: string;
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

function buildEmailHtml(title: string, message: string, ctx: AutomationContext): string {
  const name = ctx.contactName || 'there';
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; background: #f9fafb; padding: 32px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1f2937; margin-top: 0;">${title}</h2>
          <p style="color: #4b5563; font-size: 15px;">Hi ${name},</p>
          <p style="color: #4b5563; font-size: 15px;">${message}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">This email was sent automatically by your CRM automation.</p>
        </div>
      </body>
    </html>
  `.trim();
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
    if (!ctx.contactEmail) {
      console.warn(`Automation "${automationName}": no contactEmail in context, skipping email send.`);
      return;
    }
    const { title, message } = buildNotificationMessage(automationName, eventType, ctx);
    const html = buildEmailHtml(title, message, ctx);
    try {
      await sendEmail({
        to: ctx.contactEmail,
        subject: title,
        html,
      });
      console.log(`Automation "${automationName}": email sent to ${ctx.contactEmail}`);
    } catch (err) {
      console.error(`Automation "${automationName}": failed to send email to ${ctx.contactEmail}:`, err);
    }
    return;
  }

  if (at.includes('sms')) {
    // SMS requires a paid provider (e.g. Twilio). Gracefully skip for now.
    console.log(`Automation "${automationName}": SMS action not yet configured — skipping.`);
    return;
  }

  if (at.includes('status')) {
    console.log(`Automation "${automationName}": would update status — new status: ${ctx.newStatus || 'unknown'}`);
    return;
  }

  if (at.includes('assign')) {
    console.log(`Automation "${automationName}": would assign team member — assignedTo: ${ctx.assignedTo || 'unknown'}`);
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
