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
  const data: SalesData = {
    appointments: [
      { assignedTo: 'rep1', status: 'completed', startTime: at(2025, 10, 14), createdAt: at(2025, 10, 10) },
      { assignedTo: 'rep1', status: 'scheduled', startTime: at(2025, 10, 20), createdAt: at(2025, 10, 14) },
      { assignedTo: 'rep2', status: 'completed', startTime: at(2025, 10, 15), createdAt: at(2025, 10, 15) },
    ],
    signedQuotes: [
      { id: 'q1', customerId: 'c1', createdBy: 'rep1', signedAt: at(2025, 10, 14), value: 12000 },
      // A second signed quote for the same customer is one deal, both values count.
      { id: 'q2', customerId: 'c1', createdBy: 'rep1', signedAt: at(2025, 10, 15), value: 3000 },
      // No customer rep: counts for whoever wrote the quote.
      { id: 'q3', customerId: 'c3', createdBy: 'rep2', signedAt: at(2025, 10, 16), value: 8000 },
      { id: 'q4', customerId: 'c1', createdBy: 'rep1', signedAt: at(2025, 9, 30), value: 999 },
    ],
    customers: [
      { id: 'c1', assignedTo: 'rep1', status: 'signed', statusChangedAt: at(2025, 10, 14) },
      { id: 'c2', assignedTo: 'rep2', status: 'lost', statusChangedAt: at(2025, 10, 16) },
      { id: 'c3', assignedTo: null, status: 'signed', statusChangedAt: at(2025, 10, 16) },
    ],
    payments: [
      { customerId: 'c1', amount: 5000, paidAt: at(2025, 10, 15) },
      { customerId: 'c1', amount: 100, paidAt: at(2025, 10, 1) },
    ],
  };

  it('whole team, this week', () => {
    const m = computeMetrics(data, rangeForPreset('week', NOW), null);
    expect(m).toMatchObject({
      appointmentsSet: 2,
      appointmentsRan: 2,
      sold: 2,
      lost: 1,
      revenueSold: 23000,
      revenueCollected: 5000,
    });
    expect(m.closeRate).toBe(1);
    expect(m.avgDeal).toBe(11500);
  });

  it('one rep', () => {
    const m = computeMetrics(data, rangeForPreset('week', NOW), 'rep1');
    expect(m).toMatchObject({ appointmentsSet: 1, appointmentsRan: 1, sold: 1, lost: 0, revenueSold: 15000, revenueCollected: 5000 });
    const rep2 = computeMetrics(data, rangeForPreset('week', NOW), 'rep2');
    expect(rep2).toMatchObject({ sold: 1, revenueSold: 8000, lost: 1, revenueCollected: 0 });
  });

  it('no appointments ran means no close rate', () => {
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
