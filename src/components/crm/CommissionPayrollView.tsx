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
} from 'lucide-react';
import { toast } from 'sonner';

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
}

// Statuses that count as "sold / commissionable"
const COMMISSIONABLE_STATUSES = [
  'signed',
  'in_progress',
  'build_phase',
  'cleanup',
  'invoicing',
  'pending_payment',
  'completed',
];

const STATUS_LABELS: Record<string, string> = {
  signed: 'Signed',
  in_progress: 'In Progress',
  build_phase: 'Build Phase',
  cleanup: 'Cleanup',
  invoicing: 'Invoicing',
  pending_payment: 'Pending Payment',
  completed: 'Completed',
};

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

  const companyId = state.companyId || profile?.company_id;
  const userRole = state.currentUser?.role || profile?.role || 'owner';

  // Only owners, admins, managers can view this page
  const canView = ['owner', 'admin', 'manager', 'sales_manager', 'office_staff'].includes(userRole);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);

    try {
      // Load profiles with commission_rate for sales roles
      const { data: profiles, error: profilesError } = await withTimeout(
        Promise.resolve(
          supabase
            .from('profiles')
            .select('id, first_name, last_name, email, role, commission_rate_self_gen, commission_rate_company, commission_rate_custom')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .in('role', ['owner', 'admin', 'manager', 'sales_manager', 'sales_rep', 'sales', 'canvas'])
        ) as Promise<any>,
        10000,
        'loadCommissionProfiles'
      ) as { data: any[] | null; error: any };
      if (profilesError) throw profilesError;

      // Load commissionable contacts in date range
      const { data: contacts, error: contactsError } = await withTimeout(
        Promise.resolve(
          supabase
            .from('contacts')
            .select('id, first_name, last_name, status, project_value, assigned_to, updated_at, address, city, state, lead_source')
            .eq('company_id', companyId)
            .in('status', COMMISSIONABLE_STATUSES)
            .gte('updated_at', `${dateFrom}T00:00:00.000Z`)
            .lte('updated_at', `${dateTo}T23:59:59.999Z`)
        ) as Promise<any>,
        10000,
        'loadCommissionContacts'
      ) as { data: any[] | null; error: any };
      if (contactsError) throw contactsError;

      // Build per-salesman commission data
      const result: SalesmanCommission[] = (profiles ?? []).map((p) => {
        const self_gen_rate = Number(p.commission_rate_self_gen ?? 0);
        const company_rate  = Number(p.commission_rate_company  ?? 0);
        const custom_rate   = Number(p.commission_rate_custom   ?? 0);

        const assignedContacts = (contacts ?? []).filter(
          (c) => c.assigned_to === p.id && (c.project_value ?? 0) > 0
        );
        const jobs: CommissionJob[] = assignedContacts.map((c) => {
          const value = Number(c.project_value ?? 0);
          const leadSource = c.lead_source ?? '';
          // Custom overrides everything when set; otherwise self-gen vs company
          const rateUsed = custom_rate > 0
            ? custom_rate
            : leadSource === 'Self Generated'
              ? self_gen_rate
              : company_rate;
          return {
            contactId: c.id,
            contactName: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(),
            status: c.status,
            leadSource,
            projectValue: value,
            rateUsed,
            commissionEarned: value * (rateUsed / 100),
            closedAt: c.updated_at,
            address: [c.address, c.city, c.state].filter(Boolean).join(', '),
          };
        });

        const totalRevenue = jobs.reduce((sum, j) => sum + j.projectValue, 0);
        const totalCommission = jobs.reduce((sum, j) => sum + j.commissionEarned, 0);

        return {
          id: p.id,
          name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email,
          email: p.email,
          role: p.role ?? 'sales',
          commission_rate_self_gen: self_gen_rate,
          commission_rate_company:  company_rate,
          commission_rate_custom:   custom_rate,
          jobs,
          totalRevenue,
          totalCommission,
        };
      });

      // Only show salesmen who have jobs OR have a commission rate set
      const filtered = result.filter((s) =>
        s.jobs.length > 0 ||
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
  }, [companyId, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSalesmen = salesmen.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const grandTotalRevenue = filteredSalesmen.reduce((sum, s) => sum + s.totalRevenue, 0);
  const grandTotalCommission = filteredSalesmen.reduce((sum, s) => sum + s.totalCommission, 0);

  const exportCSV = () => {
    const rows: string[] = [
      'Salesman,Email,Role,Self Gen Rate (%),Company Rate (%),Custom Rate (%),# Jobs,Total Revenue,Total Commission',
    ];
    for (const s of filteredSalesmen) {
      rows.push(
        `"${s.name}","${s.email}","${s.role}",${s.commission_rate_self_gen},${s.commission_rate_company},${s.commission_rate_custom},${s.jobs.length},${s.totalRevenue.toFixed(2)},${s.totalCommission.toFixed(2)}`
      );
      if (s.jobs.length > 0) {
        rows.push('  Contact,Lead Source,Status,Address,Rate Used (%),Project Value,Commission Earned,Date');
        for (const j of s.jobs) {
          rows.push(
            `  "${j.contactName}","${j.leadSource || 'Unknown'}","${STATUS_LABELS[j.status] ?? j.status}","${j.address ?? ''}",${j.rateUsed},${j.projectValue.toFixed(2)},${j.commissionEarned.toFixed(2)},"${j.closedAt.split('T')[0]}"`
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
    a.download = `commission-payroll-${dateFrom}-to-${dateTo}.csv`;
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
              Sales commissions for closed jobs — owners and management only
            </p>
          </div>
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

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <label className="text-sm font-medium text-gray-600">From:</label>
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
            <p className="text-xs text-gray-500 font-medium">Total Commissions Owed</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(grandTotalCommission)}</p>
          </div>
        </div>
      </div>

      {/* Salesman Rows */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : filteredSalesmen.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <DollarSign size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No commission data for this period</p>
            <p className="text-sm mt-1">
              Adjust the date range or ensure salesmen have a commission rate set in Team settings.
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
                          {salesman.commission_rate_custom > 0
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
                            <th className="text-right px-5 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
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
                              <td className="px-4 py-3 text-right text-gray-500 text-xs">{job.rateUsed}%</td>
                              <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(job.commissionEarned)}</td>
                              <td className="px-5 py-3 text-right text-gray-400 text-xs">{job.closedAt.split('T')[0]}</td>
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
