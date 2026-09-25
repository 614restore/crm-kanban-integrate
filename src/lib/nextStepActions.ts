import type { KanbanStatus } from './kanbanStatuses';

export type NextStepActionType =
  | 'select'          // Just open the contact detail
  | 'calendar'        // Navigate to calendar view
  | 'material-orders' // Navigate to material orders view
  | 'crew-schedule'   // Navigate to crew schedule view
  | 'quotes'          // Open the quote builder for the contact
  | 'documents-tab'   // Open contact → documents tab
  | 'financial-tab'   // Open contact → financial tab
  | 'job-status-tab'  // Open contact → jobStatus tab
  | 'invoice'         // Open invoice modal for the contact
  | 'inspection'      // Open the inspections view for the contact
  | 'quote-payment';  // Open the contact's quote to record a payment

export interface NextStep {
  label: string;
  description: string;
  iconName: string;
  bgColor: string;
  textColor: string;
  action: NextStepActionType;
}

/**
 * Returns the recommended next action for a given kanban status, or null if
 * the status is terminal / has no logical next step prompt.
 */
export function getNextStep(status: KanbanStatus): NextStep | null {
  switch (status) {
    case 'new_lead':
      return {
        label: 'Schedule Appointment',
        description: 'Book the first call or site visit.',
        iconName: 'Calendar',
        bgColor: 'bg-indigo-50',
        textColor: 'text-indigo-700',
        action: 'calendar',
      };
    case 'contacted':
      return {
        label: 'Book Inspection',
        description: 'Schedule the property inspection.',
        iconName: 'Calendar',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        action: 'calendar',
      };
    case 'inspection_scheduled':
      return {
        label: 'Log Inspection',
        description: 'Document the inspection to move to Estimating.',
        iconName: 'ClipboardList',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        action: 'job-status-tab',
      };
    case 'estimating':
      return {
        label: 'Build Quote',
        description: 'Create and send a quote.',
        iconName: 'FileText',
        bgColor: 'bg-sky-50',
        textColor: 'text-sky-700',
        action: 'quotes',
      };
    case 'estimate_sent':
      return {
        label: 'Get Signature',
        description: "Collect the customer's signature on documents.",
        iconName: 'PenLine',
        bgColor: 'bg-violet-50',
        textColor: 'text-violet-700',
        action: 'documents-tab',
      };
    case 'follow_up':
      return {
        label: 'Follow Up',
        description: 'Reach out to the customer.',
        iconName: 'MessageSquare',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        action: 'select',
      };
    case 'signed_won':
      return {
        label: 'Collect Down Payment',
        description: 'Record the deposit before starting the project.',
        iconName: 'DollarSign',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        action: 'financial-tab',
      };
    case 'project_scheduled':
      return {
        label: 'Order Materials',
        description: 'Create a material order for this job.',
        iconName: 'Package',
        bgColor: 'bg-cyan-50',
        textColor: 'text-cyan-700',
        action: 'material-orders',
      };
    case 'materials_ordered':
      return {
        label: 'Schedule Crew',
        description: 'Assign crew members and set the work date.',
        iconName: 'Users',
        bgColor: 'bg-indigo-50',
        textColor: 'text-indigo-700',
        action: 'crew-schedule',
      };
    case 'in_progress':
      return {
        label: 'Update Progress',
        description: 'Log work completed.',
        iconName: 'Wrench',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        action: 'job-status-tab',
      };
    case 'punch_list':
      return {
        label: 'Complete Punch List',
        description: 'Close out remaining items.',
        iconName: 'CheckSquare',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        action: 'job-status-tab',
      };
    case 'complete':
      return {
        label: 'Send Invoice',
        description: 'Create and send the final invoice.',
        iconName: 'Receipt',
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        action: 'invoice',
      };
    case 'invoice_sent':
      return {
        label: 'Collect Payment',
        description: 'Track and record payment.',
        iconName: 'DollarSign',
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-700',
        action: 'financial-tab',
      };
    case 'partial_payment':
      return {
        label: 'Collect Balance',
        description: 'Follow up on remaining payment.',
        iconName: 'DollarSign',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        action: 'financial-tab',
      };
    case 'needs_attention':
      return {
        label: 'Review Now',
        description: 'This contact needs attention.',
        iconName: 'AlertTriangle',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        action: 'select',
      };
    // Terminal / no-prompt statuses
    case 'paid_in_full':
    case 'lost':
    case 'collections':
    case 'awaiting_approval':
    case 'on_hold':
    case 'escalated':
    default:
      return null;
  }
}

/** What a next step can know about a contact beyond its status. */
export interface NextStepContext {
  /** Whether the contact already has a quote; unknown on the board. */
  hasQuote?: boolean;
  inspectionCompleted?: boolean;
}

const KANBAN_STATUSES = new Set<string>([
  'new_lead', 'contacted', 'inspection_scheduled', 'estimating', 'estimate_sent', 'follow_up', 'signed_won', 'lost',
  'project_scheduled', 'materials_ordered', 'in_progress', 'punch_list', 'complete',
  'invoice_sent', 'partial_payment', 'paid_in_full', 'collections',
  'needs_attention', 'awaiting_approval', 'on_hold', 'escalated',
]);

/**
 * The next thing to do to move a contact along, for either status vocabulary:
 * the board's Kanban statuses (new_lead, signed_won, …) or the statuses the
 * contact page and mobile app save (lead, appt_set, signed, …). Returns null
 * when the contact is finished or lost.
 */
export function getNextStepForStatus(rawStatus: string | null | undefined, ctx: NextStepContext = {}): NextStep | null {
  const status = (rawStatus ?? '').trim().toLowerCase();
  if (!status) return null;

  const quoteStep = (): NextStep =>
    ctx.hasQuote
      ? {
          label: 'Open Quote',
          description: 'Finish the quote and send it to the customer.',
          iconName: 'FileText',
          bgColor: 'bg-sky-50',
          textColor: 'text-sky-700',
          action: 'quotes',
        }
      : {
          label: 'Build Quote',
          description: 'Create and send a quote.',
          iconName: 'FileText',
          bgColor: 'bg-sky-50',
          textColor: 'text-sky-700',
          action: 'quotes',
        };

  switch (status) {
    case 'prospect':
    case 'lead':
      return getNextStep('new_lead');
    case 'claim_filed':
    case 'adjuster_scheduled':
    case 'supplement_filed':
      // Waiting on the carrier: when their scope arrives, the next move is the quote.
      return ctx.hasQuote
        ? {
            label: 'Waiting on the Carrier',
            description: 'Follow up on the adjuster or scope, then send the quote for signature.',
            iconName: 'Clock',
            bgColor: 'bg-sky-50',
            textColor: 'text-sky-700',
            action: 'quotes',
          }
        : {
            ...quoteStep(),
            label: 'Build the Quote',
            description: "Once the carrier's scope arrives, build the quote from it.",
          };
    case 'appt_set':
      return ctx.inspectionCompleted
        ? quoteStep()
        : {
            label: 'Start Inspection',
            description: 'Inspect the property, then mark the inspection complete.',
            iconName: 'ClipboardList',
            bgColor: 'bg-amber-50',
            textColor: 'text-amber-700',
            action: 'inspection',
          };
    case 'inspection_completed':
    case 'estimating':
      return quoteStep();
    case 'estimate_sent':
    case 'contingency':
    case 'retail':
      if (ctx.hasQuote === false) return quoteStep();
      return {
        label: 'Get Signature',
        description: "Open the quote and send it for the customer's signature.",
        iconName: 'PenLine',
        bgColor: 'bg-violet-50',
        textColor: 'text-violet-700',
        // On the board the quotes aren't known, so open the contact instead of a new quote.
        action: ctx.hasQuote ? 'quotes' : 'select',
      };
    case 'approved':
    case 'signed':
      return {
        label: 'Collect Down Payment',
        description: 'Record the deposit before starting the project.',
        iconName: 'DollarSign',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        action: ctx.hasQuote ? 'quote-payment' : 'financial-tab',
      };
    case 'scheduled':
      return getNextStep('project_scheduled');
    case 'ordering_material':
      return getNextStep('materials_ordered');
    case 'build_phase':
      return getNextStep('in_progress');
    case 'cleanup':
      return {
        label: 'QC & Walkthrough',
        description: 'Check the cleanup, finish the photos and punch list, then create the final invoice.',
        iconName: 'ClipboardList',
        bgColor: 'bg-teal-50',
        textColor: 'text-teal-700',
        action: ctx.hasQuote ? 'quotes' : 'financial-tab',
      };
    case 'invoicing':
      return getNextStep('complete');
    case 'pending_payment':
      return { ...(getNextStep('invoice_sent') as NextStep), action: ctx.hasQuote ? 'quote-payment' : 'financial-tab' };
    case 'completed':
      return null;
  }

  if (KANBAN_STATUSES.has(status)) {
    const step = getNextStep(status as KanbanStatus);
    return step?.action === 'quotes' ? quoteStep() : step;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lightweight cross-module "pending tab" slot — avoids touching crmStore.
// PipelineBoard sets it before dispatching SELECT_CONTACT.
// ContactDetail reads+clears it on mount / contact change.
// ---------------------------------------------------------------------------
let _pendingContactTab: string | null = null;

export function setPendingContactTab(tab: string): void {
  _pendingContactTab = tab;
}

export function consumePendingContactTab(): string | null {
  const tab = _pendingContactTab;
  _pendingContactTab = null;
  return tab;
}
