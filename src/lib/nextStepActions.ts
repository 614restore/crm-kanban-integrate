import type { KanbanStatus } from './kanbanStatuses';

export type NextStepActionType =
  | 'select'          // Just open the contact detail
  | 'calendar'        // Navigate to calendar view
  | 'material-orders' // Navigate to material orders view
  | 'crew-schedule'   // Navigate to crew schedule view
  | 'estimates'       // Navigate to estimates view
  | 'documents-tab'   // Open contact → documents tab
  | 'financial-tab'   // Open contact → financial tab
  | 'job-status-tab'  // Open contact → jobStatus tab
  | 'invoice';        // Open invoice modal for the contact

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
        label: 'Build Estimate',
        description: 'Create and send a quote.',
        iconName: 'FileText',
        bgColor: 'bg-sky-50',
        textColor: 'text-sky-700',
        action: 'estimates',
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
