import { describe, it, expect } from 'vitest';
import { computeDashboardMetrics, quoteOpenValue, quoteContractValue, quoteStage } from '@/lib/dashboardMetrics';

const quote = (o: Record<string, unknown>) => ({
  id: 'q', contactId: null, quoteNumber: 'QT-1', status: 'draft', goodTotal: 0, betterTotal: 0, bestTotal: 0,
  selectedTier: null, includeBetter: false, includeBest: false, createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z', jobStage: null, projectDescription: null, useManualTotals: false,
  manualGoodTotal: null, manualBetterTotal: null, manualBestTotal: null, ...o,
}) as any;

const contact = (id: string, firstName: string, lastName: string, createdAt = '2026-10-01T12:00:00Z') =>
  ({ id, firstName, lastName, city: '', createdAt }) as any;

describe('computeDashboardMetrics (same figures as the phone home screen)', () => {
  // The 614 Restore LLC data on 31 Oct 2026, whose phone screen showed Jobs In Progress 2,
  // Revenue (MTD) $1k and the five activity rows below.
  const contacts = [contact('patty', 'Patty', 'Streibig'), contact('marie', 'Marie', 'Hardin'), contact('nick', 'Nickila', 'Mathur')];
  const quotes = [
    quote({ id: 'q1', contactId: 'marie', status: 'signed', selectedTier: 'good', useManualTotals: true, goodTotal: 2575, manualGoodTotal: 2575, updatedAt: '2026-10-29T10:00:00Z' }),
    quote({ id: 'q2', contactId: 'patty', status: 'sent', goodTotal: 525, betterTotal: 1107.5, bestTotal: 1257.5, projectDescription: 'General repair scope', updatedAt: '2026-10-29T09:00:00Z' }),
    quote({ id: 'q3', contactId: 'patty', status: 'draft', includeBetter: true, includeBest: true, updatedAt: '2026-10-24T09:00:00Z' }),
    quote({ id: 'q4', contactId: 'nick', status: 'signed', jobStage: 'scheduled', includeBetter: true, includeBest: true, updatedAt: '2026-10-22T09:00:00Z' }),
    quote({ id: 'q5', contactId: 'patty', status: 'draft', includeBetter: true, includeBest: true, updatedAt: '2026-10-01T09:00:00Z' }),
  ];
  const payments = [
    { amount: 1250, created_at: '2026-10-21T15:00:00Z' },
    { amount: 999, created_at: '2026-09-30T15:00:00Z' }, // last month: not MTD
  ];
  const m = computeDashboardMetrics(quotes, contacts, payments, new Date('2026-10-31T12:00:00'));

  it('works out the four cards', () => {
    expect(m.pipelineValue).toBe(525);
    expect(m.openLeads).toBe(0);
    expect(m.jobsInProgress).toBe(2);
    expect(m.revenueMTD).toBe(1250);
  });

  it('lists recent activity like the phone, newest first', () => {
    expect(m.recent.map((r) => [r.name, r.meta, r.value])).toEqual([
      ['Marie Hardin', 'Sold', 2575],
      ['Patty Streibig', 'Awaiting · General repair scope', 525],
      ['Patty Streibig', 'Quoted', 0],
      ['Nickila Mathur', 'Sold', 0],
      ['Patty Streibig', 'Quoted', 0],
    ]);
  });

  it('counts the funnel across both boards', () => {
    expect(m.stageCounts).toMatchObject({ discovery: 0, quoted: 2, sent: 1, sold: 2 });
  });

  it('counts a customer with no quote as an open lead and lists them', () => {
    const r = computeDashboardMetrics([], [contact('new', 'Ann', 'Lee', '2026-10-30T09:00:00Z')], []);
    expect(r.openLeads).toBe(1);
    expect(r.stageCounts.discovery).toBe(1);
    expect(r.recent[0]).toMatchObject({ kind: 'lead', name: 'Ann Lee', meta: 'New lead', value: null });
  });
});

describe('Recent Activity leaves out closed-out jobs', () => {
  const people = [
    { ...contact('open', 'Olive', 'Open'), status: 'signed' },
    { ...contact('done', 'Paul', 'Paid'), status: 'paid' },
    { ...contact('fin', 'Fay', 'Finished'), status: 'completed' },
  ];
  const quotes = [
    quote({ id: 'a', contactId: 'open', status: 'signed', jobStage: 'paid', updatedAt: '2026-10-30T09:00:00Z' }),
    quote({ id: 'b', contactId: 'open', status: 'sent', goodTotal: 900, updatedAt: '2026-10-29T09:00:00Z' }),
    quote({ id: 'c', contactId: 'done', status: 'signed', jobStage: 'completed', updatedAt: '2026-10-28T09:00:00Z' }),
    quote({ id: 'd', contactId: 'fin', status: 'signed', jobStage: 'completed', updatedAt: '2026-10-27T09:00:00Z' }),
  ];
  const m = computeDashboardMetrics(quotes, people, []);

  it('drops a job that is Closed/Paid, and every job of a customer marked Paid', () => {
    expect(m.recent.map((r) => r.key)).toEqual(['q:b', 'q:d']);
  });

  it('keeps a Completed job (money may still be owed) and still counts closed jobs in the funnel', () => {
    expect(m.recent.find((r) => r.key === 'q:d')?.meta).toBe('Completed');
    expect(m.stageCounts.paid).toBe(1);
  });

  it('drops a closed-out customer with no quote from the leads in the list', () => {
    const r = computeDashboardMetrics([], [{ ...contact('x', 'Pam', 'Paid'), status: 'paid' }], []);
    expect(r.recent).toEqual([]);
  });
});

describe('quote values', () => {
  it('an open quote is worth its highest offered tier, using hand-entered totals when on', () => {
    expect(quoteOpenValue(quote({ goodTotal: 1, betterTotal: 2, bestTotal: 3, includeBetter: true, includeBest: true }))).toBe(3);
    expect(quoteOpenValue(quote({ goodTotal: 1, betterTotal: 2, includeBetter: true }))).toBe(2);
    expect(quoteOpenValue(quote({ goodTotal: 1, useManualTotals: true, manualGoodTotal: 5 }))).toBe(5);
  });

  it('a signed quote is worth the tier the customer chose', () => {
    expect(quoteContractValue(quote({ status: 'signed', selectedTier: 'better', goodTotal: 1, betterTotal: 2, bestTotal: 3, includeBest: true }))).toBe(2);
  });

  it('a paid job leaves Jobs In Progress; declined quotes sit outside the funnel', () => {
    expect(quoteStage({ status: 'signed', jobStage: 'paid' })).toBe('paid');
    expect(quoteStage({ status: 'declined', jobStage: null })).toBeNull();
    const m = computeDashboardMetrics([quote({ status: 'signed', jobStage: 'paid', contactId: 'x' })], [], []);
    expect(m.jobsInProgress).toBe(0);
  });
});
