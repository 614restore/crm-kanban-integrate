/**
 * TimeTrackingView — Crew time clock & timesheet manager for CRM.
 *
 * Managers can:
 * - See who's currently clocked in and where (GPS)
 * - View timesheets by team member / date range
 * - Approve / reject time entries
 * - Export timesheets to CSV for payroll
 * - Link time entries to jobs for accurate job costing
 *
 * Field crew use the dedicated TimeClock page (TrussCTR-Mobile)
 * or a simplified clock-in button in this view.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { useCRM } from '@/lib/crmStore';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/crmData';
import { toast } from 'sonner';
import {
  Clock,
  Users,
  MapPin,
  CheckCircle,
  XCircle,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  Briefcase,
  RefreshCw,
  ChevronDown,
  AlertCircle,
  Wifi,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, differenceInMinutes } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string;
  user_id: string;
  user_name?: string;
  company_id: string;
  work_order_id?: string;
  work_order_title?: string;
  clock_in: string;
  clock_out?: string;
  duration_minutes?: number;
  lat_in?: number;
  lng_in?: number;
  lat_out?: number;
  lng_out?: number;
  notes?: string;
  status: 'active' | 'completed' | 'approved' | 'rejected';
}

type DateRange = 'today' | 'week' | 'month' | 'custom';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDateRange(range: DateRange): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case 'today':
      return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() };
    case 'week':
      return { start: startOfWeek(now), end: endOfWeek(now) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    default:
      return { start: startOfWeek(now), end: endOfWeek(now) };
  }
}

// ─── Active Clock Badge ───────────────────────────────────────────────────────

function ActiveClockBadge({ entry }: { entry: TimeEntry }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const ms = Date.now() - new Date(entry.clock_in).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const iv = setInterval(update, 30000);
    return () => clearInterval(iv);
  }, [entry.clock_in]);

  return (
    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-green-900">{entry.user_name || 'Team Member'}</p>
        <p className="text-xs text-green-700">
          Clocked in at {formatTime(entry.clock_in)}
          {entry.work_order_title && ` · ${entry.work_order_title}`}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-green-700">{elapsed}</p>
        {entry.lat_in && (
          <a
            href={`https://maps.google.com/maps?q=${entry.lat_in},${entry.lng_in}`}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-green-600 flex items-center justify-end gap-0.5 hover:underline"
          >
            <MapPin className="w-3 h-3" />
            GPS
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Time Entry Row ───────────────────────────────────────────────────────────

function EntryRow({ entry, onApprove, onReject }: {
  entry: TimeEntry;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const duration = entry.duration_minutes
    || (entry.clock_out ? differenceInMinutes(parseISO(entry.clock_out), parseISO(entry.clock_in)) : null);

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900">{entry.user_name || 'Unknown'}</p>
          {entry.work_order_title && (
            <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full truncate max-w-[120px]">
              {entry.work_order_title}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {formatTime(entry.clock_in)}
          {entry.clock_out ? ` → ${formatTime(entry.clock_out)}` : ' → active'}
          {entry.lat_in && (
            <a
              href={`https://maps.google.com/maps?q=${entry.lat_in},${entry.lng_in}`}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-blue-500 hover:underline"
            >
              <MapPin className="w-2.5 h-2.5 inline" /> GPS in
            </a>
          )}
        </p>
        {entry.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{entry.notes}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {duration != null && (
          <span className="text-sm font-bold text-gray-700">{formatDuration(duration)}</span>
        )}

        {entry.status === 'completed' && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => onApprove(entry.id)}
              className="p-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition"
              title="Approve"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => onReject(entry.id)}
              className="p-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition"
              title="Reject"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          entry.status === 'approved' ? 'bg-green-100 text-green-700' :
          entry.status === 'rejected' ? 'bg-red-100 text-red-600' :
          entry.status === 'active' ? 'bg-amber-100 text-amber-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {entry.status}
        </span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TimeTrackingView() {
  const { profile } = useAuth();
  const { state } = useCRM();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  useEffect(() => {
    fetchEntries();
    fetchActive();
    // Poll active entries every minute
    const iv = setInterval(fetchActive, 60000);
    return () => clearInterval(iv);
  }, [dateRange, selectedUser]);

  const fetchActive = async () => {
    if (!profile?.company_id) return;
    const { data } = await supabase
      .from('time_entries')
      .select('*, profiles(first_name, last_name), work_orders(title)')
      .eq('company_id', profile.company_id)
      .eq('status', 'active');
    if (data) {
      setActiveEntries(
        data.map((e: any) => ({
          ...e,
          user_name: e.profiles ? `${e.profiles.first_name} ${e.profiles.last_name}` : 'Unknown',
          work_order_title: e.work_orders?.title,
        }))
      );
    }
  };

  const fetchEntries = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    const { start, end } = getDateRange(dateRange);

    let query = supabase
      .from('time_entries')
      .select('*, profiles(first_name, last_name), work_orders(title)')
      .eq('company_id', profile.company_id)
      .gte('clock_in', start.toISOString())
      .lte('clock_in', end.toISOString())
      .order('clock_in', { ascending: false });

    if (selectedUser !== 'all') query = query.eq('user_id', selectedUser);

    const { data } = await query;
    if (data) {
      setEntries(
        data.map((e: any) => ({
          ...e,
          user_name: e.profiles ? `${e.profiles.first_name} ${e.profiles.last_name}` : 'Unknown',
          work_order_title: e.work_orders?.title,
        }))
      );
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    await supabase.from('time_entries').update({ status: 'approved' }).eq('id', id);
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, status: 'approved' as const } : e));
    toast.success('Time entry approved');
  };

  const handleReject = async (id: string) => {
    await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id);
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, status: 'rejected' as const } : e));
    toast.success('Time entry rejected');
  };

  const exportCSV = () => {
    const header = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Duration (min)', 'Job', 'Status', 'Notes'];
    const rows = entries.map((e) => [
      e.user_name || '',
      new Date(e.clock_in).toLocaleDateString(),
      formatTime(e.clock_in),
      e.clock_out ? formatTime(e.clock_out) : 'Active',
      e.duration_minutes || '',
      e.work_order_title || '',
      e.status,
      e.notes || '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheets-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats
  const stats = useMemo(() => {
    const completed = entries.filter((e) => e.status !== 'active');
    const totalMinutes = completed.reduce((s, e) => s + (e.duration_minutes || 0), 0);
    const uniqueWorkers = new Set(completed.map((e) => e.user_id)).size;
    const pending = completed.filter((e) => e.status === 'completed').length;
    return { totalMinutes, uniqueWorkers, pending };
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* Currently clocked in */}
      {activeEntries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-700">Currently Clocked In ({activeEntries.length})</h3>
          </div>
          {activeEntries.map((e) => <ActiveClockBadge key={e.id} entry={e} />)}
        </div>
      )}

      {/* Filters & export */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['today', 'week', 'month'] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition capitalize ${
                dateRange === r ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white flex-1 max-w-[180px]"
        >
          <option value="all">All employees</option>
          {state.teamMembers.map((tm) => (
            <option key={tm.id} value={tm.id}>{tm.name}</option>
          ))}
        </select>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition ml-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
        <button onClick={fetchEntries} disabled={loading} className="text-gray-400 hover:text-gray-600 transition">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-blue-700">{formatDuration(stats.totalMinutes)}</p>
          <p className="text-[11px] text-blue-600">Total hours</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-green-700">{stats.uniqueWorkers}</p>
          <p className="text-[11px] text-green-600">Workers</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-700">{stats.pending}</p>
          <p className="text-[11px] text-amber-600">Pending approval</p>
        </div>
      </div>

      {/* Entries */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading timesheets...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-300">
            <Clock className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">No time entries for this period</p>
            <p className="text-xs mt-1">Field crew clock in via the mobile app</p>
          </div>
        ) : (
          entries.map((e) => (
            <EntryRow key={e.id} entry={e} onApprove={handleApprove} onReject={handleReject} />
          ))
        )}
      </div>
    </div>
  );
}
