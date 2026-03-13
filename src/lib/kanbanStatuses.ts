export type KanbanStatus =
  | 'lead'
  | 'contacted'
  | 'appt_set'
  | 'appt_complete'
  | 'estimate_sent'
  | 'estimate_viewed'
  | 'negotiating'
  | 'signed'
  | 'material_ordered'
  | 'scheduled'
  | 'in_progress'
  | 'punch_list'
  | 'complete'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'supplement_filed'
  | 'supplement_approved'
  | 'on_hold'
  | 'lost'
  | 'referral';

export const KANBAN_STATUS_LABELS: Record<KanbanStatus, string> = {
  lead: 'New Lead',
  contacted: 'Contacted',
  appt_set: 'Appt Set',
  appt_complete: 'Appt Complete',
  estimate_sent: 'Estimate Sent',
  estimate_viewed: 'Estimate Viewed',
  negotiating: 'Negotiating',
  signed: 'Signed',
  material_ordered: 'Material Ordered',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  punch_list: 'Punch List',
  complete: 'Complete',
  invoice_sent: 'Invoice Sent',
  invoice_paid: 'Invoice Paid',
  supplement_filed: 'Supplement Filed',
  supplement_approved: 'Supplement Approved',
  on_hold: 'On Hold',
  lost: 'Lost',
  referral: 'Referral',
};

export const KANBAN_STATUS_COLORS: Record<KanbanStatus, string> = {
  lead: '#3b82f6',
  contacted: '#6366f1',
  appt_set: '#8b5cf6',
  appt_complete: '#a855f7',
  estimate_sent: '#f59e0b',
  estimate_viewed: '#10b981',
  negotiating: '#f97316',
  signed: '#22c55e',
  material_ordered: '#14b8a6',
  scheduled: '#06b6d4',
  in_progress: '#0ea5e9',
  punch_list: '#84cc16',
  complete: '#16a34a',
  invoice_sent: '#f59e0b',
  invoice_paid: '#15803d',
  supplement_filed: '#7c3aed',
  supplement_approved: '#5b21b6',
  on_hold: '#9ca3af',
  lost: '#ef4444',
  referral: '#ec4899',
};

export const ACTIVE_STATUSES: KanbanStatus[] = [
  'lead', 'contacted', 'appt_set', 'appt_complete',
  'estimate_sent', 'estimate_viewed', 'negotiating',
  'signed', 'material_ordered', 'scheduled', 'in_progress', 'punch_list',
];

export const CLOSED_WON_STATUSES: KanbanStatus[] = [
  'complete', 'invoice_sent', 'invoice_paid',
];

export const CLOSED_LOST_STATUSES: KanbanStatus[] = ['lost'];

export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.includes(status as KanbanStatus);
}

export function isClosedWon(status: string): boolean {
  return CLOSED_WON_STATUSES.includes(status as KanbanStatus);
}

export function getStatusLabel(status: string): string {
  return KANBAN_STATUS_LABELS[status as KanbanStatus] ?? status;
}

export function getStatusColor(status: string): string {
  return KANBAN_STATUS_COLORS[status as KanbanStatus] ?? '#9ca3af';
}
