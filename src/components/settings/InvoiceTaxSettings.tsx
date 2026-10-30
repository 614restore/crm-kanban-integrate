import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/** Settings → Company: optional sales tax added to invoices. Off by default. */
const InvoiceTaxSettings: React.FC<{ companyId: string | null | undefined }> = ({ companyId }) => {
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    supabase
      .from('companies')
      .select('invoice_tax_enabled, invoice_tax_rate')
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const row = data as { invoice_tax_enabled?: boolean | null; invoice_tax_rate?: number | string | null };
          setEnabled(!!row.invoice_tax_enabled);
          setRate(row.invoice_tax_rate ? String(Number(row.invoice_tax_rate)) : '');
        }
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [companyId]);

  const save = async () => {
    if (!companyId) return;
    const pct = parseFloat(rate) || 0;
    if (enabled && (pct <= 0 || pct > 30)) { toast.error('Enter a tax rate between 0 and 30%.'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('companies')
      .update({ invoice_tax_enabled: enabled, invoice_tax_rate: pct })
      .eq('id', companyId)
      .select('id');
    setSaving(false);
    if (error || !data?.length) {
      toast.error('Could not save the invoice tax setting. Only the company owner or an admin can change it.');
      return;
    }
    toast.success(enabled ? `Invoices will add ${pct}% sales tax.` : 'Invoices will not add sales tax.');
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Invoice Sales Tax</h3>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!loaded}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="block font-medium text-gray-900">Add sales tax to invoices</span>
            <span className="block text-sm text-gray-500">Leave off if you don't charge sales tax. You can still change the rate on any single invoice.</span>
          </span>
        </label>
        {enabled && (
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax rate (%)</label>
            <input
              type="number" min="0" max="30" step="0.01" placeholder="e.g. 7.5"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={!loaded || saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save tax setting
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTaxSettings;
