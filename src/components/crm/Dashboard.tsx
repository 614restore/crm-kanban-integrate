import React, { useEffect, useMemo, useRef, useState } from 'react';
import ScheduleName from './ScheduleName';
import { supabase } from '@/lib/supabase';
import { useCRM, useFinancialStats, useUpcomingAppointments } from '@/lib/crmStore';
import { computeDashboardMetrics, DASHBOARD_STAGES } from '@/lib/dashboardMetrics';
import { useAuth } from '@/lib/authContext';
import { appointmentStart } from '@/lib/appointmentUrgency';
import {
  formatCurrency,
  formatDate,
  getContactFullName,
  type Contact,
} from '@/lib/crmData';
import {
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Zap,
  Settings2,
  Briefcase,
} from 'lucide-react';

// Older saved settings also carry the event switches the list used to have; only the row count is read now.
interface ActivityPrefs {
  maxRows: 5 | 8 | 10;
}

const PREFS_KEY = 'dashboard_activity_prefs';

function loadPrefs(): ActivityPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && [5, 8, 10].includes(saved.maxRows)) return { maxRows: saved.maxRows };
  } catch { /* ignore */ }
  return defaultPrefs();
}

function defaultPrefs(): ActivityPrefs {
  return { maxRows: 5 };
}

const timeAgo = (ms: number): string => {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function Dashboard() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const financialStats = useFinancialStats();
  const weekOfAppointments = useUpcomingAppointments(7);
  // An appointment whose start time has passed but is still "scheduled" was missed: it is
  // not upcoming, it needs someone to complete, cancel or reschedule it.
  const nowMs = Date.now();
  const upcomingAppointments = weekOfAppointments.filter((apt) => (appointmentStart(apt)?.getTime() ?? Infinity) >= nowMs);
  const missedAppointments = useMemo(() => {
    const twoWeeksMs = 14 * 24 * 3600e3;
    return state.appointments
      .filter((apt) => {
        if (apt.status !== 'scheduled') return false;
        const start = appointmentStart(apt)?.getTime();
        return start != null && start < Date.now() && Date.now() - start < twoWeeksMs;
      })
      .sort((a, b) => (appointmentStart(b)?.getTime() ?? 0) - (appointmentStart(a)?.getTime() ?? 0));
  }, [state.appointments]);

  const [prefs, setPrefs] = useState<ActivityPrefs>(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  // Payments recorded this month, for Revenue (MTD).
  const companyId = state.companyId;
  const [monthPayments, setMonthPayments] = useState<{ amount: number; created_at: string }[]>([]);
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const load = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data, error } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('company_id', companyId)
        .gte('created_at', monthStart.toISOString());
      if (cancelled) return;
      if (error) {
        console.error('Dashboard: could not load this month\'s payments', error);
        return;
      }
      setMonthPayments(((data as { amount: number | string; created_at: string }[]) || [])
        .map((p) => ({ amount: Number(p.amount) || 0, created_at: p.created_at })));
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [companyId, state.invoices.length]);

  // The same figures, funnel and activity list as the phone app's home screen.
  const metrics = useMemo(
    () => computeDashboardMetrics(state.quotes, state.contacts, monthPayments, new Date(), prefs.maxRows),
    [state.quotes, state.contacts, monthPayments, prefs.maxRows],
  );

  // Contact IDs that have at least one signed-but-not-approved change order.
  const [signedCOContactIds, setSignedCOContactIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('change_orders')
        .select('contact_id')
        .eq('company_id', companyId)
        .eq('status', 'signed');
      if (cancelled) return;
      setSignedCOContactIds(new Set((data ?? []).map((r: any) => r.contact_id as string).filter(Boolean)));
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [companyId]);

  // Get urgent items (pending payments, overdue, signed change orders awaiting approval).
  const urgentItems = useMemo(() => {
    const seen = new Set<string>();
    const items: typeof state.contacts = [];
    for (const c of state.contacts) {
      if (c.status === 'pending_payment' || c.status === 'contingency' || signedCOContactIds.has(c.id)) {
        if (!seen.has(c.id)) { seen.add(c.id); items.push(c); }
      }
    }
    return items;
  }, [state.contacts, signedCOContactIds]);

  // Top performers
  const topPerformers = state.teamMembers
    .filter((tm) => tm.performance && tm.performance.revenue > 0)
    .sort((a, b) => (b.performance?.revenue || 0) - (a.performance?.revenue || 0))
    .slice(0, 3);

  const handleViewContact = (contactId: string) => {
    dispatch({ type: 'SELECT_CONTACT', payload: contactId });
  };

  // Get user's first name for greeting
  const firstName = profile?.first_name || state.currentUser?.name?.split(' ')[0] || 'there';

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back, {firstName}!</h2>
          <p className="text-gray-500 mt-1">Here's what's happening with your business today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'pipeline' })}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
          >
            View Pipeline
          </button>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_QUICK_ADD' })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-600/30"
          >
            Add New Contact
          </button>
        </div>
      </div>

      {/* KPI Cards — the same four figures as the phone app's home screen, two across on phones like it */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {([
          { label: 'Pipeline Value', value: formatCurrency(metrics.pipelineValue), Icon: DollarSign, tint: 'bg-green-100 text-green-600', hint: 'Quotes not yet signed', view: 'quotes' },
          { label: 'Open Leads', value: String(metrics.openLeads), Icon: Users, tint: 'bg-blue-100 text-blue-600', hint: 'Customers with no quote yet', view: 'contacts' },
          { label: 'Jobs In Progress', value: String(metrics.jobsInProgress), Icon: Briefcase, tint: 'bg-amber-100 text-amber-600', hint: 'Signed jobs not yet paid off', view: 'pipeline' },
          { label: 'Revenue (MTD)', value: formatCurrency(metrics.revenueMTD), Icon: TrendingUp, tint: 'bg-slate-100 text-slate-700', hint: 'Payments recorded this month', view: 'financial' },
        ] as const).map(({ label, value, Icon, tint, hint, view }) => (
          <button
            key={label}
            type="button"
            onClick={() => dispatch({ type: 'SET_VIEW', payload: view })}
            title={hint}
            className="min-w-0 text-left bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${tint}`}>
              <Icon size={22} />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 sm:mt-4 truncate">{value}</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">{label}</p>
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Overview */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Pipeline Overview</h3>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'pipeline' })}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                View All <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {(() => {
                const total = DASHBOARD_STAGES.reduce((sum, st) => sum + metrics.stageCounts[st.id], 0);
                if (total === 0) {
                  return <p className="text-sm text-gray-500 text-center py-6">No customers or quotes yet. Add a contact to get started.</p>;
                }
                return DASHBOARD_STAGES.filter((st) => metrics.stageCounts[st.id] > 0).map((st) => {
                  const count = metrics.stageCounts[st.id];
                  return (
                    <div key={st.id} className="flex items-center gap-4">
                      <div className="w-32 text-sm font-medium text-gray-700">{st.label}</div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${(count / total) * 100}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm font-semibold text-gray-900">{count}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming</h3>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'calendar' })}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                View Calendar <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {upcomingAppointments.slice(0, 4).map((apt) => (
              <div key={apt.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="text-blue-600" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{apt.title}</p>
                    <p className="text-sm text-gray-500">{apt.contactName}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <Clock size={12} />
                      <span>
                        {formatDate(apt.date)} at {apt.time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {upcomingAppointments.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p>No upcoming appointments</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent Activity</h3>
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-md hover:bg-gray-50"
              >
                <Settings2 size={13} />
                <span>Show up to {prefs.maxRows}</span>
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-8 z-30 w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-3 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rows to show</p>
                  <div className="flex gap-1.5">
                    {([5, 8, 10] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setPrefs(p => ({ ...p, maxRows: n }))}
                        className={`flex-1 py-1 text-sm rounded-lg font-medium transition-colors ${
                          prefs.maxRows === n
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="py-1">
            {metrics.recent.length === 0 && (
              <p className="px-5 py-4 text-sm text-gray-400">No recent activity</p>
            )}
            {metrics.recent.map((item) => (
              <div
                key={item.key}
                onClick={() => item.customerId && handleViewContact(item.customerId)}
                className={`flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors ${item.customerId ? 'cursor-pointer' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.kind === 'lead' ? 'bg-violet-400' : 'bg-emerald-400'}`} />
                <span className="text-sm text-gray-800 truncate flex-1 min-w-0">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-gray-500"> · {item.meta}</span>
                </span>
                {item.value != null && (
                  <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{formatCurrency(item.value)}</span>
                )}
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2 w-16 text-right">{timeAgo(new Date(item.at).getTime())}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Actions */}
        <div className="space-y-6">
          {/* Urgent Items */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} />
                <h3 className="text-lg font-semibold text-gray-900">Needs Attention</h3>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {urgentItems.slice(0, 3).map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => handleViewContact(contact.id)}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <ScheduleName as="p" contactId={contact.id} className="font-medium">{getContactFullName(contact)}</ScheduleName>
                  <p className="text-sm text-amber-600 mt-1">
                    {signedCOContactIds.has(contact.id)
                      ? 'Change order signed — awaiting your approval'
                      : contact.status === 'pending_payment'
                      ? `Payment pending: ${formatCurrency(contact.finalPaymentAmount || 0)}`
                      : 'Waiting on insurance approval'}
                  </p>
                </div>
              ))}
              {missedAppointments.slice(0, 3).map((apt) => (
                <div
                  key={`missed-${apt.id}`}
                  onClick={() => apt.contactId ? handleViewContact(apt.contactId) : dispatch({ type: 'SET_VIEW', payload: 'calendar' })}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <p className="font-medium text-gray-900">{apt.contactName || apt.title}</p>
                  <p className="text-sm text-red-600 mt-1">
                    Missed appointment: {apt.title} ({appointmentStart(apt)?.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}) — complete, cancel or reschedule it
                  </p>
                </div>
              ))}
              {urgentItems.length === 0 && missedAppointments.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  <CheckCircle size={24} className="mx-auto mb-2 text-green-500" />
                  <p className="text-sm">All caught up!</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Zap className="text-yellow-500" size={20} />
                <h3 className="text-lg font-semibold text-gray-900">Top Performers</h3>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {topPerformers.length === 0 && (
                <p className="p-6 text-sm text-gray-500 text-center">No team results to rank yet.</p>
              )}
              {topPerformers.map((member, index) => (
                <div key={member.id} className="p-4 flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div
                      className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        index === 0
                          ? 'bg-yellow-500'
                          : index === 1
                          ? 'bg-gray-400'
                          : 'bg-amber-700'
                      }`}
                    >
                      {index + 1}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{member.name}</p>
                    <p className="text-sm text-gray-500">
                      {member.performance?.dealsClosed} deals closed
                    </p>
                  </div>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(member.performance?.revenue || 0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Financial Summary</h3>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'financial' })}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1"
          >
            View Details <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div>
            <p className="text-slate-400 text-sm">Total Revenue</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(financialStats.totalRevenue)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Deposits Collected</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(financialStats.depositsCollected)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Pending Payments</p>
            <p className="text-2xl font-bold mt-1 text-amber-400">
              {formatCurrency(financialStats.pendingPayments)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Outstanding Invoices</p>
            <p className="text-2xl font-bold mt-1 text-orange-400">
              {formatCurrency(financialStats.outstandingInvoices)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Signed Quotes</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">
              {formatCurrency(financialStats.signedQuotesTotal)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Material Costs</p>
            <p className="text-2xl font-bold mt-1 text-red-400">
              {formatCurrency(financialStats.deliveredMaterialCost + financialStats.pendingMaterialCost)}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
