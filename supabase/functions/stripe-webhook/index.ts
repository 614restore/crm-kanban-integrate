import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

// Stripe webhook (Supabase copy). The web app's /api/stripe-webhook on Vercel
// does the same job; keep the two in step, as Stripe may be pointed at either.

const getSupabaseAdmin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';

const mapStripeStatus = (status: string): SubscriptionStatus => {
  const map: Record<string, SubscriptionStatus> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    paused: 'paused',
    incomplete: 'past_due',
    incomplete_expired: 'canceled',
  };
  return map[status] ?? 'canceled';
};

const planFromPriceId = (priceId: string, metadata?: Record<string, string>): string | null => {
  // Checkout (api/stripe.mjs) stores the plan as planId; older sessions used plan.
  if (metadata?.planId) return metadata.planId;
  if (metadata?.plan) return metadata.plan;
  // Fall back to env-based mapping
  const starterPriceId = Deno.env.get('STRIPE_STARTER_PRICE_ID');
  const proPriceId = Deno.env.get('STRIPE_PRO_PRICE_ID');
  const enterprisePriceId = Deno.env.get('STRIPE_ENTERPRISE_PRICE_ID');
  if (priceId === starterPriceId) return 'starter';
  if (priceId === proPriceId) return 'pro';
  if (priceId === enterprisePriceId) return 'enterprise';
  return null;
};

/** The subscription's trial end, saved so the app shows when the first charge happens. */
const trialFields = (sub: Stripe.Subscription) =>
  sub.trial_end ? { trial_ends_at: new Date(sub.trial_end * 1000).toISOString() } : {};

serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      return new Response('Missing stripe-signature', { status: 400 });
    }

    // Must use raw bytes for signature verification
    const body = await req.arrayBuffer();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response('Invalid signature', { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Idempotency: skip already-processed events
    const { data: existing } = await supabase
      .from('billing_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    let companyId: string | null = null;
    let updateData: Record<string, unknown> = {};

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        // The checkout is tied to the company (client_reference_id, or the
        // subscription's metadata); else match a company by its Stripe customer.
        companyId =
          session.client_reference_id ??
          (sub.metadata as Record<string, string>)?.companyId ??
          (sub.metadata as Record<string, string>)?.company_id ??
          null;
        if (!companyId && session.customer) {
          const { data: co } = await supabase
            .from('companies')
            .select('id')
            .eq('stripe_customer_id', session.customer)
            .single();
          companyId = co?.id ?? null;
        }
        const priceId = sub.items.data[0]?.price.id ?? '';
        updateData = {
          stripe_customer_id: session.customer,
          stripe_subscription_id: sub.id,
          // 'trialing' while a card saved at sign-up waits for the trial to end.
          subscription_status: mapStripeStatus(sub.status),
          subscription_plan: planFromPriceId(priceId, sub.metadata as Record<string, string>),
          subscription_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          ...trialFields(sub),
        };
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const { data: co } = await supabase
          .from('companies')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .single();
        companyId = co?.id ?? null;
        const priceId = sub.items.data[0]?.price.id ?? '';
        updateData = {
          stripe_subscription_id: sub.id,
          subscription_status: mapStripeStatus(sub.status),
          subscription_plan: planFromPriceId(priceId, sub.metadata as Record<string, string>),
          subscription_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          ...trialFields(sub),
        };
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const { data: co } = await supabase
          .from('companies')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .single();
        companyId = co?.id ?? null;
        updateData = {
          subscription_status: 'canceled',
          stripe_subscription_id: null,
          subscription_plan: null,
          subscription_period_end: null,
        };
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const { data: co } = await supabase
          .from('companies')
          .select('id')
          .eq('stripe_customer_id', invoice.customer)
          .single();
        companyId = co?.id ?? null;
        updateData = { subscription_status: 'past_due' };
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        // Starting a free trial produces a $0 invoice; the company is still
        // trialing (customer.subscription.updated reports when it turns active).
        if (!invoice.amount_paid) break;
        const { data: co } = await supabase
          .from('companies')
          .select('id')
          .eq('stripe_customer_id', invoice.customer)
          .single();
        companyId = co?.id ?? null;
        updateData = { subscription_status: 'active' };
        break;
      }
    }

    if (companyId && Object.keys(updateData).length > 0) {
      await supabase.from('companies').update(updateData).eq('id', companyId);
    }

    // Record event for audit log
    if (companyId) {
      await supabase.from('billing_events').insert({
        company_id: companyId,
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event.data.object as Record<string, unknown>,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('stripe-webhook error:', message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
