import React, { useEffect, useState } from 'react';
import { HardHat, Check, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Company } from '@/data/quoteData';

interface LaborRow {
  id: string;
  item_name: string;
  category: string;
  description: string;
  unit: string;
  rate: number;
}

interface Props {
  company: Company;
  /** Only owners, admins, managers and project managers set crew rates. */
  userRole: string;
}

/**
 * Crew rates, per company.
 *
 * The seeded list ships every labor row at $0 except shingle tear-off and
 * install, because a rate is a company's own number and a made-up default is
 * worse than a blank: it prices a job wrong while looking deliberate. A $0 rate
 * also passes silently — the line lands on the quote contributing nothing, and
 * the estimate goes out under cost.
 */
const LaborRatesPanel: React.FC<Props> = ({ company, userRole }) => {
  const [rows, setRows] = useState<LaborRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, string>>({});

  const canEdit = ['owner', 'admin', 'manager', 'project_manager'].includes(userRole);

  useEffect(() => {
    if (!company?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('company_pricing')
        .select('id, item_name, category, description, unit, good_price')
        .eq('company_id', company.id)
        .or('category.ilike.%Labor%,item_name.ilike.%Labor%,item_name.ilike.Tear-Off –%')
        .order('category')
        .order('item_name');
      if (!error && data) {
        setRows(data.map((r: any) => ({
          id: r.id, item_name: r.item_name, category: r.category,
          description: r.description ?? '', unit: r.unit ?? 'sq', rate: r.good_price ?? 0,
        })));
      }
      setLoading(false);
    })();
  }, [company?.id]);

  const save = async (row: LaborRow, raw: string) => {
    const rate = parseFloat(raw);
    if (!Number.isFinite(rate) || rate < 0) return;
    setSaving(row.id);
    try {
      // A rate is one number — it never varies by tier.
      const { error } = await supabase
        .from('company_pricing')
        .update({ good_price: rate, better_price: rate, best_price: rate, price_overridden: true, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, rate } : r)));
      setDirty(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    } catch (err: any) {
      toast.error('Could not save that rate: ' + (err?.message ?? 'unknown error'));
    } finally {
      setSaving(null);
    }
  };

  if (loading || rows.length === 0) return null;

  const unset = rows.filter(r => r.rate <= 0).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
          <HardHat className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Your crew rates</p>
          <p className="text-xs text-gray-500 mt-0.5">
            What your company pays to do the work. These stay off the customer's copy and are never
            marked up — margin comes from the material markup.
          </p>
        </div>
      </div>

      {unset > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">{unset} rate{unset === 1 ? '' : 's'} not set yet.</span>{' '}
            A rate left at $0 lands on the quote contributing nothing, so the estimate goes out under cost.
            Set the trades you actually run and leave the rest.
          </p>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {rows.map(row => {
          const value = dirty[row.id] ?? (row.rate > 0 ? String(row.rate) : '');
          return (
            <div key={row.id} className="flex items-center gap-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">
                  {/tear.?off existing/i.test(row.item_name) ? '2nd Layer Tear Off' : row.item_name}
                </p>
                {row.description && <p className="text-[11px] text-gray-400 truncate">{row.description}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-xs ${row.rate > 0 ? 'text-gray-400' : 'text-amber-500'}`}>$</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  disabled={!canEdit}
                  value={value}
                  onChange={e => setDirty(prev => ({ ...prev, [row.id]: e.target.value }))}
                  onBlur={e => { if (dirty[row.id] !== undefined) save(row, e.target.value); }}
                  className={`w-24 text-right px-2 py-1 border rounded-md text-sm outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50 ${
                    row.rate > 0 ? 'border-gray-200' : 'border-amber-300 bg-amber-50/40'
                  }`}
                />
                <span className="text-xs text-gray-400 w-10">/{row.unit}</span>
                {saving === row.id
                  ? <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  : row.rate > 0
                    ? <Check className="w-3.5 h-3.5 text-green-500" />
                    : <span className="w-3.5" />}
              </div>
            </div>
          );
        })}
      </div>

      {!canEdit && (
        <p className="text-[11px] text-gray-400">
          Crew rates are set by owners, admins, managers, and project managers.
        </p>
      )}
    </div>
  );
};

export default LaborRatesPanel;
