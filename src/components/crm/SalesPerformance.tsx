import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarCheck,
  CalendarPlus,
  Trophy,
  XCircle,
  DollarSign,
  Wallet,
  Percent,
  Receipt,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { formatCurrency, quoteValue, toQuoteSummary } from '@/lib/crmData';
import {
  GOAL_METRICS,
  GOAL_METRIC_LABELS,
  GOAL_PERIODS,
  GOAL_PERIOD_LABELS,
  PRESET_GOAL_PERIOD,
  computeMetrics,
  goalFor,
  metricValue,
  previousRange,
  rangeForPreset,
  type DateRange,
  type GoalMetric,
  type GoalPeriod,
  type PeriodPreset,
  type SalesData,
  type SalesGoal,
  type SalesMetrics,
} from '@/lib/salesPerformance';

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom' },
];

const PREVIOUS_LABEL: Record<PeriodPreset, string> = {
  today: 'yesterday',
  week: 'last week',
  month: 'last month',
  quarter: 'last quarter',
  year: 'last year',
  custom: 'previous period',
};

// Same roles the database lets set goals (is_manager_role).
const GOAL_MANAGER_ROLES = ['owner', 'admin', 'manager', 'sales_manager', 'production_manager'];
const MONEY_METRICS = new Set<GoalMetric>(['revenue_sold', 'revenue_collected']);

const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromInputDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const shortDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const EMPTY: SalesData = { appointments: [], signedQuotes: [], customers: [], payments: [] };

async function loadSalesData(companyId: string, window: DateRange): Promise<SalesData> {
  const from = window.from.toISOString();
  const to = window.to.toISOString();
  const [appts, quotes, customers, payments] = await Promise.all([
    supabase
      .from('appointments')
      .select('assigned_to, status, start_time, created_at')
      .eq('company_id', companyId)
      .or(`and(created_at.gte.${from},created_at.lt.${to}),and(start_time.gte.${from},start_time.lt.${to})`),
    supabase
      .from('quotes')
      .select('id, customer_id, contact_id, created_by, signed_at, status, selected_tier, good_total, better_total, best_total, include_better, include_best, quote_number, cover_page_title, created_at, is_archived')
      .eq('company_id', companyId)
      .gte('signed_at', from)
      .lt('signed_at', to),
    supabase
      .from('customers')
      .select('id, assigned_to, status, status_changed_at')
      .eq('company_id', companyId),
    supabase
      .from('payments')
      .select('customer_id, contact_id, amount, payment_date, created_at')
      .eq('company_id', companyId)
      .or(`and(payment_date.gte.${from},payment_date.lt.${to}),and(payment_date.is.null,created_at.gte.${from},created_at.lt.${to})`),
  ]);
  const failed = [appts, quotes, customers, payments].find((r) => r.error);
  if (failed?.error) throw failed.error;

  return {
    appointments: (appts.data ?? []).map((a: any) => ({
      assignedTo: a.assigned_to,
      status: a.status,
      startTime: a.start_time,
      createdAt: a.created_at,
    })),
    signedQuotes: (quotes.data ?? [])
      .filter((q: any) => !q.is_archived)
      .map((q: any) => ({
        id: q.id,
        customerId: q.customer_id ?? q.contact_id ?? null,
        createdBy: q.created_by,
        signedAt: q.signed_at,
        // It was signed in this period, so it is worth the tier chosen even if its status moved on since.
        value: quoteValue({ ...toQuoteSummary(q), status: 'signed' }),
      })),
    customers: (customers.data ?? []).map((c: any) => ({
      id: c.id,
      assignedTo: c.assigned_to,
      status: c.status,
      statusChangedAt: c.status_changed_at,
    })),
    payments: (payments.data ?? []).map((p: any) => ({
      customerId: p.customer_id ?? p.contact_id ?? null,
      amount: Number(p.amount ?? 0),
      paidAt: p.payment_date ?? p.created_at,
    })),
  };
}

function Delta({ now, before, money }: { now: number; before: number; money?: boolean }) {
  const diff = now - before;
  if (diff === 0) return <span className="text-xs text-gray-400">No change</span>;
  const up = diff > 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      <Arrow size={14} />
      {money ? formatCurrency(Math.abs(diff)) : Math.abs(diff)}
    </span>
  );
}

function GoalBar({ value, target, money, scaledFrom }: { value: number; target: number; money?: boolean; scaledFrom?: GoalPeriod }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 100;
  const done = value >= target;
  const shown = money ? formatCurrency(Math.round(target)) : Number.isInteger(target) ? target : target.toFixed(1);
  return (
    <div className="mt-2" title={scaledFrom ? `Scaled from the ${GOAL_PERIOD_LABELS[scaledFrom].toLowerCase()} goal` : undefined}>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${done ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {Math.round((target > 0 ? value / target : 1) * 100)}% of {shown} goal
        {scaledFrom ? ` (from ${GOAL_PERIOD_LABELS[scaledFrom].toLowerCase()})` : ''}
      </p>
    </div>
  );
}

interface CardSpec {
  key: string;
  label: string;
  icon: React.ElementType;
  tint: string;
  value: (m: SalesMetrics) => number | null;
  format: (n: number) => string;
  goal?: GoalMetric;
  money?: boolean;
  hint: string;
}

const count = (n: number) => String(n);
const CARDS: CardSpec[] = [
  { key: 'set', label: 'Appointments Set', icon: CalendarPlus, tint: 'bg-indigo-50 text-indigo-600', value: (m) => m.appointmentsSet, format: count, goal: 'appointments_set', hint: 'Appointments booked (assigned and scheduled) in this period' },
  { key: 'ran', label: 'Appointments Ran', icon: CalendarCheck, tint: 'bg-violet-50 text-violet-600', value: (m) => m.appointmentsRan, format: count, goal: 'appointments_ran', hint: 'Appointments in this period marked completed' },
  { key: 'sold', label: 'Sold / Closed', icon: Trophy, tint: 'bg-green-50 text-green-600', value: (m) => m.sold, format: count, goal: 'sold', hint: 'Customers who signed a quote in this period' },
  { key: 'lost', label: 'Lost', icon: XCircle, tint: 'bg-red-50 text-red-600', value: (m) => m.lost, format: count, hint: 'Customers moved to Lost or Declined in this period' },
  { key: 'revSold', label: 'Sold Revenue', icon: DollarSign, tint: 'bg-emerald-50 text-emerald-600', value: (m) => m.revenueSold, format: (n) => formatCurrency(n), goal: 'revenue_sold', money: true, hint: 'Value of the quotes signed in this period' },
  { key: 'revCollected', label: 'Collected Revenue', icon: Wallet, tint: 'bg-teal-50 text-teal-600', value: (m) => m.revenueCollected, format: (n) => formatCurrency(n), goal: 'revenue_collected', money: true, hint: 'Payments received in this period' },
  { key: 'close', label: 'Close Rate', icon: Percent, tint: 'bg-amber-50 text-amber-600', value: (m) => (m.closeRate === null ? null : m.closeRate * 100), format: (n) => `${Math.round(n)}%`, hint: 'Deals sold for every appointment ran' },
  { key: 'avg', label: 'Average Deal', icon: Receipt, tint: 'bg-sky-50 text-sky-600', value: (m) => m.avgDeal, format: (n) => formatCurrency(n), money: true, hint: 'Sold revenue per deal' },
];

export default function SalesPerformance() {
  const { state } = useCRM();
  const { profile } = useAuth();
  const companyId = state.companyId ?? profile?.company_id ?? null;
  // Goals link to team members (not logins), and the database checks the team member's role.
  const me = state.teamMembers.find((m) => profile?.email && m.email?.toLowerCase() === profile.email.toLowerCase());
  const role = String(me?.role || state.currentUser?.role || profile?.role || '');
  const canSetGoals = GOAL_MANAGER_ROLES.includes(role);

  const [preset, setPreset] = useState<PeriodPreset>('week');
  const [customFrom, setCustomFrom] = useState(() => toInputDate(rangeForPreset('month').from));
  const [customTo, setCustomTo] = useState(() => toInputDate(new Date()));
  const [repId, setRepId] = useState<string | null>(null);
  const [data, setData] = useState<SalesData>(EMPTY);
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const range = useMemo(() => {
    if (preset !== 'custom') return rangeForPreset(preset);
    const from = fromInputDate(customFrom);
    const lastDay = fromInputDate(customTo);
    const to = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1);
    return to > from ? { from, to } : { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1) };
  }, [preset, customFrom, customTo]);
  const prev = useMemo(() => previousRange(preset, range), [preset, range]);

  const loadGoals = useCallback(async () => {
    if (!companyId) return;
    const { data: rows, error } = await supabase
      .from('sales_goals')
      .select('id, member_id, period, metric, target')
      .eq('company_id', companyId);
    if (error) return;
    setGoals((rows ?? []).map((g: any) => ({ id: g.id, memberId: g.member_id, period: g.period, metric: g.metric, target: Number(g.target) })));
  }, [companyId]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    loadSalesData(companyId, { from: prev.from, to: range.to })
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setLoadError("Couldn't load sales figures. Reload to try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId, prev.from.getTime(), range.to.getTime()]);

  const current = useMemo(() => computeMetrics(data, range, repId), [data, range, repId]);
  const before = useMemo(() => computeMetrics(data, prev, repId), [data, prev, repId]);

  const reps = useMemo(
    () => state.teamMembers.filter((m) => m.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [state.teamMembers],
  );
  const repRows = useMemo(
    () =>
      reps
        .map((m) => ({ member: m, metrics: computeMetrics(data, range, m.id) }))
        .filter(({ member, metrics }) =>
          metrics.appointmentsSet || metrics.appointmentsRan || metrics.sold || metrics.lost || metrics.revenueSold || metrics.revenueCollected ||
          goals.some((g) => g.memberId === member.id),
        ),
    [reps, data, range, goals],
  );

  const rangeLabel =
    preset === 'today'
      ? shortDate(range.from)
      : `${shortDate(range.from)} – ${shortDate(new Date(range.to.getTime() - 1))}`;

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Sales Performance</h3>
          <p className="text-sm text-gray-500">{rangeLabel} · compared with {PREVIOUS_LABEL[preset]}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={repId ?? ''}
            onChange={(e) => setRepId(e.target.value || null)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 max-w-[11rem]"
            aria-label="Show figures for"
          >
            <option value="">Whole team</option>
            {reps.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {canSetGoals && (
            <button
              onClick={() => setGoalsOpen(true)}
              className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Target size={16} />
              Set Goals
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              preset === p.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5 text-gray-600">
            From
            <input type="date" value={customFrom} onChange={(e) => e.target.value && setCustomFrom(e.target.value)} className="h-9 rounded-lg border border-gray-200 px-2" />
          </label>
          <label className="flex items-center gap-1.5 text-gray-600">
            To
            <input type="date" value={customTo} min={customFrom} onChange={(e) => e.target.value && setCustomTo(e.target.value)} className="h-9 rounded-lg border border-gray-200 px-2" />
          </label>
        </div>
      )}

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${loading ? 'opacity-60' : ''}`}>
        {CARDS.map((card) => {
          const value = card.value(current);
          const prevValue = card.value(before);
          const goal = card.goal ? goalFor(goals, card.goal, repId, preset, range) : null;
          const Icon = card.icon;
          return (
            <div key={card.key} className="rounded-xl border border-gray-200 p-3 sm:p-4" title={card.hint}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs sm:text-sm font-medium text-gray-500 leading-tight">{card.label}</span>
                <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${card.tint}`}>
                  <Icon size={16} />
                </span>
              </div>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">
                {value === null ? '—' : card.format(value)}
              </p>
              {value !== null && prevValue !== null && card.key !== 'close' && card.key !== 'avg' ? (
                <Delta now={value} before={prevValue} money={card.money} />
              ) : (
                <span className="text-xs text-gray-400">
                  {prevValue === null ? `None ${PREVIOUS_LABEL[preset]}` : `${card.format(prevValue)} ${PREVIOUS_LABEL[preset]}`}
                </span>
              )}
              {goal && value !== null && (
                <GoalBar value={value} target={goal.target} money={card.money} scaledFrom={goal.scaled ? goal.from : undefined} />
              )}
            </div>
          );
        })}
      </div>

      {repId === null && repRows.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">By Rep</h4>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="py-2 pl-4 sm:pl-0 pr-3 font-medium">Rep</th>
                  <th className="py-2 px-2 font-medium text-right">Set</th>
                  <th className="py-2 px-2 font-medium text-right">Ran</th>
                  <th className="py-2 px-2 font-medium text-right">Sold</th>
                  <th className="py-2 px-2 font-medium text-right">Lost</th>
                  <th className="py-2 px-2 font-medium text-right">Close</th>
                  <th className="py-2 px-2 font-medium text-right">Sold $</th>
                  <th className="py-2 pl-2 pr-4 sm:pr-0 font-medium text-right">Collected $</th>
                </tr>
              </thead>
              <tbody>
                {repRows.map(({ member, metrics }) => {
                  const soldGoal = goalFor(goals, 'revenue_sold', member.id, preset, range);
                  return (
                    <tr key={member.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 pl-4 sm:pl-0 pr-3 whitespace-nowrap">
                        <button onClick={() => setRepId(member.id)} className="font-medium text-gray-900 hover:text-blue-600">
                          {member.name}
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{metrics.appointmentsSet}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{metrics.appointmentsRan}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{metrics.sold}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{metrics.lost}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{metrics.closeRate === null ? '—' : `${Math.round(metrics.closeRate * 100)}%`}</td>
                      <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                        {formatCurrency(metrics.revenueSold)}
                        {soldGoal && <span className="block text-[11px] text-gray-400">{Math.round((metrics.revenueSold / Math.max(soldGoal.target, 1)) * 100)}% of goal</span>}
                      </td>
                      <td className="py-2 pl-2 pr-4 sm:pr-0 text-right tabular-nums whitespace-nowrap">{formatCurrency(metrics.revenueCollected)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {goalsOpen && companyId && (
        <GoalsEditor
          companyId={companyId}
          goals={goals}
          reps={reps.map((m) => ({ id: m.id, name: m.name }))}
          initialMemberId={repId}
          initialPeriod={PRESET_GOAL_PERIOD[preset] ?? 'monthly'}
          createdBy={me?.id ?? null}
          onClose={() => setGoalsOpen(false)}
          onSaved={() => { loadGoals(); setGoalsOpen(false); }}
        />
      )}
    </section>
  );
}

function GoalsEditor({
  companyId,
  goals,
  reps,
  initialMemberId,
  initialPeriod,
  createdBy,
  onClose,
  onSaved,
}: {
  companyId: string;
  goals: SalesGoal[];
  reps: { id: string; name: string }[];
  initialMemberId: string | null;
  initialPeriod: GoalPeriod;
  createdBy: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [memberId, setMemberId] = useState<string | null>(initialMemberId);
  const [period, setPeriod] = useState<GoalPeriod>(initialPeriod);
  const [values, setValues] = useState<Record<GoalMetric, string>>({} as Record<GoalMetric, string>);
  const [saving, setSaving] = useState(false);

  // Show the saved goals for whoever and whichever period is picked.
  useEffect(() => {
    const next = {} as Record<GoalMetric, string>;
    for (const metric of GOAL_METRICS) {
      const g = goals.find((x) => x.memberId === memberId && x.period === period && x.metric === metric);
      next[metric] = g ? String(g.target) : '';
    }
    setValues(next);
  }, [goals, memberId, period]);

  const save = async () => {
    setSaving(true);
    try {
      for (const metric of GOAL_METRICS) {
        const existing = goals.find((x) => x.memberId === memberId && x.period === period && x.metric === metric);
        const raw = (values[metric] ?? '').replace(/[$,\s]/g, '');
        if (raw === '') {
          if (existing) {
            const { error } = await supabase.from('sales_goals').delete().eq('id', existing.id);
            if (error) throw error;
          }
          continue;
        }
        const target = Number(raw);
        if (!Number.isFinite(target) || target < 0) {
          toast.error(`${GOAL_METRIC_LABELS[metric]}: enter a number of 0 or more.`);
          return;
        }
        if (existing) {
          if (existing.target === target) continue;
          const { error } = await supabase
            .from('sales_goals')
            .update({ target, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('sales_goals')
            .insert({ company_id: companyId, member_id: memberId, period, metric, target, created_by: createdBy });
          if (error) throw error;
        }
      }
      toast.success('Goals saved');
      onSaved();
    } catch (err: any) {
      toast.error(`Couldn't save goals: ${err?.message || 'please try again'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90dvh] overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-semibold text-gray-900">Sales Goals</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 space-y-4">
          <label className="block text-sm">
            <span className="text-gray-600">Goal for</span>
            <select
              value={memberId ?? ''}
              onChange={(e) => setMemberId(e.target.value || null)}
              className="mt-1 w-full h-10 rounded-lg border border-gray-200 bg-white px-2"
            >
              <option value="">Whole company</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-sm text-gray-600">Period</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {GOAL_PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    period === p ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {GOAL_PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {GOAL_METRICS.map((metric) => (
              <label key={metric} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-700">{GOAL_METRIC_LABELS[metric]}</span>
                <div className="relative w-36">
                  {MONEY_METRICS.has(metric) && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">$</span>}
                  <input
                    inputMode="decimal"
                    value={values[metric] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [metric]: e.target.value }))}
                    placeholder="No goal"
                    className={`w-full h-10 rounded-lg border border-gray-200 pr-2 text-right tabular-nums ${MONEY_METRICS.has(metric) ? 'pl-6' : 'pl-2'}`}
                  />
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Leave a box empty for no goal. A goal shows on any period you view: a monthly goal is scaled down when you look at a week or a day. With no company goal, the team target is the reps' goals added up.
          </p>
        </div>
        <div className="flex gap-2 px-5 py-4">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 h-10 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save Goals
          </button>
        </div>
      </div>
    </div>
  );
}
