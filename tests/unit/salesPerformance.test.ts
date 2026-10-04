import { describe, it, expect } from 'vitest';
import {
  rangeForPreset,
  previousRange,
  computeMetrics,
  goalFor,
  type SalesData,
  type SalesGoal,
} from '@/lib/salesPerformance';

// Wednesday 15 Oct 2025, mid-morning local time.
const NOW = new Date(2025, 9, 15, 10, 30);
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe('periods', () => {
  it('weeks run Monday to Monday', () => {
    const r = rangeForPreset('week', NOW);
    expect(r.from).toEqual(new Date(2025, 9, 13));
    expect(r.to).toEqual(new Date(2025, 9, 20));
    expect(previousRange('week', r).from).toEqual(new Date(2025, 9, 6));
  });

  it('a Sunday belongs to the week that started the Monday before', () => {
    const r = rangeForPreset('week', new Date(2025, 9, 19, 9));
    expect(r.from).toEqual(new Date(2025, 9, 13));
  });

  it('month, quarter and year', () => {
    expect(rangeForPreset('month', NOW)).toEqual({ from: new Date(2025, 9, 1), to: new Date(2025, 10, 1) });
    expect(rangeForPreset('quarter', NOW)).toEqual({ from: new Date(2025, 9, 1), to: new Date(2026, 0, 1) });
    expect(previousRange('quarter', rangeForPreset('quarter', NOW)).from).toEqual(new Date(2025, 6, 1));
    expect(rangeForPreset('year', NOW).from).toEqual(new Date(2025, 0, 1));
  });

  it('a custom range compares with the same number of days before it', () => {
    const custom = { from: new Date(2025, 9, 1), to: new Date(2025, 9, 11) };
    expect(previousRange('custom', custom)).toEqual({ from: new Date(2025, 8, 21), to: new Date(2025, 9, 1) });
  });
});

describe('computeMetrics', () => {
  const quote = (id: string, customerId: string | null, createdBy: string, signedAt: string | null, contingencySignedAt: string | null, value: number) =>
    ({ id, customerId, createdBy, signedAt, contingencySignedAt, value });
  const customer = (id: string, assignedTo: string | null, status: string, extra: Partial<SalesData['customers'][number]> = {}) =>
    ({ id, assignedTo, status, statusChangedAt: null, inspectionCompletedAt: null, inspectionCompletedBy: null, ...extra });

  const data: SalesData = {
    appointments: [
      { customerId: 'c1', assignedTo: 'rep1', status: 'completed', startTime: at(2025, 10, 14), createdAt: at(2025, 10, 10) },
      { customerId: 'c5', assignedTo: 'rep1', status: 'scheduled', startTime: at(2025, 10, 20), createdAt: at(2025, 10, 14) },
      { customerId: 'c3', assignedTo: 'rep2', status: 'completed', startTime: at(2025, 10, 15), createdAt: at(2025, 10, 15) },
    ],
    signedQuotes: [
      // Retail: the quote signed this week.
      quote('q1', 'c1', 'rep1', at(2025, 10, 14), null, 12000),
      // A second signed quote for the same customer: one sale, both values count.
      quote('q2', 'c1', 'rep1', at(2025, 10, 15), null, 3000),
      // Insurance: contingency signed this week, full quote not signed yet.
      quote('q3', 'c3', 'rep2', null, at(2025, 10, 16), 0),
      // Insurance: contingency signed last month, full quote signed this week.
      // Its revenue counts this week, but the sale was last month.
      quote('q4', 'c4', 'rep1', at(2025, 10, 15), at(2025, 9, 20), 20000),
    ],
    customers: [
      customer('c1', 'rep1', 'signed'),
      customer('c2', 'rep2', 'lost', { statusChangedAt: at(2025, 10, 16) }),
      // Ran twice this week (appointment + inspection): counts once.
      customer('c3', null, 'contingency', { inspectionCompletedAt: at(2025, 10, 15), inspectionCompletedBy: 'rep2' }),
      customer('c4', 'rep1', 'signed'),
      // Inspection with no appointment: counts for whoever completed it.
      customer('c6', 'rep1', 'inspection_completed', { inspectionCompletedAt: at(2025, 10, 17), inspectionCompletedBy: 'rep2' }),
    ],
    payments: [
      { customerId: 'c1', amount: 5000, paidAt: at(2025, 10, 15) },
      { customerId: 'c1', amount: 100, paidAt: at(2025, 10, 1) },
    ],
  };
  const week = rangeForPreset('week', NOW);

  it('whole team, this week', () => {
    const m = computeMetrics(data, week, null);
    expect(m).toMatchObject({
      appointmentsSet: 2,
      appointmentsRan: 3, // c1 appointment, c3 (appointment + inspection), c6 inspection
      sold: 2, // c1 retail, c3 contingency (c4 sold last month)
      lost: 1,
      revenueSold: 35000,
      revenueCollected: 5000,
    });
    expect(m.closeRate).toBeCloseTo(2 / 3);
    expect(m.avgDeal).toBeCloseTo(35000 / 3);
  });

  it('a contingency counts as the sale, in the period it was signed', () => {
    const lastMonth = rangeForPreset('month', new Date(2025, 8, 10));
    expect(computeMetrics(data, lastMonth, null)).toMatchObject({ sold: 1, revenueSold: 0 });
  });

  it('one rep', () => {
    expect(computeMetrics(data, week, 'rep1')).toMatchObject({
      appointmentsSet: 1, appointmentsRan: 1, sold: 1, lost: 0, revenueSold: 35000, revenueCollected: 5000,
    });
    expect(computeMetrics(data, week, 'rep2')).toMatchObject({
      appointmentsRan: 2, sold: 1, revenueSold: 0, lost: 1, revenueCollected: 0,
    });
  });

  it('nothing ran means no conversion rate', () => {
    const m = computeMetrics(data, rangeForPreset('today', new Date(2025, 0, 1)), null);
    expect(m.closeRate).toBeNull();
    expect(m.avgDeal).toBeNull();
  });
});

describe('goalFor', () => {
  const goals: SalesGoal[] = [
    { id: '1', memberId: null, period: 'weekly', metric: 'sold', target: 5 },
    { id: '2', memberId: null, period: 'monthly', metric: 'revenue_sold', target: 100000 },
    { id: '3', memberId: 'rep1', period: 'monthly', metric: 'appointments_set', target: 20 },
    { id: '4', memberId: 'rep2', period: 'monthly', metric: 'appointments_set', target: 10 },
  ];
  const week = rangeForPreset('week', NOW);

  it('uses the goal for the same period as is', () => {
    expect(goalFor(goals, 'sold', null, 'week', week)).toEqual({ target: 5, from: 'weekly', scaled: false });
  });

  it('scales a goal for another period to the range', () => {
    const g = goalFor(goals, 'revenue_sold', null, 'week', week)!;
    expect(g.scaled).toBe(true);
    expect(g.target).toBeCloseTo((100000 * 7 * 12) / 365.25, 5);
  });

  it('adds up rep goals when there is no company goal', () => {
    const month = rangeForPreset('month', NOW);
    expect(goalFor(goals, 'appointments_set', null, 'month', month)).toEqual({ target: 30, from: 'monthly', scaled: false });
    expect(goalFor(goals, 'appointments_set', 'rep2', 'month', month)?.target).toBe(10);
  });

  it('a rep without a goal has none (the company goal is not split up)', () => {
    expect(goalFor(goals, 'sold', 'rep1', 'week', week)).toBeNull();
  });
});
