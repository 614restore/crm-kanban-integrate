import React, { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/utils';
import { formatCurrency } from '@/lib/crmData';
import {
  DollarSign,
  TrendingUp,
  Users,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calendar,
  AlertCircle,
  Percent,
  Info,
  CheckCircle,
  RotateCcw,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import CommissionSettingsModal from './CommissionSettingsModal';
import CommissionBonusModal, { BonusJob } from './CommissionBonusModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SalesmanCommission {
  id: string;
  name: string;
  email: string;
  role: string;
  /** % applied to self-generated leads */
  commission_rate_self_gen: number;
  /** % applied to company-generated leads */
  commission_rate_company: number;
  /** custom/override % — when > 0 it overrides both */
  commission_rate_custom: number;
  /** 'percent_total' or 'profit_split' (this person's own setting, else the company's). */
  method: string;
  overheadPct: number;
  splitPct: number;
  jobs: CommissionJob[];
  totalRevenue: number;
  totalCommission: number;
}

interface CommissionJob {
  contactId: string;
  contactName: string;
  status: string;
  leadSource: string;
  projectValue: number;
  rateUsed: number;
  commissionEarned: number;
  closedAt: string;
  address?: string;
  /** When the commission was checked off as paid, or null while it is still owed. */
  paidAt?: string | null;
  method: string;
  costsTotal: number;
  costsConfirmed: boolean;
  /** Contest and one-off bonuses on this job, already included in commissionEarned. */
  bonus: number;
}

/**
 * Which list a job belongs on. The server works out the amounts (commission_payroll_jobs), so web and mobile agree.
 *   paid     checked off as paid
 *   pending  no payment collected yet (pending down payment)
 *   costs    profit split, paid in, but the job costs are not marked complete yet (pending costs)
 *   owed     everything else
 */
const bucketOf = (r: any): 'paid' | 'pending' | 'costs' | 'owed' =>
  r.commission_paid_at ? 'paid' : !r.has_payment ? 'pending' : r.method === 'profit_split' && !r.costs_confirmed ? 'costs' : 'owed';

// Statuses that count as "sold / commissionable": every stage from signed onward. A job stays on payroll
// until its commission is checked off as paid, whatever stage it has reached (the list used to leave out
// Ordering Material, Scheduled and Paid, so a job could drop off payroll by moving along).
const COMMISSIONABLE_STATUSES = [
  'signed',
  'ordering_material',
  'scheduled',
  'in_progress',
  'build_phase',
  'cleanup',
  'punch_list',
  'invoicing',
  'pending_payment',
  'completed',
  'paid',
];

const STATUS_LABELS: Record<string, string> = {
  signed: 'Signed',
  ordering_material: 'Ordering Material',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  build_phase: 'Build Phase',
  cleanup: 'Cleanup',
  punch_list: 'Punch List',
  invoicing: 'Invoicing',
  pending_payment: 'Pending Payment',
  completed: 'Completed',
  paid: 'Paid',
};

// Who may check a job off as paid, or take it back. The database enforces the same list
// (can_mark_commission_paid), so it holds whatever the screen shows.
const CAN_MARK_PAID_ROLES = ['owner', 'admin', 'manager', 'sales_manager', 'production_manager', 'office_staff'];

const NOTICE_KEY = 'commission_payroll_notice_v1';

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommissionPayrollView() {
  const { state } = useCRM();
  const { profile } = useAuth();

  // Date range: default to current month
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSalesman, setExpandedSalesman] = useState<string | null>(null);
  const [salesmen, setSalesmen] = useState<SalesmanCommission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 'owed'    = first payment collected (and, on a profit split, job costs complete), commission not yet paid
  // 'pending' = sold jobs still waiting on the first payment (not payable yet)
  // 'costs'   = profit-split jobs paid in but still waiting for the job costs to be marked complete
  // 'paid'    = jobs checked off as paid, by the date they were paid
  const [view, setView] = useState<'owed' | 'pending' | 'costs' | 'paid'>('owed');
  const [companySettings, setCompanySettings] = useState({ method: 'percent_total', overhead: 10, split: 50 });
  const [people, setPeople] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  // Open bonus dialog: one job, or all of a salesperson's listed jobs.
  const [bonusFor, setBonusFor] = useState<{ who: string; jobs: BonusJob[] } | null>(null);
  const [marking, setMarking] = useState(false);
  const [showNotice, setShowNotice] = useState(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) !== 'dismissed';
    } catch {
      return true;
    }
  });
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const companyId = state.companyId || profile?.company_id;
  const userRole = state.currentUser?.role || profile?.role || 'owner';

  // Only owners, admins, managers can view this page
  const canView = ['owner', 'admin', 'manager', 'sales_manager', 'office_staff'].includes(userRole);
  const canMarkPaid = CAN_MARK_PAID_ROLES.includes(userRole);
  // Only an owner or admin can change the commission method and rates (the database enforces it too).
  const canEditSettings = ['owner', 'admin'].includes(userRole);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);

    try {
      // Salespeople (team_members: customers.assigned_to holds the team member id).
      const { data: team, error: teamError } = await withTimeout(
        Promise.resolve(
          supabase
            .from('team_members')
            .select('id, first_name, last_name, full_name, email, role, commission_rate_self_gen, commission_rate_company, commission_rate_custom, commission_method, commission_overhead_pct, commission_split_sales_pct')
            .eq('company_id', companyId)
            .eq('is_active', true)
            // 'salesperson' is the mobile app's sales role; leaving it out hid those people from payroll.
            .in('role', ['owner', 'admin', 'manager', 'sales_manager', 'sales_rep', 'sales', 'salesperson', 'canvas'])
        ) as Promise<any>,
        10000,
        'loadCommissionProfiles'
      ) as { data: any[] | null; error: any };
      if (teamError) throw teamError;

      const { data: co } = await supabase
        .from('companies')
        .select('commission_method, commission_overhead_pct, commission_split_sales_pct')
        .eq('id', companyId)
        .maybeSingle();
      const companyDefault = {
        method: (co as any)?.commission_method ?? 'percent_total',
        overhead: Number((co as any)?.commission_overhead_pct ?? 10),
        split: Number((co as any)?.commission_split_sales_pct ?? 50),
      };
      setCompanySettings(companyDefault);
      setPeople(team ?? []);

      // The server works out each job's commission and which list it is on, the same for web and mobile.
      const { data: rows, error: rowsError } = await withTimeout(
        Promise.resolve(supabase.rpc('commission_payroll_jobs', { p_company_id: companyId })) as Promise<any>,
        15000,
        'loadCommissionJobs'
      ) as { data: any[] | null; error: any };
      if (rowsError) throw rowsError;

      const from = Date.parse(`${dateFrom}T00:00:00.000Z`);
      const to = Date.parse(`${dateTo}T23:59:59.999Z`);
      const wanted = (rows ?? []).filter((r: any) => {
        if (view === 'paid') {
          const at = r.commission_paid_at ? Date.parse(r.commission_paid_at) : NaN;
          return at >= from && at <= to;
        }
        return bucketOf(r) === view;
      });

      // Build per-salesman commission data
      const result: SalesmanCommission[] = (team ?? []).map((p) => {
        const self_gen_rate = Number(p.commission_rate_self_gen ?? 0);
        const company_rate  = Number(p.commission_rate_company  ?? 0);
        const custom_rate   = Number(p.commission_rate_custom   ?? 0);
        const method = p.commission_method ?? companyDefault.method;
        const overheadPct = Number(p.commission_overhead_pct ?? companyDefault.overhead);
        const splitPct = Number(p.commission_split_sales_pct ?? companyDefault.split);

        const jobs: CommissionJob[] = wanted
          .filter((r: any) => r.assigned_to === p.id)
          .map((r: any) => {
            // Once paid, show what was actually paid (the amount and rate at that moment), not a recalculation.
            const paid = !!r.commission_paid_at;
            return {
              contactId: r.customer_id,
              contactName: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
              status: r.status,
              leadSource: r.lead_source ?? '',
              projectValue: Number(r.project_value ?? 0),
              rateUsed: paid && r.commission_paid_rate != null ? Number(r.commission_paid_rate) : Number(r.rate_used ?? 0),
              commissionEarned: paid && r.commission_paid_amount != null ? Number(r.commission_paid_amount) : Number(r.amount ?? 0),
              closedAt: r.updated_at,
              address: [r.address, r.city, r.state].filter(Boolean).join(', '),
              paidAt: r.commission_paid_at ?? null,
              method: r.method,
              costsTotal: Number(r.costs_total ?? 0),
              costsConfirmed: !!r.costs_confirmed,
              bonus: Number(r.bonus ?? 0),
            };
          });

        const totalRevenue = jobs.reduce((sum, j) => sum + j.projectValue, 0);
        const totalCommission = jobs.reduce((sum, j) => sum + j.commissionEarned, 0);

        return {
          id: p.id,
          name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.full_name || p.email,
          email: p.email,
          role: p.role ?? 'sales',
          commission_rate_self_gen: self_gen_rate,
          commission_rate_company:  company_rate,
          commission_rate_custom:   custom_rate,
          method,
          overheadPct,
          splitPct,
          jobs,
          totalRevenue,
          totalCommission,
        };
      });

      // Only show salesmen who have jobs OR have a commission rate set
      const filtered = result.filter((s) =>
        s.jobs.length > 0 ||
        s.method === 'profit_split' ||
        s.commission_rate_self_gen > 0 ||
        s.commission_rate_company > 0 ||
        s.commission_rate_custom > 0
      );
      setSalesmen(filtered);
    } catch (err) {
      console.error('Error loading commission data:', err);
      toast.error('Failed to load commission data');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, dateFrom, dateTo, view]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSalesmen = salesmen.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const grandTotalRevenue = filteredSalesmen.reduce((sum, s) => sum + s.totalRevenue, 0);
  const grandTotalCommission = filteredSalesmen.reduce((sum, s) => sum + s.totalCommission, 0);

  const closeNotice = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(NOTICE_KEY, 'dismissed');
      } catch {
        // storage unavailable: it will simply show again next time
      }
    }
    setShowNotice(false);
  };

  /** Check jobs off as paid. The database records who did it and refuses anyone not allowed to. */
  const markPaid = async (jobs: CommissionJob[], who: string) => {
    if (jobs.length === 0) return;
    const total = jobs.reduce((sum, j) => sum + j.commissionEarned, 0);
    const ok = window.confirm(
      `Mark ${jobs.length} job${jobs.length === 1 ? '' : 's'} as commission PAID for ${who}?\n\n` +
        `Total commission: ${formatCurrency(total)}\n\n` +
        `The job${jobs.length === 1 ? '' : 's'} will come off the Owed list. Only do this once the commission has actually been paid. You can undo it from the Paid tab.`
    );
    if (!ok) return;
    setMarking(true);
    try {
      const now = new Date().toISOString();
      const results = await Promise.all(
        jobs.map((j) =>
          supabase
            .from('customers')
            .update({ commission_paid_at: now, commission_paid_amount: j.commissionEarned, commission_paid_rate: j.rateUsed })
            .eq('id', j.contactId)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      toast.success(`Marked ${jobs.length} job${jobs.length === 1 ? '' : 's'} paid for ${who}`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not mark commission paid');
    } finally {
      setMarking(false);
    }
  };

  const undoPaid = async (job: CommissionJob) => {
    if (!window.confirm(`Take ${job.contactName} back to Owed? Do this only if it was marked paid by mistake.`)) return;
    setMarking(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ commission_paid_at: null, commission_paid_by: null, commission_paid_amount: null, commission_paid_rate: null })
        .eq('id', job.contactId);
      if (error) throw error;
      toast.success(`${job.contactName} is back on the Owed list`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not undo');
    } finally {
      setMarking(false);
    }
  };

  const exportCSV = () => {
    const rows: string[] = [
      'Salesman,Email,Role,Self Gen Rate (%),Company Rate (%),Custom Rate (%),# Jobs,Total Revenue,Total Commission',
    ];
    for (const s of filteredSalesmen) {
      rows.push(
        `"${s.name}","${s.email}","${s.role}",${s.commission_rate_self_gen},${s.commission_rate_company},${s.commission_rate_custom},${s.jobs.length},${s.totalRevenue.toFixed(2)},${s.totalCommission.toFixed(2)}`
      );
      if (s.jobs.length > 0) {
        rows.push('  Contact,Lead Source,Status,Address,Rate Used (%),Project Value,Commission Earned,Date,Commission');
        for (const j of s.jobs) {
          rows.push(
            `  "${j.contactName}","${j.leadSource || 'Unknown'}","${STATUS_LABELS[j.status] ?? j.status}","${j.address ?? ''}",${j.rateUsed},${j.projectValue.toFixed(2)},${j.commissionEarned.toFixed(2)},"${j.closedAt.split('T')[0]}","${j.paidAt ? 'Paid ' + j.paidAt.split('T')[0] : view === 'pending' ? 'Pending down payment' : view === 'costs' ? 'Pending costs' : 'Owed'}"`
          );
        }
      }
    }
    rows.push('');
    rows.push(`Totals,,,,${filteredSalesmen.reduce((s, x) => s + x.jobs.length, 0)},${grandTotalRevenue.toFixed(2)},${grandTotalCommission.toFixed(2)}`);

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = view === 'paid' ? `commission-paid-${dateFrom}-to-${dateTo}.csv` : `commission-${view}-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-gray-700 mb-1">Access Restricted</h2>
          <p className="text-gray-500">This report is available to owners, admins, and managers only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Commission Payroll</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Sales commissions for sold jobs — owners and management only
            </p>
          </div>
          <div className="flex items-center gap-2">
          {canEditSettings && (
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Settings size={16} />
              Commission settings
            </button>
          )}
          <button
            onClick={() => setShowNotice(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Info size={16} />
            How payroll works
          </button>
          <button
            onClick={exportCSV}
            disabled={filteredSalesmen.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Download size={16} />
            Export CSV
          </button>
          </div>
        </div>

        {/* Owed vs Paid */}
        <div className="mt-4 inline-flex rounded-lg bg-gray-100 p-1">
          {(['owed', 'pending', 'costs', 'paid'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'owed' ? 'Owed' : v === 'pending' ? 'Pending down payment' : v === 'costs' ? 'Pending costs' : 'Paid'}
            </button>
          ))}
        </div>
      </div>

      {/* Standing reminder */}
      <div className="px-6 pt-3 flex-shrink-0">
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <span>
            <strong>Commission runs once the first payment is collected, and stays on payroll until it is checked off as paid.</strong>{' '}
            {canMarkPaid
              ? 'Jobs with no payment yet wait under Pending down payment, and profit-split jobs also wait under Pending costs until the job costs are marked complete. After you have paid a commission, check the job off here.'
              : 'Jobs with no payment yet wait under Pending down payment, and profit-split jobs also wait for their job costs. Only an owner, admin, manager or financial user can check jobs off as paid.'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0 mt-3">
        <div className="flex flex-wrap items-center gap-4">
          {view === 'owed' && (
            <p className="text-sm text-gray-500">Every job with its first payment collected and commission not yet paid, whatever the date.</p>
          )}
          {view === 'pending' && (
            <p className="text-sm text-gray-500">Sold jobs with no payment collected yet. They move to Owed when the down payment is received.</p>
          )}
          {view === 'costs' && (
            <p className="text-sm text-gray-500">Profit-split jobs that have a payment but whose job costs are not marked complete. A manager or project manager enters the material and subcontractor costs on the customer, then marks costs complete.</p>
          )}
          {view === 'paid' && (<>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <label className="text-sm font-medium text-gray-600">Paid from:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          </>)}
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search salesman…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            {isLoading ? 'Loading…' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="px-6 py-4 grid grid-cols-3 gap-4 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Salesmen</p>
            <p className="text-2xl font-bold text-gray-900">{filteredSalesmen.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(grandTotalRevenue)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <DollarSign size={20} className="text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{view === 'owed' ? 'Total Commissions Owed' : view === 'pending' ? 'Commission Pending Down Payment' : view === 'costs' ? 'Commission Pending Costs (estimated)' : 'Total Commissions Paid'}</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(grandTotalCommission)}</p>
          </div>
        </div>
      </div>

      {bonusFor && (
        <CommissionBonusModal
          who={bonusFor.who}
          jobs={bonusFor.jobs}
          onClose={() => setBonusFor(null)}
          onSaved={() => {
            setBonusFor(null);
            loadData();
          }}
        />
      )}

      {showSettings && companyId && (
        <CommissionSettingsModal
          companyId={companyId}
          company={companySettings}
          people={people}
          onClose={() => setShowSettings(false)}
          onSaved={() => {
            setShowSettings(false);
            loadData();
          }}
        />
      )}

      {/* How payroll works (shown on first open, and from the button in the header) */}
      {showNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Info size={20} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Commission runs on the first payment, and stays until it is paid</h2>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
              <li>Commission starts once the <strong>first payment is collected</strong>. A sold job with no payment yet waits under <strong>Pending down payment</strong>, and moves to <strong>Owed</strong> when the down payment is received.</li>
              <li>Your company pays commission either as a <strong>percent of the project total</strong>, or as a <strong>profit split</strong> (for example 10 / 50 / 50: 10% to the company off the top, then the profit after job costs is split 50 / 50). The method can differ by salesperson. Owners and admins set it under Commission settings.</li>
              <li><strong>Contest bonuses:</strong> use <strong>+ Bonus</strong> on a job, or <strong>Add bonus to all</strong> on a salesperson, to add extra percentage points of the project total or of the job's profit, or a flat amount (with a reason). Bonuses add to the commission under either method and lock once the job is marked paid.</li>
              <li>On a profit split, a job also waits under <strong>Pending costs</strong> until a manager or project manager has entered the job costs on the customer and marked them complete.</li>
              <li>A job on the Owed list stays there until someone checks it off as paid. It does not drop off when its stage changes, when the job closes, or when the date moves on.</li>
              <li>Only an <strong>owner, admin, manager or financial (office) user</strong> can check a job off as paid, or take it back.</li>
              <li>Check a job off only <strong>after the commission has actually been paid</strong>. The amount and rate are saved at that moment, so a later change to the Project Value does not rewrite what was paid.</li>
              <li>Paid jobs move to the <strong>Paid</strong> tab, and can be taken back if one was checked off by mistake.</li>
            </ul>
            <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} className="rounded" />
              Don&apos;t show this again (the button in the header brings it back)
            </label>
            <div className="mt-5 flex justify-end">
              <button onClick={closeNotice} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Salesman Rows */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : filteredSalesmen.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <DollarSign size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{view === 'owed' ? 'No commission is owed right now' : view === 'pending' ? 'No sold job is waiting on a down payment' : view === 'costs' ? 'No job is waiting on its costs' : 'No commission was paid in this period'}</p>
            <p className="text-sm mt-1">
              {view === 'owed'
                ? 'A sold job appears here once its first payment is collected, and stays until it is checked off as paid. Make sure salespeople have a commission rate set in Team settings.'
                : view === 'pending'
                ? 'Sold jobs with no payment recorded yet appear here.'
                : view === 'costs'
                ? 'Profit-split jobs appear here until their job costs are marked complete.'
                : 'Adjust the paid-on dates.'}
            </p>
          </div>
        ) : (
          filteredSalesmen.map((salesman) => {
            const isExpanded = expandedSalesman === salesman.id;
            return (
              <div key={salesman.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Salesman header row */}
                <button
                  onClick={() => setExpandedSalesman(isExpanded ? null : salesman.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700 text-sm flex-shrink-0">
                      {salesman.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{salesman.name}</p>
                      <p className="text-xs text-gray-500">{salesman.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 text-right">
                    <div>
                      <p className="text-xs text-gray-500">Commission Rate</p>
                      <div className="flex items-center gap-1 justify-end">
                        <Percent size={13} className="text-gray-400" />
                        <span className="font-semibold text-gray-900">
                          {salesman.method === 'profit_split'
                            ? `Profit split ${salesman.overheadPct} / ${salesman.splitPct} / ${Math.round((100 - salesman.splitPct) * 100) / 100}`
                            : salesman.commission_rate_custom > 0
                            ? `Custom: ${salesman.commission_rate_custom}%`
                            : `SG: ${salesman.commission_rate_self_gen}% / Co: ${salesman.commission_rate_company}%`}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Jobs</p>
                      <p className="font-semibold text-gray-900">{salesman.jobs.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Revenue</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(salesman.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Commission Owed</p>
                      <p className="font-bold text-green-700 text-lg">{formatCurrency(salesman.totalCommission)}</p>
                    </div>
                    <div className="ml-2">
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={18} className="text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Job detail rows */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {view === 'owed' && canMarkPaid && salesman.jobs.length > 0 && (
                      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                        <span className="text-sm text-gray-600">
                          {salesman.jobs.length} job{salesman.jobs.length === 1 ? '' : 's'} owed · {formatCurrency(salesman.totalCommission)}
                        </span>
                        <button
                          onClick={() => markPaid(salesman.jobs, salesman.name)}
                          disabled={marking}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          Mark all paid
                        </button>
                      </div>
                    )}
                    {view !== 'paid' && canMarkPaid && salesman.jobs.length > 0 && (
                      <div className="flex items-center justify-between px-5 py-2 bg-purple-50 border-b border-gray-100">
                        <span className="text-xs text-purple-800">Running a contest? Give all {salesman.jobs.length} of these jobs the same bonus.</span>
                        <button
                          onClick={() =>
                            setBonusFor({
                              who: salesman.name,
                              jobs: salesman.jobs.map((j) => ({ id: j.contactId, name: j.contactName, projectValue: j.projectValue, costsTotal: j.costsTotal })),
                            })
                          }
                          className="px-3 py-1 rounded-lg border border-purple-300 text-sm font-medium text-purple-700 hover:bg-purple-100"
                        >
                          Add bonus to all
                        </button>
                      </div>
                    )}
                    {salesman.jobs.length === 0 ? (
                      <p className="text-sm text-gray-400 px-5 py-4 text-center">
                        No commissionable jobs in this period.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-5 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Address</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Lead Source</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Project Value</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Rate Used</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Commission Earned</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                            <th className="text-right px-5 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">{view === 'owed' ? 'Paid?' : view === 'pending' || view === 'costs' ? 'Status' : 'Paid on'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesman.jobs.map((job, i) => (
                            <tr key={job.contactId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="px-5 py-3 font-medium text-gray-800">{job.contactName}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{job.address || '—'}</td>
                              <td className="px-4 py-3 text-xs text-gray-500">
                                {job.leadSource || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  {STATUS_LABELS[job.status] ?? job.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-800">{formatCurrency(job.projectValue)}</td>
                              <td className="px-4 py-3 text-right text-gray-500 text-xs">{job.method === 'profit_split' ? `${job.rateUsed}% of profit` : `${job.rateUsed}%`}</td>
                              <td className="px-4 py-3 text-right font-semibold text-green-700">
                                {formatCurrency(job.commissionEarned)}
                                {job.method === 'profit_split' && !job.paidAt && (
                                  <div className="text-[10px] font-normal text-gray-400">
                                    after {formatCurrency(job.costsTotal)} costs{job.costsConfirmed ? '' : ' (estimated)'}
                                  </div>
                                )}
                                {job.bonus !== 0 && (
                                  <div className="text-[10px] font-normal text-purple-600">
                                    includes {job.bonus > 0 ? '+' : '-'}{formatCurrency(Math.abs(job.bonus))} bonus
                                  </div>
                                )}
                                {canMarkPaid && !job.paidAt && (
                                  <button
                                    onClick={() => setBonusFor({ who: salesman.name, jobs: [{ id: job.contactId, name: job.contactName, projectValue: job.projectValue, costsTotal: job.costsTotal }] })}
                                    className="mt-0.5 text-[10px] font-medium text-purple-600 hover:underline"
                                  >
                                    + Bonus
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-400 text-xs">{job.closedAt.split('T')[0]}</td>
                              <td className="px-5 py-3 text-right text-xs">
                                {view === 'pending' ? (
                                  <span className="text-amber-600">Waiting on first payment</span>
                                ) : view === 'costs' ? (
                                  <span className="text-amber-600">Waiting on job costs</span>
                                ) : view === 'owed' ? (
                                  canMarkPaid ? (
                                    <button
                                      onClick={() => markPaid([job], salesman.name)}
                                      disabled={marking}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-green-300 text-green-700 font-medium hover:bg-green-50 disabled:opacity-50"
                                    >
                                      <CheckCircle size={13} /> Mark paid
                                    </button>
                                  ) : (
                                    <span className="text-gray-400">Owed</span>
                                  )
                                ) : (
                                  <span className="inline-flex items-center gap-2 text-gray-600">
                                    {job.paidAt ? job.paidAt.split('T')[0] : '—'}
                                    {canMarkPaid && (
                                      <button
                                        onClick={() => undoPaid(job)}
                                        disabled={marking}
                                        title="Take back to Owed"
                                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                      >
                                        <RotateCcw size={13} />
                                      </button>
                                    )}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200 bg-gray-50">
                            <td colSpan={4} className="px-5 py-2 text-sm font-semibold text-gray-700">
                              Totals ({salesman.jobs.length} jobs)
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-gray-800">{formatCurrency(salesman.totalRevenue)}</td>
                            <td />
                            <td className="px-4 py-2 text-right font-bold text-green-700">{formatCurrency(salesman.totalCommission)}</td>
                            <td />
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
