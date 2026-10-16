import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Hammer, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { formatCurrency } from '@/lib/crmData';

/**
 * Job costs for this customer's job: material, subcontractor, labor and other. A manager or project manager
 * enters them here, then marks the costs complete. Companies that pay commission as a profit split (for example
 * 10 / 50 / 50) can pay a job's commission only once its costs are complete. Only manager-level and project roles
 * and Office Staff can see or change costs; the database enforces it (can_manage_job_costs), so a salesperson
 * never sees them whatever the screen shows.
 */

const CAN_MANAGE_COSTS = ['owner', 'admin', 'manager', 'sales_manager', 'production_manager', 'project_manager', 'office_staff'];

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'material', label: 'Material' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'labor', label: 'Labor' },
  { value: 'other', label: 'Other' },
];

interface Cost {
  id: string;
  category: string;
  description: string | null;
  vendor: string | null;
  amount: number;
  created_at: string;
}

export default function JobCostsPanel({ contactId }: { contactId: string }) {
  const { state } = useCRM();
  const { profile } = useAuth();
  const role = state.currentUser?.role || profile?.role || '';
  const allowed = CAN_MANAGE_COSTS.includes(role);

  const [costs, setCosts] = useState<Cost[]>([]);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('material');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');

  const load = useCallback(async () => {
    const [{ data: lines }, { data: cust }] = await Promise.all([
      supabase.from('job_costs').select('id, category, description, vendor, amount, created_at').eq('customer_id', contactId).order('created_at'),
      supabase.from('customers').select('costs_confirmed_at').eq('id', contactId).maybeSingle(),
    ]);
    setCosts((lines ?? []) as Cost[]);
    setConfirmedAt((cust as any)?.costs_confirmed_at ?? null);
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed) return null;

  const total = costs.reduce((s, c) => s + Number(c.amount || 0), 0);

  const addCost = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0 || amount.trim() === '') {
      toast.error('Enter the cost amount (0 or more).');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('job_costs').insert({
      company_id: state.companyId || profile?.company_id,
      customer_id: contactId,
      category,
      description: description.trim() || null,
      vendor: vendor.trim() || null,
      amount: value,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDescription('');
    setVendor('');
    setAmount('');
    load();
  };

  const removeCost = async (id: string) => {
    if (!window.confirm('Delete this cost line?')) return;
    const { error } = await supabase.from('job_costs').delete().eq('id', id);
    if (error) toast.error(error.message);
    else load();
  };

  const setComplete = async (complete: boolean) => {
    if (
      complete &&
      !window.confirm(
        `Mark this job's costs complete at ${formatCurrency(total)}?\n\nOn a profit split, this lets the salesperson's commission be paid. You can reopen the costs afterwards.`
      )
    )
      return;
    setBusy(true);
    const { error } = await supabase
      .from('customers')
      .update({ costs_confirmed_at: complete ? new Date().toISOString() : null, ...(complete ? {} : { costs_confirmed_by: null }) })
      .eq('id', contactId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(complete ? 'Job costs marked complete' : 'Job costs reopened');
    load();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Hammer size={20} /> Job Costs
        </h3>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
          <p className={`text-xs ${confirmedAt ? 'text-green-700' : 'text-amber-600'}`}>
            {confirmedAt ? `Costs complete ${confirmedAt.split('T')[0]}` : 'Costs not marked complete'}
          </p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Enter the material, subcontractor, labor and other costs for this job, then mark costs complete. A profit-split commission is paid only after that.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : costs.length === 0 ? (
        <p className="text-sm text-gray-400 mb-4">No costs entered for this job yet</p>
      ) : (
        <div className="divide-y divide-gray-100 mb-4">
          {costs.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-gray-800">
                  {CATEGORIES.find((x) => x.value === c.category)?.label ?? c.category}
                  {c.description ? ` · ${c.description}` : ''}
                </p>
                {c.vendor && <p className="text-xs text-gray-500">{c.vendor}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">{formatCurrency(Number(c.amount))}</span>
                <button onClick={() => removeCost(c.id)} className="text-gray-400 hover:text-red-600" title="Delete this cost line">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-lg text-sm">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What (shingles, dumpster…)" className="flex-1 min-w-[140px] px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor (optional)" className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount" className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right" />
        <button onClick={addCost} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Add cost
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        {confirmedAt ? (
          <button onClick={() => setComplete(false)} disabled={busy} className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RotateCcw size={14} /> Reopen costs
          </button>
        ) : (
          <button onClick={() => setComplete(true)} disabled={busy || costs.length === 0} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Mark costs complete
          </button>
        )}
      </div>
    </div>
  );
}
