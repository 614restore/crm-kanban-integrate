import React, { useMemo, useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import {
  TrendingUp,
  DollarSign,
  Users,
  Target,
  BarChart2,
  Award,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

type Period = '7d' | '30d' | '90d' | 'all';

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  lead: 'Lead',
  appt_set: 'Appt Set',
  inspection_completed: 'Inspected',
  estimate_sent: 'Estimate Sent',
  follow_up: 'Follow Up',
  approved: 'Approved',
  material_ordered: 'Material Ordered',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  lost: 'Lost',
};

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-gray-400',
  lead: 'bg-blue-400',
  appt_set: 'bg-indigo-400',
  inspection_completed: 'bg-violet-400',
  estimate_sent: 'bg-yellow-400',
  follow_up: 'bg-orange-400',
  approved: 'bg-emerald-400',
  material_ordered: 'bg-teal-400',
  scheduled: 'bg-cyan-400',
  in_progress: 'bg-sky-400',
  completed: 'bg-green-500',
  invoiced: 'bg-lime-500',
  paid: 'bg-green-600',
  lost: 'bg-red-400',
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color = 'blue',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: number;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={18} />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend)}% vs last period
        </div>
      )}
    </div>
  );
}

function PipelineBar({ status, count, total }: { status: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = STATUS_COLORS[status] || 'bg-gray-300';
  const label = STATUS_LABELS[status] || status;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-32 text-xs text-gray-600 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-xs font-semibold text-gray-700 text-right">{count}</span>
      <span className="w-9 text-xs text-gray-400 text-right">{pct}%</span>
    </div>
  );
}

export default function SalesAnalytics() {
  const { state } = useCRM();
  const [period, setPeriod] = useState<Period>('30d');

  const periodMs: Record<Period, number> = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    all: Infinity,
  };

  const cutoff = period === 'all' ? new Date(0) : new Date(Date.now() - periodMs[period]);

  const filtered = useMemo(
    () => state.contacts.filter((c) => new Date(c.createdAt) >= cutoff),
    [state.contacts, cutoff]
  );

  const completed = filtered.filter((c) => c.status === 'completed' || c.status === 'paid');
  const lost = filtered.filter((c) => c.status === 'lost');
  const totalRevenue = completed.reduce((s, c) => s + (c.projectValue || 0), 0);
  const avgDeal = completed.length > 0 ? totalRevenue / completed.length : 0;
  const convRate = completed.length + lost.length > 0
    ? (completed.length / (completed.length + lost.length)) * 100
    : 0;

  // Pipeline breakdown
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((c) => { map[c.status] = (map[c.status] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  // Rep performance
  const byRep = useMemo(() => {
    const map: Record<string, { name: string; leads: number; closed: number; revenue: number }> = {};
    filtered.forEach((c) => {
      const rep = c.assignedTo || 'Unassigned';
      const member = state.teamMembers.find((m) => m.id === rep);
      const name = member?.name || rep;
      if (!map[rep]) map[rep] = { name, leads: 0, closed: 0, revenue: 0 };
      map[rep].leads++;
      if (c.status === 'completed' || c.status === 'paid') {
        map[rep].closed++;
        map[rep].revenue += c.projectValue || 0;
      }
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filtered, state.teamMembers]);

  // Lead source breakdown
  const bySource = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((c) => {
      const src = c.leadSource || 'Unknown';
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filtered]);

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(0)}`;

  const PERIODS: { id: Period; label: string }[] = [
    { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' },
    { id: '90d', label: '90 Days' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pipeline performance and team results</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === p.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={filtered.length.toString()} icon={Users} color="blue" />
        <StatCard
          label="Revenue Closed"
          value={fmt(totalRevenue)}
          sub={`${completed.length} deals closed`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          label="Conversion Rate"
          value={`${convRate.toFixed(1)}%`}
          sub={`${lost.length} lost`}
          icon={Target}
          color="purple"
        />
        <StatCard
          label="Avg Deal Size"
          value={fmt(avgDeal)}
          icon={TrendingUp}
          color="orange"
        />
      </div>

      {/* Pipeline + Lead Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold text-gray-800">Pipeline Breakdown</h2>
          </div>
          {byStatus.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No contacts in this period</p>
          ) : (
            <div className="space-y-1">
              {byStatus.map(([status, count]) => (
                <PipelineBar key={status} status={status} count={count} total={filtered.length} />
              ))}
            </div>
          )}
        </div>

        {/* Lead Sources */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-purple-500" />
            <h2 className="text-base font-semibold text-gray-800">Lead Sources</h2>
          </div>
          {bySource.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data</p>
          ) : (
            <div className="space-y-1">
              {bySource.map(([src, count]) => (
                <PipelineBar key={src} status={src} count={count} total={filtered.length} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rep Performance */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Award size={18} className="text-yellow-500" />
          <h2 className="text-base font-semibold text-gray-800">Rep Performance</h2>
        </div>
        {byRep.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No data for this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Rep</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Leads</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Closed</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Close %</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byRep.map((rep, i) => (
                  <tr key={rep.name} className={`border-b border-gray-50 ${i === 0 ? 'bg-yellow-50/50' : 'hover:bg-gray-50'}`}>
                    <td className="py-2.5 px-3 font-medium text-gray-900 flex items-center gap-2">
                      {i === 0 && <Award size={13} className="text-yellow-500" />}
                      {rep.name}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-600">{rep.leads}</td>
                    <td className="py-2.5 px-3 text-right text-gray-600">{rep.closed}</td>
                    <td className="py-2.5 px-3 text-right text-gray-600">
                      {rep.leads > 0 ? `${((rep.closed / rep.leads) * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-green-700">{fmt(rep.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
