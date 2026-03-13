import type { KanbanStatus } from './kanbanStatuses';

/**
 * Defines which status transitions are allowed.
 * Key = current status, Value = array of valid next statuses.
 * An empty array means "terminal" — no forward moves.
 */
export const PROGRESSION_RULES: Partial<Record<KanbanStatus, KanbanStatus[]>> = {
  lead:                ['contacted', 'appt_set', 'on_hold', 'lost'],
  contacted:           ['appt_set', 'on_hold', 'lost'],
  appt_set:            ['appt_complete', 'contacted', 'on_hold', 'lost'],
  appt_complete:       ['estimate_sent', 'on_hold', 'lost'],
  estimate_sent:       ['estimate_viewed', 'negotiating', 'signed', 'on_hold', 'lost'],
  estimate_viewed:     ['negotiating', 'signed', 'on_hold', 'lost'],
  negotiating:         ['signed', 'on_hold', 'lost'],
  signed:              ['material_ordered', 'scheduled', 'in_progress'],
  material_ordered:    ['scheduled'],
  scheduled:           ['in_progress'],
  in_progress:         ['punch_list', 'complete'],
  punch_list:          ['complete'],
  complete:            ['invoice_sent'],
  invoice_sent:        ['invoice_paid'],
  invoice_paid:        [],
  supplement_filed:    ['supplement_approved'],
  supplement_approved: ['invoice_sent'],
  on_hold:             ['lead', 'contacted', 'appt_set', 'estimate_sent', 'signed'],
  lost:                ['lead'],
  referral:            ['lead'],
};

/**
 * Returns allowed next statuses for a given current status.
 * If status is unknown or terminal, returns empty array.
 */
export function getAllowedTransitions(currentStatus: string): KanbanStatus[] {
  return PROGRESSION_RULES[currentStatus as KanbanStatus] ?? [];
}

/**
 * Returns true if moving from `from` to `to` is a valid transition.
 */
export function isValidTransition(from: string, to: string): boolean {
  return getAllowedTransitions(from).includes(to as KanbanStatus);
}

/**
 * Returns a human-readable reason why a transition is blocked, or null if allowed.
 */
export function getTransitionBlockReason(from: string, to: string): string | null {
  if (isValidTransition(from, to)) return null;
  const allowed = getAllowedTransitions(from);
  if (allowed.length === 0) return `"${from}" is a terminal status — no further moves allowed.`;
  return `Cannot move from "${from}" directly to "${to}". Allowed: ${allowed.join(', ')}.`;
}
