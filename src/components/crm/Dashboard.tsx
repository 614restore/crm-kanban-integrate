import React, { useEffect, useMemo, useRef, useState } from 'react';
import ScheduleName from './ScheduleName';
import { supabase } from '@/lib/supabase';
import { useCRM, usePipelineStats, useFinancialStats, useUpcomingAppointments } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import {
  formatCurrency,
  formatDate,
  statusLabels,
  getContactFullName,
  type Contact,
  type Appointment,
} from '@/lib/crmData';
import {
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Target,
  Zap,
  PenLine,
  HardHat,
  Settings2,
} from 'lucide-react';

interface QuoteActivity {
  id: string;
  quote_id: string | null;
  event_type: string;
  actor_name: string | null;
  created_at: string;
  quotes: { quote_number: string | null; customer_id: string | null } | null;
}

type ActivityItem =
  | { kind: 'appointment'; time: number; appt: Appointment; contact: Contact | undefined }
  | { kind: 'build'; time: number; contact: Contact }
  | { kind: 'quote'; time: number; ev: QuoteActivity }
  | { kind: 'assignment'; time: number; contact: Contact };

const BUILD_STATUSES = new Set(['build_phase', 'in_progress', 'ordering_material']);

interface ActivityPrefs {
  showAppointments: boolean;
  showBuilds: boolean;
  showSigned: boolean;
  showAssignments: boolean;
  maxRows: 5 | 8 | 10;
}

const PREFS_KEY = 'dashboard_activity_prefs';

function loadPrefs(): ActivityPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultPrefs();
}

function defaultPrefs(): ActivityPrefs {
  return { showAppointments: true, showBuilds: true, showSigned: true, showAssignments: true, maxRows: 8 };
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
  const pipelineStats = usePipelineStats();
  const financialStats = useFinancialStats();
  const upcomingAppointments = useUpcomingAppointments(7);

  // Calculate real trends by comparing contacts from last 30 days vs previous 30 days
  const trends = useMemo(() => {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const recent = state.contacts.filter(c => now - new Date(c.createdAt).getTime() < thirtyDays);
    const previous = state.contacts.filter(c => {
      const age = now - new Date(c.createdAt).getTime();
      return age >= thirtyDays && age < thirtyDays * 2;
    });

    const contactGrowth = previous.length > 0
      ? Math.round(((recent.length - previous.length) / previous.length) * 100)
      : recent.length > 0 ? 100 : 0;

    const recentValue = recent.reduce((s, c) => s + (c.projectValue || 0), 0);
    const prevValue = previous.reduce((s, c) => s + (c.projectValue || 0), 0);
    const valueGrowth = prevValue > 0
      ? Math.round(((recentValue - prevValue) / prevValue) * 100)
      : recentValue > 0 ? 100 : 0;

    return { contactGrowth, valueGrowth };
  }, [state.contacts]);

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

  // Quote activity from customers — signed events only.
  const [quoteEvents, setQuoteEvents] = useState<QuoteActivity[]>([]);
  const companyId = state.companyId;
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await (supabase.from('quote_notifications') as any)
        .select('id, quote_id, event_type, actor_name, created_at, quotes:quote_id(quote_number, customer_id)')
        .eq('company_id', companyId)
        .eq('event_type', 'signed')
        .order('created_at', { ascending: false })
        .limit(10);
      if (cancelled || error) return;
      setQuoteEvents((data ?? []) as QuoteActivity[]);
    };
    void load();
    const timer = window.setInterval(load, 45000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [companyId]);

  // Recent activity feed — filtered and capped by user prefs.
  const feed: ActivityItem[] = useMemo(() => {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const currentUserId = profile?.id ?? state.currentUser?.id;
    const items: ActivityItem[] = [
      ...(prefs.showAppointments
        ? [...state.appointments]
            .filter(a => now - new Date(a.createdAt).getTime() < thirtyDays)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, prefs.maxRows)
            .map((appt): ActivityItem => ({
              kind: 'appointment',
              time: new Date(appt.createdAt).getTime(),
              appt,
              contact: state.contacts.find(c => c.id === appt.contactId),
            }))
        : []),
      ...(prefs.showBuilds
        ? [...state.contacts]
            .filter(c => BUILD_STATUSES.has(c.status) && now - new Date(c.updatedAt).getTime() < sevenDays)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, prefs.maxRows)
            .map((contact): ActivityItem => ({ kind: 'build', time: new Date(contact.updatedAt).getTime(), contact }))
        : []),
      ...(prefs.showSigned
        ? quoteEvents.map((ev): ActivityItem => ({ kind: 'quote', time: new Date(ev.created_at).getTime(), ev }))
        : []),
      ...(prefs.showAssignments && currentUserId
        ? [...state.contacts]
            .filter(c => c.assignedTo === currentUserId && now - new Date(c.createdAt).getTime() < sevenDays)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, prefs.maxRows)
            .map((contact): ActivityItem => ({ kind: 'assignment', time: new Date(contact.createdAt).getTime(), contact }))
        : []),
    ];
    return items.sort((a, b) => b.time - a.time).slice(0, prefs.maxRows);
  }, [state.appointments, state.contacts, quoteEvents, prefs, profile?.id, state.currentUser?.id]);

  // Get urgent items (pending payments, overdue, etc.)
  const urgentItems = state.contacts.filter(
    (c) => c.status === 'pending_payment' || c.status === 'contingency'
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back, {firstName}!</h2>
          <p className="text-gray-500 mt-1">Here's what's happening with your business today.</p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="text-blue-600" size={24} />
            </div>
            {trends.contactGrowth !== 0 && (
              <span className={`flex items-center gap-1 ${trends.contactGrowth >= 0 ? 'text-green-600' : 'text-red-600'} text-sm font-medium`}>
                {trends.contactGrowth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {Math.abs(trends.contactGrowth)}%
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">{pipelineStats.totalContacts}</p>
          <p className="text-gray-500 text-sm mt-1">Total Contacts</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
            {trends.valueGrowth !== 0 && (
              <span className={`flex items-center gap-1 ${trends.valueGrowth >= 0 ? 'text-green-600' : 'text-red-600'} text-sm font-medium`}>
                {trends.valueGrowth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {Math.abs(trends.valueGrowth)}%
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(pipelineStats.totalValue)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Pipeline Value</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Target className="text-purple-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {pipelineStats.conversionRate.toFixed(1)}%
          </p>
          <p className="text-gray-500 text-sm mt-1">Conversion Rate</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-amber-600" size={24} />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-4">
            {formatCurrency(pipelineStats.avgDealSize)}
          </p>
          <p className="text-gray-500 text-sm mt-1">Avg Deal Size</p>
        </div>
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
              {Object.entries(pipelineStats.byStatus)
                .filter(([status]) => !['completed', 'lost'].includes(status))
                .slice(0, 6)
                .map(([status, count]) => {
                  const percentage = (count / pipelineStats.totalContacts) * 100;
                  return (
                    <div key={status} className="flex items-center gap-4">
                      <div className="w-32 text-sm font-medium text-gray-700">
                        {statusLabels[status as keyof typeof statusLabels] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-sm font-semibold text-gray-900">
                        {count}
                      </div>
                    </div>
                  );
                })}
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
                <span>{prefs.maxRows} rows</span>
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-8 z-30 w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-3 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Show events</p>
                  {(
                    [
                      { key: 'showAppointments', label: 'Appointments set' },
                      { key: 'showBuilds',        label: 'Builds scheduled' },
                      { key: 'showSigned',        label: 'Quote signatures' },
                      { key: 'showAssignments',   label: 'New assignments' },
                    ] as { key: keyof ActivityPrefs; label: string }[]
                  ).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prefs[key] as boolean}
                        onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Rows to show</p>
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
            {feed.length === 0 && (
              <p className="px-5 py-4 text-sm text-gray-400">No recent activity</p>
            )}
            {feed.map((item) => {
              if (item.kind === 'quote') {
                const customerId = item.ev.quotes?.customer_id ?? null;
                const quoteNo = item.ev.quotes?.quote_number ?? 'a quote';
                return (
                  <div
                    key={`q-${item.ev.id}`}
                    onClick={() => customerId && handleViewContact(customerId)}
                    className={`flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors ${customerId ? 'cursor-pointer' : ''}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate flex-1">
                      <span className="font-medium">{item.ev.actor_name || 'A customer'}</span>
                      {' signed '}
                      <span className="text-gray-500">{quoteNo}</span>
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{timeAgo(item.time)}</span>
                  </div>
                );
              }
              if (item.kind === 'appointment') {
                const contact = item.contact;
                const name = contact ? getContactFullName(contact) : 'Unknown';
                return (
                  <div
                    key={`a-${item.appt.id}`}
                    onClick={() => contact && handleViewContact(contact.id)}
                    className={`flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors ${contact ? 'cursor-pointer' : ''}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate flex-1">
                      Appointment set —{' '}
                      <span className="font-medium">{name}</span>
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{timeAgo(item.time)}</span>
                  </div>
                );
              }
              if (item.kind === 'assignment') {
                const contact = item.contact;
                return (
                  <div
                    key={`as-${contact.id}`}
                    onClick={() => handleViewContact(contact.id)}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate flex-1">
                      New customer assigned —{' '}
                      <span className="font-medium">{getContactFullName(contact)}</span>
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{timeAgo(item.time)}</span>
                  </div>
                );
              }
              // kind === 'build'
              const contact = item.contact;
              return (
                <div
                  key={`b-${contact.id}`}
                  onClick={() => handleViewContact(contact.id)}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                  <span className="text-sm text-gray-800 truncate flex-1">
                    Build scheduled —{' '}
                    <span className="font-medium">{getContactFullName(contact)}</span>
                    <span className="text-gray-400"> · {statusLabels[contact.status] ?? contact.status}</span>
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{timeAgo(item.time)}</span>
                </div>
              );
            })}
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
                    {contact.status === 'pending_payment'
                      ? `Payment pending: ${formatCurrency(contact.finalPaymentAmount || 0)}`
                      : 'Waiting on insurance approval'}
                  </p>
                </div>
              ))}
              {urgentItems.length === 0 && (
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
