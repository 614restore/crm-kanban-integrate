import { supabase } from '../lib/supabase';

export interface Payment {
  id: string;
  contact_id: string;
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
    `Payment recorded: $${params.amount.toFixed(2)} via ${methodLabel}`,
    params.reference_number ? `Reference: ${params.reference_number}` : null,
    params.notes || null,
    `Processed by: ${params.processed_by_name}`,
  ].filter(Boolean);

  await supabase.from('communications').insert({
    contact_id: params.contact_id,
    company_id: params.company_id,
    type: 'note',
    content: noteLines.join('\n'),
    user_id: params.processed_by,
    direction: 'outbound',
  });

  return data;
}

export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId);
  if (error) throw error;
}

// Retrieve the company's Stripe secret key from company_integrations
export async function getStripeApiKey(companyId: string): Promise<string | null> {
  const { data } = await supabase
    .from('company_integrations')
    .select('credentials')
    .eq('company_id', companyId)
    .eq('integration_id', 'stripe')
    .maybeSingle();

  return data?.credentials?.secretKey || data?.credentials?.apiKey || null;
}

const STRIPE_BASE = 'https://api.stripe.com/v1';
const STRIPE_VERSION = '2023-10-16';

function stripeHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Basic ${btoa(`${apiKey}:`)}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_VERSION,
  };
}

/**
 * Creates a Stripe Payment Link for the given amount.
 * Returns the shareable URL that the customer can open to pay.
 */
export async function createStripePaymentLink(
  amount: number,
  description: string,
  stripeApiKey: string,
): Promise<{ url: string; id: string }> {
  const headers = stripeHeaders(stripeApiKey);

  // Step 1: create an ad-hoc one-time price
  const priceBody = new URLSearchParams({
    'unit_amount': Math.round(amount * 100).toString(),
    'currency': 'usd',
    'product_data[name]': description,
  });

  const priceRes = await fetch(`${STRIPE_BASE}/prices`, {
    method: 'POST',
    headers,
    body: priceBody.toString(),
  });

  if (!priceRes.ok) {
    const err = await priceRes.json();
    throw new Error(err.error?.message || 'Failed to create Stripe price');
  }

  const price = await priceRes.json();

  // Step 2: create the payment link from that price
  const linkBody = new URLSearchParams({
    'line_items[0][price]': price.id,
    'line_items[0][quantity]': '1',
  });

  const linkRes = await fetch(`${STRIPE_BASE}/payment_links`, {
    method: 'POST',
    headers,
    body: linkBody.toString(),
  });

  if (!linkRes.ok) {
    const err = await linkRes.json();
    throw new Error(err.error?.message || 'Failed to create Stripe payment link');
  }

  const link = await linkRes.json();
  return { url: link.url, id: link.id };
}
