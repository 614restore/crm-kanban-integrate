import { supabase } from '../lib/supabase';
import { postToSendApi } from '../lib/emailApi';

export interface Payment {
  id: string;
  contact_id: string;
  contact_name?: string | null;
  work_order_id: string | null;
  company_id: string;
  amount: number;
  payment_method:
    | 'cash'
    | 'check'
    | 'credit_card'
    | 'ach'
    | 'insurance_check'
    | 'stripe_payment_link'
    | 'external'     // processed in another system (Sage, QuickBooks, etc.) — recorded for tracking
    | 'other';
  reference_number: string | null;
  notes: string | null;
  processed_by: string | null;
  processed_by_name: string | null;
  stripe_payment_link_url: string | null;
  payment_date: string;
  created_at: string;
}

export interface RecordPaymentParams {
  contact_id: string;
  work_order_id?: string;
  company_id: string;
  amount: number;
  payment_method: Payment['payment_method'];
  reference_number?: string;
  notes?: string;
  processed_by: string;
  processed_by_name: string;
  stripe_payment_link_url?: string;
  payment_date?: string;
}

export const PAYMENT_METHOD_LABELS: Record<Payment['payment_method'], string> = {
  cash: 'Cash',
  check: 'Check',
  credit_card: 'Credit Card',
  ach: 'ACH / Bank Transfer',
  insurance_check: 'Insurance Check',
  stripe_payment_link: 'Stripe Payment Link',
  external: 'External System (Sage / QuickBooks / etc.)',
  other: 'Other',
};

export async function getContactPayments(contactId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('contact_id', contactId)
    .order('payment_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function recordPayment(params: RecordPaymentParams): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      contact_id: params.contact_id,
      work_order_id: params.work_order_id || null,
      company_id: params.company_id,
      amount: params.amount,
      payment_method: params.payment_method,
      reference_number: params.reference_number || null,
      notes: params.notes || null,
      processed_by: params.processed_by,
      processed_by_name: params.processed_by_name,
      stripe_payment_link_url: params.stripe_payment_link_url || null,
      payment_date: params.payment_date || new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;

  // Auto-note in the customer's communications/timeline
  const methodLabel = PAYMENT_METHOD_LABELS[params.payment_method];
  const noteLines = [
    `💰 Payment recorded: $${params.amount.toFixed(2)} via ${methodLabel}`,
    params.work_order_id ? `Work Order: ${params.work_order_id}` : null,
    params.reference_number ? `Reference: ${params.reference_number}` : null,
    params.notes || null,
    `Processed by: ${params.processed_by_name}`,
  ].filter(Boolean);

  await supabase.from('communications').insert({
    contact_id: params.contact_id,
    company_id: params.company_id,
    type: 'note',
    direction: 'internal',
    content: noteLines.join('\n'),
    status: 'completed',
    created_by: params.processed_by,
    created_at: new Date().toISOString(),
  });

  return data;
}

export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) throw error;
}

/**
 * Send an email receipt to the customer for a recorded payment.
 * Uses the same /api/send-email endpoint as all other outbound email.
 */
export async function sendPaymentReceipt(params: {
  toEmail: string;
  contactName: string;
  companyName: string;
  amount: number;
  paymentMethod: Payment['payment_method'];
  referenceNumber?: string | null;
  paymentDate: string;
  notes?: string | null;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const methodLabel = PAYMENT_METHOD_LABELS[params.paymentMethod];
  const dateLabel = new Date(params.paymentDate).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
      <h2 style="margin:0 0 4px;color:#0f172a;font-size:22px;">Payment Receipt</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Thank you, ${params.contactName}</p>

      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Amount</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:700;text-align:right;color:#16a34a;">$${params.amount.toFixed(2)}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Method</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">${methodLabel}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;">Date</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">${dateLabel}</td></tr>
          ${params.referenceNumber ? `<tr><td style="padding:8px 0;color:#64748b;">Reference</td>
              <td style="padding:8px 0;text-align:right;">${params.referenceNumber}</td></tr>` : ''}
        </table>
        ${params.notes ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">${params.notes}</p>` : ''}
      </div>

      <p style="font-size:13px;color:#94a3b8;text-align:center;margin:0;">${params.companyName}</p>
    </div>
  `;

  const res = await fetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'email',
      to: params.toEmail,
      subject: `Payment Receipt — $${params.amount.toFixed(2)} from ${params.companyName}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Email send failed (${res.status})`);
  }
}

/**
 * Creates a Stripe Payment Link for the given amount on the company's own Stripe account.
 * Returns the shareable URL that the customer can open to pay. The server reads the company's
 * Stripe secret key; it never reaches the browser.
 */
export async function createStripePaymentLink(
  amount: number,
  description: string,
): Promise<{ url: string; id: string }> {
  return postToSendApi<{ url: string; id: string }>(
    { type: 'payment-link', amount, description },
    20000,
    'Stripe payment link',
  );
}
