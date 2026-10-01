// A customer has signed, and the salesperson's countersignature is the step that sends them the
// completed copy. Shown at the top of the customer's page, on every tab, until it is done.
import React, { useCallback, useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCRM } from '@/lib/crmStore';

interface WaitingQuote {
  id: string;
  quote_number: string | null;
}

export default function CountersignBanner({ contactId }: { contactId: string }) {
  const { dispatch } = useCRM();
  const [waiting, setWaiting] = useState<WaitingQuote[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number')
      .or(`customer_id.eq.${contactId},contact_id.eq.${contactId}`)
      .eq('status', 'signed')
      .eq('is_archived', false)
      .is('contractor_signed_at', null)
      // Inspection reports are not quotes; the customer's agreement on one is handled with the report.
      .or('project_type.is.null,project_type.neq.inspection_report')
      .order('created_at', { ascending: false });
    if (!error) setWaiting((data ?? []) as WaitingQuote[]);
  }, [contactId]);

  useEffect(() => {
    void load();
    // A customer can sign while this page is open, and a countersign elsewhere clears it.
    const timer = window.setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [load]);

  if (waiting.length === 0) return null;

  const countersign = (quoteId: string) => {
    dispatch({ type: 'SET_PENDING_QUOTE_ACTION', payload: { contactId, quoteId, action: 'countersign' } });
    dispatch({ type: 'SET_VIEW', payload: 'quotes' });
  };

  return (
    <div className="mb-4 space-y-2">
      {waiting.map((q) => (
        <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2 text-sm text-amber-900">
            <PenLine size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Customer signed {q.quote_number ?? 'their quote'} — your countersignature is needed</p>
              <p className="text-amber-800">Add your signature and the completed document goes to the homeowner and is saved to their documents.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => countersign(q.id)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            <PenLine size={15} /> Countersign
          </button>
        </div>
      ))}
    </div>
  );
}
