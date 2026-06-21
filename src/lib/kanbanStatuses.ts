export type KanbanStatus =
  // Sales Pipeline
  | 'new_lead'
  | 'contacted'
  | 'inspection_scheduled'
  | 'estimating'
  | 'estimate_sent'
  | 'follow_up'
  | 'signed_won'
  | 'lost'
  // Project Board
  | 'project_scheduled'
  | 'ordering_material'
  | 'materials_ordered'
  | 'in_progress'
  | 'punch_list'
  | 'complete'
  // Financial Board
  | 'invoice_sent'
  | 'partial_payment'
  | 'paid_in_full'
  | 'collections'
  // Owner Board
  | 'needs_attention'
  | 'awaiting_approval'
  | 'on_hold'
  | 'escalated'

export const STATUS_LABELS: Record<KanbanStatus, string> = {
  new_lead:             'New Lead',
  contacted:            'Contacted',
  inspection_scheduled: 'Inspection Scheduled',
  estimating:           'Estimating',
  estimate_sent:        'Estimate Sent',
  follow_up:            'Follow Up',
  signed_won:           'Signed / Won',
  lost:                 'Lost',
  project_scheduled:    'Project Scheduled',
  ordering_material:    'Ordering Material',
  materials_ordered:    'Materials Ordered',
  in_progress:          'In Progress',
  punch_list:           'Punch List',
  complete:             'Complete',
  invoice_sent:         'Invoice Sent',
  partial_payment:      'Partial Payment',
  paid_in_full:         'Paid in Full',
  collections:          'Collections',
  needs_attention:      'Needs Attention',
  awaiting_approval:    'Awaiting Approval',
  on_hold:              'On Hold',
  escalated:            'Escalated',
}

export const STATUS_COLORS: Record<KanbanStatus, string> = {
  new_lead:             '#6366f1',
  contacted:            '#3b82f6',
  inspection_scheduled: '#f59e0b',
  estimating:           '#0ea5e9',
  estimate_sent:        '#8b5cf6',
  follow_up:            '#f97316',
  signed_won:           '#22c55e',
  lost:                 '#ef4444',
  project_scheduled:    '#06b6d4',
  ordering_material:    '#f59e0b',
  materials_ordered:    '#f59e0b',
  in_progress:          '#3b82f6',
  punch_list:           '#f97316',
  complete:             '#22c55e',
  invoice_sent:         '#8b5cf6',
  partial_payment:      '#f59e0b',
  paid_in_full:         '#22c55e',
  collections:          '#ef4444',
  needs_attention:      '#ef4444',
  awaiting_approval:    '#f59e0b',
  on_hold:              '#6b7280',
  escalated:            '#dc2626',
}

export const BOARD_STATUSES: Record<string, KanbanStatus[]> = {
  sales:     ['new_lead','contacted','inspection_scheduled','estimating','estimate_sent','follow_up','signed_won','lost'],
  project:   ['project_scheduled','ordering_material','materials_ordered','in_progress','punch_list','complete'],
  financial: ['invoice_sent','partial_payment','paid_in_full','collections'],
  owner:     ['needs_attention','awaiting_approval','on_hold','escalated'],
}
