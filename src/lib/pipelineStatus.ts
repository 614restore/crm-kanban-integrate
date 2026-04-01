import type { CustomerStatus } from '@/lib/crmData';

const PIPELINE_STATUS_ALIASES: Record<string, CustomerStatus> = {
  new_lead: 'lead',
  appointment_set: 'appt_set',
  inspection_scheduled: 'appt_set',
  inspection_complete: 'inspection_completed',
  signed_won: 'signed',
  paid: 'completed',
};

export function normalizePipelineStatus(rawStatus: string | undefined | null): CustomerStatus | undefined {
  if (!rawStatus) return undefined;
  const status = rawStatus.trim().toLowerCase();
  return PIPELINE_STATUS_ALIASES[status] ?? (status as CustomerStatus);
}
