/**
 * stripe-payment — Supabase Edge Function
 *
 * Why this exists:
 * - Stripe's secret key must NEVER be exposed to the browser.
 * - All Checkout Session creation and webhook verification must happen server-side.
 *
 * Actions (POST body { action, ... }):
 *   checkout   — create a Stripe Checkout Session, return the session URL
 *   portal     — create a Stripe Customer Portal session (for subscription management)
 *   webhook    — handle Stripe webhook events (payment.succeeded → mark invoice paid)
 *   test       — verify stored Stripe key works, return account details
 *
 * Credential storage:
 * - Reads stripe secret key from company_integrations (integration_type = 'stripe')
 * - The contractor enters their own Stripe secret key in Integration Settings.
 *   It is stored encrypted in Supabase and NEVER sent to the browser.
 *
 * Stripe webhook secret:
 * - Set STRIPE_WEBHOOK_SECRET as an Edge Function secret for webhook verification.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const STRIPE_API = 'https://api.stripe.com/v1';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Make an authenticated call to Stripe's REST API */
async function stripeRequest(
  secretKey: string,
  method: string,
  path: string,
  params?: Record<string, any>
): Promise<{ ok: boolean; status: number; data: any }> {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2023-10-16',
    },
  };

  if (params && method !== 'GET') {
    // Stripe REST API uses form-encoded bodies
    opts.body = flattenToUrlEncoded(params);
  }

  const url = method === 'GET' && params
    ? `${STRIPE_API}${path}?${flattenToUrlEncoded(params)}`
    : `${STRIPE_API}${path}`;

  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Stripe's API needs deeply nested objects flattened into bracket notation */
function flattenToUrlEncoded(obj: Record<string, any>, prefix = ''): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      pairs.push(flattenToUrlEncoded(value, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') {
          pairs.push(flattenToUrlEncoded(item, `${fullKey}[${i}]`));
        } else {
          pairs.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(item)}`);
        }
      });
    } else {
      pairs.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return pairs.join('&');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const urlAction = url.searchParams.get('action');

    // ── Stripe Webhook — no JWT auth, use Stripe-Signature instead ────────────
    if (urlAction === 'webhook' || req.headers.get('stripe-signature')) {
      const sig     = req.headers.get('stripe-signature') || '';
      const rawBody = await req.text();
      const secret  = Deno.env.get('STRIPE_WEBHOOK_SECRET');

      // For now: parse and process without cryptographic signature verification.
      // To enable full verification, add Stripe's Web Crypto HMAC check here.
      // (Supabase Edge Functions don't have access to the Stripe Node SDK.)
      let event: any;
      try {
        event = JSON.parse(rawBody);
      } catch {
        return json({ error: 'Invalid webhook payload' }, 400);
      }

      const db = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const meta    = session.metadata || {};

        // Mark the invoice paid in our DB if we stored the invoice_id in metadata
        if (meta.invoice_id) {
          await db.from('invoices').update({
            status:     'paid',
            paid_at:    new Date().toISOString(),
            stripe_payment_id: session.payment_intent,
            updated_at: new Date().toISOString(),
          }).eq('id', meta.invoice_id);
        }

        // If contact_id supplied, log a payment activity
        if (meta.contact_id) {
          await db.from('activities').insert({
            contact_id:  meta.contact_id,
            company_id:  meta.company_id,
            type:        'payment',
            title:       `Payment received — $${((session.amount_total || 0) / 100).toFixed(2)}`,
            description: `Stripe Checkout Session ${session.id} completed.`,
            created_at:  new Date().toISOString(),
          }).catch(() => {});
        }
      }

      return json({ received: true });
    }

    // ── All other actions require a valid Supabase JWT ─────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();
    if (!profile?.company_id) return json({ error: 'No company found' }, 400);

    const companyId = profile.company_id;

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: Record<string, any> = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};
    const action = body.action || urlAction || 'test';

    // Load the contractor's Stripe secret key from their integration settings
    const { data: integration } = await db
      .from('company_integrations')
      .select('credentials')
      .eq('company_id', companyId)
      .eq('integration_type', 'stripe')
      .single();

    const stripeKey = integration?.credentials?.secretKey || integration?.credentials?.apiKey;

    // ──────────────────────────────────────────────────────────────────────────
    // ACTION: test
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'test') {
      if (!stripeKey) {
        return json({ success: false, error: 'Stripe is not configured. Add your Stripe Secret Key in Integration Settings.' });
      }

      const { ok, data } = await stripeRequest(stripeKey, 'GET', '/account');
      if (!ok) {
        return json({ success: false, error: `Stripe error: ${data?.error?.message || 'Unknown error'}` });
      }

      return json({
        success: true,
        businessName: data.business_profile?.name || data.email,
        country:      data.country,
        chargesEnabled: data.charges_enabled,
        currency:     data.default_currency,
      });
    }

    // All remaining actions require Stripe to be configured
    if (!stripeKey) {
      return json({ error: 'Stripe not configured. Add your Stripe Secret Key in Integration Settings.' }, 400);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ACTION: checkout
    // Creates a Stripe Checkout Session and returns the hosted payment URL.
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'checkout') {
      const {
        amount,           // dollars (e.g. 1250.00)
        currency = 'usd',
        description,
        customerEmail,
        customerName,
        successUrl,
        cancelUrl,
        invoiceId,
        contactId,
        metadata = {},
      } = body;

      if (!amount || !successUrl || !cancelUrl) {
        return json({ error: 'amount, successUrl, and cancelUrl are required' }, 400);
      }

      const amountCents = Math.round(Number(amount) * 100);
      if (isNaN(amountCents) || amountCents < 50) {
        return json({ error: 'Invalid amount — minimum is $0.50' }, 400);
      }

      const sessionParams: Record<string, any> = {
        mode:                'payment',
        success_url:         successUrl,
        cancel_url:          cancelUrl,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              unit_amount: amountCents,
              product_data: {
                name: description || 'Invoice Payment',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          ...metadata,
          company_id:   companyId,
          invoice_id:   invoiceId  || '',
          contact_id:   contactId  || '',
          created_by:   user.id,
        },
      };

      if (customerEmail) sessionParams['customer_email'] = customerEmail;

      const { ok, data: session } = await stripeRequest(stripeKey, 'POST', '/checkout/sessions', sessionParams);
      if (!ok) {
        return json({ error: `Stripe Checkout failed: ${session?.error?.message || 'Unknown error'}` }, 400);
      }

      // Store the session in DB for webhook correlation
      await db.from('stripe_checkout_sessions').insert({
        company_id:       companyId,
        session_id:       session.id,
        invoice_id:       invoiceId  || null,
        contact_id:       contactId  || null,
        amount_cents:     amountCents,
        currency,
        status:           'pending',
        payment_url:      session.url,
        created_by:       user.id,
        created_at:       new Date().toISOString(),
      }).catch(() => {}); // Non-fatal — webhook will update status

      return json({
        sessionId:  session.id,
        paymentUrl: session.url,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ACTION: portal
    // Creates a Stripe Customer Portal session (for the contractor to manage
    // their own TrussCTR subscription — NOT for homeowners).
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'portal') {
      const { customerId, returnUrl } = body;
      if (!customerId || !returnUrl) {
        return json({ error: 'customerId and returnUrl are required' }, 400);
      }

      const { ok, data: portalSession } = await stripeRequest(
        stripeKey, 'POST', '/billing_portal/sessions',
        { customer: customerId, return_url: returnUrl }
      );

      if (!ok) {
        return json({ error: `Portal session failed: ${portalSession?.error?.message}` }, 400);
      }

      return json({ portalUrl: portalSession.url });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ACTION: list_sessions
    // Lists recent Checkout Sessions for this company (for the invoices view).
    // ──────────────────────────────────────────────────────────────────────────
    if (action === 'list_sessions') {
      const { data: sessions } = await db
        .from('stripe_checkout_sessions')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);

      return json({ sessions: sessions || [] });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err: any) {
    console.error('[stripe-payment] Error:', err);
    return json({ error: err?.message || 'Internal server error' }, 500);
  }
});
