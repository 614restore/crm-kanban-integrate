import React, { useEffect, useState } from 'react';
import { Mail, Receipt, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/crmData';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';

/**
 * Payments received from this customer: every receipt recorded for them, from the web app or the mobile
 * app (both write the same `payments` table), with the total. Shown on the customer's Financial tab so
 * the money received is visible where the customer is, not only inside a quote.
 *
 * Each payment can have its receipt emailed to the customer (the same send-receipt-email function and
 * company CC list the Record Payment panel uses). Owners and managers can delete a payment recorded by
 * mistake.
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

/** Roles that can delete a payment: owners and managers. */
const CAN_DELETE_PAYMENTS = ['owner', 'admin', 'manager', 'sales_manager', 'production_manager'];

interface CustomerPaymentsProps {
  contactId: string;
  projectValue?: number | null;
  customerEmail?: string | null;
  customerName?: string;
  /** Called after a payment is deleted, so totals shown elsewhere on the page can reload. */
  onPaymentsChanged?: () => void;
}

export default function CustomerPayments({ contactId, projectValue, customerEmail, customerName, onPaymentsChanged }: CustomerPaymentsProps) {
  const { state } = useCRM();
  const { profile } = useAuth();
  const role = String(state.currentUser?.role || profile?.role || '');
  const canDelete = CAN_DELETE_PAYMENTS.includes(role);
  const companyId = profile?.company_id || state.companyId || null;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [busy, setBusy] = useState<{ id: string; action: 'send' | 'delete' } | null>(null);

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

  // The company's standing receipt CC list, so a receipt sent from here goes to the same people as one
  // sent from the Record Payment panel.
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    supabase
      .from('companies')
      .select('receipt_cc_emails')
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCcEmails(((data?.receipt_cc_emails as string[] | null) ?? []).filter(Boolean));
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const sendReceipt = async (p: Payment) => {
    const email = customerEmail?.trim();
    if (!email) {
      toast.error('This customer has no email address on file. Add one with Edit, then send the receipt.');
      return;
    }
    if (!companyId) {
      toast.error('No company context. Please refresh and sign in again.');
      return;
    }
    if (p.sent_at && !window.confirm(`Receipt ${p.receipt_number} was already sent. Send it again to ${email}?`)) return;
    setBusy({ id: p.id, action: 'send' });
    try {
      const { data, error } = await supabase.functions.invoke('send-receipt-email', {
        body: { payment_id: p.id, company_id: companyId, to_email: email, to_name: customerName ?? '', cc_emails: ccEmails },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.email_error ?? 'Failed to send receipt');
      const sentAt = new Date().toISOString();
      setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, sent_at: sentAt } : x)));
      toast.success(`Receipt ${p.receipt_number} sent to ${email}${ccEmails.length ? ` + ${ccEmails.length} CC` : ''}`);
    } catch (err) {
      console.error('[CustomerPayments] send receipt failed:', err);
      toast.error(err instanceof Error ? err.message : 'Could not send the receipt');
    } finally {
      setBusy(null);
    }
  };

  const deletePayment = async (p: Payment) => {
    if (!canDelete) return;
    if (!window.confirm(`Delete payment ${p.receipt_number} for ${formatCurrency(Number(p.amount))}? This cannot be undone.`)) return;
    setBusy({ id: p.id, action: 'delete' });
    try {
      // .select() returns the deleted row, so a delete the database refused (no row back) is reported
      // rather than shown as done.
      const { data, error } = await supabase.from('payments').delete().eq('id', p.id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('The payment was not deleted. You may not have permission.');
      setPayments((prev) => prev.filter((x) => x.id !== p.id));
      onPaymentsChanged?.();
      toast.success(`Payment ${p.receipt_number} deleted`);
    } catch (err) {
      console.error('[CustomerPayments] delete payment failed:', err);
      toast.error(err instanceof Error ? err.message : 'Could not delete the payment');
    } finally {
      setBusy(null);
    }
  };

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
          {payments.map((p) => {
            const rowBusy = busy?.id === p.id;
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.receipt_number}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(p.payment_date || p.created_at).toLocaleDateString()} · {METHOD[p.payment_method ?? ''] ?? p.payment_method ?? '—'}
                    {p.sent_at ? ' · Receipt emailed' : ''}
                  </p>
                  {p.note && <p className="text-xs text-gray-400 truncate">{p.note}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(p.amount))}</p>
                  <button
                    type="button"
                    onClick={() => sendReceipt(p)}
                    disabled={!!busy}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                    title={customerEmail ? `Email this receipt to ${customerEmail}` : 'Add an email address to this customer to send receipts'}
                  >
                    <Mail size={14} />
                    {rowBusy && busy?.action === 'send' ? 'Sending…' : p.sent_at ? 'Resend receipt' : 'Send receipt'}
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deletePayment(p)}
                      disabled={!!busy}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      title="Delete this payment"
                      aria-label={`Delete payment ${p.receipt_number}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
