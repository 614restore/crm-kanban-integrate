// The Dashboard's figures, worked out exactly as the TrussCENTER phone app's home screen does
// (src/screens/CRMDashboardScreen.tsx there), so the two apps show the same numbers:
//  - Pipeline Value   — quotes not yet signed (draft, sent, viewed), at their headline value
//  - Open Leads       — customers with no quote yet
//  - Jobs In Progress — signed quotes whose job is not paid off
//  - Revenue (MTD)    — payments recorded since the 1st of this month
// and one funnel across both boards: the Sales stages come from the quote's status, the
// Project stages from its job_stage.
import type { Contact, QuoteSummary } from './crmData';

export const DASHBOARD_STAGES = [
  { id: 'discovery', label: 'Discovery' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'sent', label: 'Awaiting' },
  { id: 'sold', label: 'Sold' },
  { id: 'in_progress', label: 'Active Build' },
  { id: 'completed', label: 'Completed' },
  { id: 'invoiced', label: 'Billing' },
  { id: 'paid', label: 'Closed/Paid' },
] as const;

export type DashboardStageId = (typeof DASHBOARD_STAGES)[number]['id'];

type QuoteForMetrics = Pick<
  QuoteSummary,
  'id' | 'contactId' | 'quoteNumber' | 'status' | 'goodTotal' | 'betterTotal' | 'bestTotal' | 'selectedTier'
  | 'includeBetter' | 'includeBest' | 'createdAt' | 'updatedAt' | 'jobStage' | 'projectDescription'
  | 'useManualTotals' | 'manualGoodTotal' | 'manualBetterTotal' | 'manualBestTotal'
>;

const tierTotal = (q: QuoteForMetrics, tier: 'good' | 'better' | 'best'): number => {
  const calculated = tier === 'good' ? q.goodTotal : tier === 'better' ? q.betterTotal : q.bestTotal;
  if (!q.useManualTotals) return calculated || 0;
  const manual = tier === 'good' ? q.manualGoodTotal : tier === 'better' ? q.manualBetterTotal : q.manualBestTotal;
  return manual ?? calculated ?? 0;
};

/** Headline value of a quote: the highest tier the customer is shown. */
export function quoteOpenValue(q: QuoteForMetrics): number {
  if (q.includeBest) return tierTotal(q, 'best');
  if (q.includeBetter) return tierTotal(q, 'better');
  return tierTotal(q, 'good');
}

/** Contract value once signed: the tier the customer chose. */
export function quoteContractValue(q: QuoteForMetrics): number {
  const tier = (q.selectedTier || '').toLowerCase();
  if (tier === 'good' || tier === 'better' || tier === 'best') return tierTotal(q, tier);
  return quoteOpenValue(q);
}

export function quoteStage(q: Pick<QuoteSummary, 'status' | 'jobStage'>): DashboardStageId | null {
  if (q.status === 'signed') {
    switch (q.jobStage) {
      case 'in_progress': return 'in_progress';
      case 'completed': return 'completed';
      case 'invoiced': return 'invoiced';
      case 'paid': return 'paid';
      default: return 'sold';
    }
  }
  if (q.status === 'draft') return 'quoted';
  if (q.status === 'sent' || q.status === 'viewed') return 'sent';
  return null; // declined / expired sit outside the funnel
}

export interface DashboardActivity {
  key: string;
  kind: 'quote' | 'lead';
  /** The customer the row opens. */
  customerId: string | null;
  name: string;
  meta: string;
  value: number | null;
  at: string;
}

export interface DashboardMetrics {
  pipelineValue: number;
  openLeads: number;
  jobsInProgress: number;
  revenueMTD: number;
  stageCounts: Record<DashboardStageId, number>;
  recent: DashboardActivity[];
}

export function computeDashboardMetrics(
  quotes: QuoteForMetrics[],
  contacts: Pick<Contact, 'id' | 'firstName' | 'lastName' | 'city' | 'createdAt'>[],
  payments: { amount: number; created_at: string }[],
  now: Date = new Date(),
  recentLimit = 5,
): DashboardMetrics {
  const customersWithQuotes = new Set(quotes.map((q) => q.contactId).filter(Boolean));
  const leads = contacts.filter((c) => !customersWithQuotes.has(c.id));
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  const stageCounts = Object.fromEntries(DASHBOARD_STAGES.map((s) => [s.id, 0])) as Record<DashboardStageId, number>;
  stageCounts.discovery = leads.length;
  for (const q of quotes) {
    const stage = quoteStage(q);
    if (stage) stageCounts[stage] += 1;
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const revenueMTD = payments
    .filter((p) => new Date(p.created_at) >= monthStart)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const fullName = (c: { firstName?: string; lastName?: string } | undefined) =>
    c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '';

  const fromQuotes: DashboardActivity[] = quotes.map((q) => {
    const stage = quoteStage(q);
    return {
      key: `q:${q.id}`,
      kind: 'quote',
      customerId: q.contactId,
      name: fullName(q.contactId ? contactById.get(q.contactId) : undefined) || q.quoteNumber,
      meta: [DASHBOARD_STAGES.find((s) => s.id === stage)?.label ?? q.status, q.projectDescription || null]
        .filter(Boolean)
        .join(' · '),
      value: q.status === 'signed' ? quoteContractValue(q) : quoteOpenValue(q),
      at: q.updatedAt || q.createdAt,
    };
  });
  const fromLeads: DashboardActivity[] = leads.map((c) => ({
    key: `c:${c.id}`,
    kind: 'lead',
    customerId: c.id,
    name: fullName(c),
    meta: c.city ? `New lead · ${c.city}` : 'New lead',
    value: null,
    at: c.createdAt,
  }));

  return {
    pipelineValue: quotes
      .filter((q) => ['draft', 'sent', 'viewed'].includes(q.status))
      .reduce((sum, q) => sum + quoteOpenValue(q), 0),
    openLeads: leads.length,
    jobsInProgress: quotes.filter((q) => q.status === 'signed' && (q.jobStage ?? 'scheduled') !== 'paid').length,
    revenueMTD,
    stageCounts,
    recent: [...fromQuotes, ...fromLeads]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, recentLimit),
  };
}
