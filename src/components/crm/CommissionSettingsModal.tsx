import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/**
 * Commission settings (owners and admins). The company picks a default method:
 *   percent_total  commission = project total x the salesperson's rate
 *   profit_split   the company takes an off-the-top % of the project total (overhead), then the profit left after
 *                  job costs is split between sales and the company (for example 10 / 50 / 50)
 * Any salesperson can be put on a different method, or different numbers. The database enforces who may change these.
 */

interface Props {
  companyId: string;
  company: { method: string; overhead: number; split: number };
  people: any[];
  onClose: () => void;
  onSaved: () => void;
}

interface Row {
  id: string;
  name: string;
  method: string; // '' = company default
  self: string;
  comp: string;
  custom: string;
  overhead: string; // '' = company default
  split: string; // '' = company default
}

const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));
const pctOk = (n: number | null) => n === null || (Number.isFinite(n) && n >= 0 && n <= 100);

export default function CommissionSettingsModal({ companyId, company, people, onClose, onSaved }: Props) {
  const [method, setMethod] = useState(company.method);
  const [overhead, setOverhead] = useState(String(company.overhead));
  const [split, setSplit] = useState(String(company.split));
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>(
    people.map((p) => ({
      id: p.id,
      name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.full_name || p.email,
      method: p.commission_method ?? '',
      self: String(p.commission_rate_self_gen ?? 0),
      comp: String(p.commission_rate_company ?? 0),
      custom: String(p.commission_rate_custom ?? 0),
      overhead: p.commission_overhead_pct == null ? '' : String(p.commission_overhead_pct),
      split: p.commission_split_sales_pct == null ? '' : String(p.commission_split_sales_pct),
    }))
  );

  const setRow = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const coShare = Math.round((100 - (Number(split) || 0)) * 100) / 100;

  const save = async () => {
    const cOver = num(overhead);
    const cSplit = num(split);
    if (cOver === null || cSplit === null || !pctOk(cOver) || !pctOk(cSplit)) {
      toast.error('The company percentages must be between 0 and 100.');
      return;
    }
    for (const r of rows) {
      if (![r.self, r.comp, r.custom, r.overhead, r.split].every((v) => pctOk(num(v)))) {
        toast.error(`${r.name}: every percentage must be between 0 and 100.`);
        return;
      }
    }
    setSaving(true);
    try {
      const { error: coError } = await supabase
        .from('companies')
        .update({ commission_method: method, commission_overhead_pct: cOver, commission_split_sales_pct: cSplit })
        .eq('id', companyId);
      if (coError) throw coError;

      for (const r of rows) {
        const original = people.find((p) => p.id === r.id);
        const next = {
          commission_method: r.method === '' ? null : r.method,
          commission_rate_self_gen: num(r.self) ?? 0,
          commission_rate_company: num(r.comp) ?? 0,
          commission_rate_custom: num(r.custom) ?? 0,
          commission_overhead_pct: num(r.overhead),
          commission_split_sales_pct: num(r.split),
        };
        const changed =
          (original?.commission_method ?? null) !== next.commission_method ||
          Number(original?.commission_rate_self_gen ?? 0) !== next.commission_rate_self_gen ||
          Number(original?.commission_rate_company ?? 0) !== next.commission_rate_company ||
          Number(original?.commission_rate_custom ?? 0) !== next.commission_rate_custom ||
          (original?.commission_overhead_pct ?? null) !== next.commission_overhead_pct ||
          (original?.commission_split_sales_pct ?? null) !== next.commission_split_sales_pct;
        if (!changed) continue;
        const { error } = await supabase.from('team_members').update(next).eq('id', r.id);
        if (error) throw error;
      }
      toast.success('Commission settings saved');
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not save commission settings');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-20 px-2 py-1 border border-gray-200 rounded-md text-sm text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Commission settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Company default</h3>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="radio" checked={method === 'percent_total'} onChange={() => setMethod('percent_total')} className="mt-1" />
                <span>
                  <strong>Percent of project total</strong>: commission is the project total times the salesperson&apos;s rate (for example 11%).
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="radio" checked={method === 'profit_split'} onChange={() => setMethod('profit_split')} className="mt-1" />
                <span>
                  <strong>Profit split</strong>: the company takes an off-the-top percent of the project total, then the profit left after job costs is split between sales and the company.
                </span>
              </label>
            </div>
            {method === 'profit_split' && (
              <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  Company off the top (%)
                  <input className={input} inputMode="decimal" value={overhead} onChange={(e) => setOverhead(e.target.value)} />
                </label>
                <label className="flex items-center gap-2">
                  Sales share of profit (%)
                  <input className={input} inputMode="decimal" value={split} onChange={(e) => setSplit(e.target.value)} />
                </label>
                <span className="text-gray-500">
                  = {Number(overhead) || 0} / {Number(split) || 0} / {coShare} (off the top / sales / company)
                </span>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Each salesperson</h3>
            <p className="text-xs text-gray-500 mb-2">
              Leave Method on &ldquo;Company default&rdquo; unless this person is paid differently. The rates apply to percent of total (self-generated and company leads; a custom rate overrides both, handy for commercial reps). Off the top and Sales share apply to a profit split; blank uses the company numbers.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Method</th>
                    <th className="text-right px-3 py-2">Self-gen %</th>
                    <th className="text-right px-3 py-2">Company %</th>
                    <th className="text-right px-3 py-2">Custom %</th>
                    <th className="text-right px-3 py-2">Off the top %</th>
                    <th className="text-right px-3 py-2">Sales share %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                      <td className="px-3 py-2">
                        <select
                          value={r.method}
                          onChange={(e) => setRow(r.id, { method: e.target.value })}
                          className="px-2 py-1 border border-gray-200 rounded-md text-sm"
                        >
                          <option value="">Company default</option>
                          <option value="percent_total">Percent of total</option>
                          <option value="profit_split">Profit split</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right"><input className={input} inputMode="decimal" value={r.self} onChange={(e) => setRow(r.id, { self: e.target.value })} /></td>
                      <td className="px-3 py-2 text-right"><input className={input} inputMode="decimal" value={r.comp} onChange={(e) => setRow(r.id, { comp: e.target.value })} /></td>
                      <td className="px-3 py-2 text-right"><input className={input} inputMode="decimal" value={r.custom} onChange={(e) => setRow(r.id, { custom: e.target.value })} /></td>
                      <td className="px-3 py-2 text-right"><input className={input} inputMode="decimal" placeholder="default" value={r.overhead} onChange={(e) => setRow(r.id, { overhead: e.target.value })} /></td>
                      <td className="px-3 py-2 text-right"><input className={input} inputMode="decimal" placeholder="default" value={r.split} onChange={(e) => setRow(r.id, { split: e.target.value })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
