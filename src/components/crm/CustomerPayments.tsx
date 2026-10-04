import React, { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/crmData';

/**
 * Payments received from this customer: every receipt recorded for them, from the web app or the mobile
 * app (both write the same `payments` table), with the total. Shown on the customer's Financial tab so
 * the money received is visible where the customer is, not only inside a quote.
 */

interface Payment {
  id: string;
  receipt_number: string;
  amount: number;
  payment_method: string | null;
  payment_date: string | null;
  created_at: string;
  sent_at: string | null;
  note: string | null;
}

const METHOD: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  card: 'Card',
  credit_card: 'Credit card',
  bank_transfer: 'Bank transfer',
  zelle: 'Zelle',
  venmo: 'Venmo',
  other: 'Other',
};

export default function CustomerPayments({ contactId, projectValue }: { contactId: string; projectValue?: number | null }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('payments')
        .select('id, receipt_number, amount, payment_method, payment_date, created_at, sent_at, note')
        .eq('customer_id', contactId)
        .order('created_at', { ascending: false });
      if (!cancelled) {
        setPayments((data ?? []) as Payment[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const received = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = projectValue ? Math.max(0, projectValue - received) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Receipt size={20} /> Payments Received
        </h3>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-700">{formatCurrency(received)}</p>
          {balance !== null && (
            <p className="text-xs text-gray-500">
              {formatCurrency(balance)} left of {formatCurrency(projectValue as number)}
            </p>
          )}
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-gray-400">No payments recorded for this customer yet</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{p.receipt_number}</p>
                <p className="text-xs text-gray-500">
                  {new Date(p.payment_date || p.created_at).toLocaleDateString()} · {METHOD[p.payment_method ?? ''] ?? p.payment_method ?? '—'}
                  {p.sent_at ? ' · Receipt emailed' : ''}
                </p>
                {p.note && <p className="text-xs text-gray-400 truncate">{p.note}</p>}
              </div>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(p.amount))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
