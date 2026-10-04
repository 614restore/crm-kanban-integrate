// Sales performance figures for the Financial Overview: appointments set and
// ran, deals sold and lost, revenue sold and collected, for any period, per
// rep or for the whole team, measured against the goals managers set.

export type PeriodPreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type GoalMetric = 'appointments_set' | 'appointments_ran' | 'sold' | 'revenue_sold' | 'revenue_collected';

export const GOAL_PERIODS: GoalPeriod[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
export const GOAL_METRICS: GoalMetric[] = ['appointments_set', 'appointments_ran', 'sold', 'revenue_sold', 'revenue_collected'];

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  appointments_set: 'Appointments Set',
  appointments_ran: 'Appointments Ran',
  sold: 'Deals Sold',
  revenue_sold: 'Sold Revenue',
  revenue_collected: 'Collected Revenue',
};

/** The goal period that matches each period choice. */
export const PRESET_GOAL_PERIOD: Record<PeriodPreset, GoalPeriod | null> = {
  today: 'daily',
  week: 'weekly',
  month: 'monthly',
  quarter: 'quarterly',
  year: 'yearly',
  custom: null,
};

/** Average length of each goal period, for scaling a goal to another period. */
const PERIOD_DAYS: Record<GoalPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 365.25 / 12,
  quarterly: 365.25 / 4,
  yearly: 365.25,
};

/** A time range; `to` is exclusive. */
export interface DateRange {
  from: Date;
  to: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** The range for a period choice, in local time. Weeks start on Monday. */
export function rangeForPreset(preset: PeriodPreset, now: Date = new Date(), custom?: DateRange): DateRange {
  const today = startOfDay(now);
  switch (preset) {
    case 'today':
      return { from: today, to: addDays(today, 1) };
    case 'week': {
      const monday = addDays(today, -((today.getDay() + 6) % 7));
      return { from: monday, to: addDays(monday, 7) };
    }
    case 'month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
    case 'quarter': {
      const q = Math.floor(today.getMonth() / 3) * 3;
      return { from: new Date(today.getFullYear(), q, 1), to: new Date(today.getFullYear(), q + 3, 1) };
    }
    case 'year':
      return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear() + 1, 0, 1) };
    case 'custom':
      return custom ?? { from: today, to: addDays(today, 1) };
  }
}

/** The period just before, to compare against: last week, last month, or a custom range of the same length. */
export function previousRange(preset: PeriodPreset, range: DateRange): DateRange {
  const { from } = range;
  switch (preset) {
    case 'today':
      return { from: addDays(from, -1), to: from };
    case 'week':
      return { from: addDays(from, -7), to: from };
    case 'month':
      return { from: new Date(from.getFullYear(), from.getMonth() - 1, 1), to: from };
    case 'quarter':
      return { from: new Date(from.getFullYear(), from.getMonth() - 3, 1), to: from };
    case 'year':
      return { from: new Date(from.getFullYear() - 1, 0, 1), to: from };
    case 'custom': {
      const days = Math.max(1, Math.round((range.to.getTime() - from.getTime()) / DAY_MS));
      return { from: addDays(from, -days), to: from };
    }
  }
}

export function rangeDays(range: DateRange) {
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS));
}

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface ApptRow {
  assignedTo: string | null;
  status: string | null;
  startTime: string | null;
  createdAt: string | null;
}

export interface SignedQuoteRow {
  id: string;
  customerId: string | null;
  createdBy: string | null;
  signedAt: string;
  value: number;
}

export interface CustomerRow {
  id: string;
  assignedTo: string | null;
  status: string | null;
  statusChangedAt: string | null;
}

export interface PaymentRow {
  customerId: string | null;
  amount: number;
  paidAt: string | null;
}

export interface SalesData {
  appointments: ApptRow[];
  signedQuotes: SignedQuoteRow[];
  customers: CustomerRow[];
  payments: PaymentRow[];
}

export interface SalesMetrics {
  appointmentsSet: number;
  appointmentsRan: number;
  sold: number;
  lost: number;
  revenueSold: number;
  revenueCollected: number;
  /** Deals sold for every appointment ran, or null with no appointments ran. */
  closeRate: number | null;
  /** Average sold revenue per deal, or null with no deals. */
  avgDeal: number | null;
}

const LOST = new Set(['lost', 'declined']);
const RAN = new Set(['completed']);

function inRange(iso: string | null | undefined, range: DateRange) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.from.getTime() && t < range.to.getTime();
}

/**
 * The figures for one range, for one rep (`repId`) or the whole team (null).
 *  - Appointments set: booked during the range (by when they were created).
 *  - Appointments ran: on the calendar during the range and marked completed.
 *  - Sold: customers with a quote signed during the range; sold revenue is
 *    what those quotes are worth.
 *  - Lost: customers moved to Lost/Declined during the range.
 *  - Collected: payments received during the range.
 * Deals, losses and payments count for the customer's assigned rep (a signed
 * quote with no assigned rep counts for whoever wrote the quote).
 */
export function computeMetrics(data: SalesData, range: DateRange, repId: string | null): SalesMetrics {
  const repOf = new Map(data.customers.map((c) => [c.id, c.assignedTo]));
  const forRep = (id: string | null | undefined) => repId === null || id === repId;

  const appts = data.appointments.filter((a) => forRep(a.assignedTo));
  const appointmentsSet = appts.filter((a) => inRange(a.createdAt, range)).length;
  const appointmentsRan = appts.filter((a) => RAN.has((a.status || '').toLowerCase()) && inRange(a.startTime, range)).length;

  const signed = data.signedQuotes.filter(
    (q) => inRange(q.signedAt, range) && forRep((q.customerId && repOf.get(q.customerId)) || q.createdBy),
  );
  const sold = new Set(signed.map((q) => q.customerId || q.id)).size;
  const revenueSold = signed.reduce((sum, q) => sum + q.value, 0);

  const lost = data.customers.filter(
    (c) => LOST.has((c.status || '').toLowerCase()) && inRange(c.statusChangedAt, range) && forRep(c.assignedTo),
  ).length;

  const revenueCollected = data.payments
    .filter((p) => inRange(p.paidAt, range) && forRep(p.customerId ? repOf.get(p.customerId) : null))
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    appointmentsSet,
    appointmentsRan,
    sold,
    lost,
    revenueSold,
    revenueCollected,
    closeRate: appointmentsRan > 0 ? sold / appointmentsRan : null,
    avgDeal: sold > 0 ? revenueSold / sold : null,
  };
}

export function metricValue(m: SalesMetrics, metric: GoalMetric): number {
  switch (metric) {
    case 'appointments_set': return m.appointmentsSet;
    case 'appointments_ran': return m.appointmentsRan;
    case 'sold': return m.sold;
    case 'revenue_sold': return m.revenueSold;
    case 'revenue_collected': return m.revenueCollected;
  }
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export interface SalesGoal {
  id: string;
  memberId: string | null;
  period: GoalPeriod;
  metric: GoalMetric;
  target: number;
}

export interface GoalTarget {
  target: number;
  /** The goal period it came from. */
  from: GoalPeriod;
  /** True when scaled from a goal for a different period length. */
  scaled: boolean;
}

/** Which goal periods to fall back on, best first, when none matches exactly. */
const FALLBACK_ORDER: GoalPeriod[] = ['monthly', 'weekly', 'quarterly', 'yearly', 'daily'];

function memberTarget(goals: SalesGoal[], metric: GoalMetric, memberId: string | null, want: GoalPeriod | null, days: number): GoalTarget | null {
  const mine = goals.filter((g) => g.metric === metric && g.memberId === memberId);
  if (want) {
    const exact = mine.find((g) => g.period === want);
    if (exact) return { target: exact.target, from: exact.period, scaled: false };
  }
  for (const period of FALLBACK_ORDER) {
    const g = mine.find((x) => x.period === period);
    if (g) return { target: (g.target * days) / PERIOD_DAYS[period], from: period, scaled: true };
  }
  return null;
}

/**
 * The goal for a metric over the shown range. A goal for the same period
 * (e.g. a weekly goal while viewing This Week) is used as is; otherwise a goal
 * for another period is scaled to the range's length (a monthly goal of 20
 * shows as about 4.6 for a week). The whole team uses the company goal, or
 * the reps' goals added up when there is no company goal.
 */
export function goalFor(
  goals: SalesGoal[],
  metric: GoalMetric,
  repId: string | null,
  preset: PeriodPreset,
  range: DateRange,
): GoalTarget | null {
  const want = PRESET_GOAL_PERIOD[preset];
  const days = rangeDays(range);
  const own = memberTarget(goals, metric, repId, want, days);
  if (own || repId !== null) return own;

  const reps = [...new Set(goals.filter((g) => g.metric === metric && g.memberId).map((g) => g.memberId))];
  const parts = reps.map((id) => memberTarget(goals, metric, id, want, days)).filter((t): t is GoalTarget => !!t);
  if (!parts.length) return null;
  return {
    target: parts.reduce((sum, t) => sum + t.target, 0),
    from: parts[0].from,
    scaled: parts.some((t) => t.scaled),
  };
}
