// api/stripe.mjs
// Unified Stripe endpoint — replaces stripe-checkout.mjs and stripe-portal.mjs.
// Routes by `action` field in the request body:
//   action: 'checkout' — create a Checkout session (subscription purchase)
//   action: 'portal'   — create a Customer Portal session (manage/cancel subscription)

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, optionalAuth } from './_auth-middleware.mjs';

function buildPriceToPlnMap() {
  return new Map(
    [
      [process.env.VITE_STRIPE_STARTER_MONTHLY,  'starter'],
      [process.env.VITE_STRIPE_STARTER_YEARLY,   'starter'],
      [process.env.VITE_STRIPE_PRO_MONTHLY,      'pro'],
      [process.env.VITE_STRIPE_PRO_YEARLY,       'pro'],
      [process.env.VITE_STRIPE_BUSINESS_MONTHLY, 'business'],
      [process.env.VITE_STRIPE_BUSINESS_YEARLY,  'business'],
      [process.env.VITE_STRIPE_SCALE_MONTHLY,    'scale'],
      [process.env.VITE_STRIPE_SCALE_YEARLY,     'scale'],
    ].filter(([k]) => Boolean(k))
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return res.status(500).json({ error: 'APP_URL is not configured on this server.' });
  }

  const { action, ...payload } = req.body || {};
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const admin = () => createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── CHECKOUT ───────────────────────────────────────────────────────────────
  if (action === 'checkout') {
    const user = await optionalAuth(req);
    const { priceId, couponId } = payload;

    if (!priceId) return res.status(400).json({ error: 'priceId is required' });

    const priceToPlnMap = buildPriceToPlnMap();
    const resolvedPlanId = priceToPlnMap.get(priceId);
    if (!resolvedPlanId) return res.status(400).json({ error: 'Invalid price ID.' });

    // The signed-in user's company: the session is tied to it (client_reference_id,
    // read by the webhook) and its free trial decides when the first charge happens.
    let company = null;
    if (user?.id) {
      const supabase = admin();
      const { data: profileData } = await supabase
        .from('profiles').select('company_id').eq('id', user.id).single();
      if (profileData?.company_id) {
        const { data } = await supabase
          .from('companies')
          .select('id, subscription_status, trial_ends_at, stripe_customer_id')
          .eq('id', profileData.company_id)
          .single();
        company = data ?? null;
      }
    }

    // The card is saved now and first charged when the company's 7-day trial
    // ends (trial_ends_at), so the trial is the same however soon the card is
    // added. Stripe needs a trial end at least 48 hours away; with less left, or
    // no trial (already paid, cancelled or expired), the plan is charged now.
    const MIN_TRIAL_MS = 48 * 60 * 60 * 1000;
    const trialEndMs = company?.subscription_status === 'trialing' && company.trial_ends_at
      ? new Date(company.trial_ends_at).getTime()
      : 0;
    const trialEnd = trialEndMs - Date.now() >= MIN_TRIAL_MS ? Math.floor(trialEndMs / 1000) : null;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        ...(company?.stripe_customer_id
          ? { customer: company.stripe_customer_id }
          : user?.email ? { customer_email: user.email } : {}),
        ...(company?.id ? { client_reference_id: company.id } : {}),
        metadata: { planId: resolvedPlanId, priceId },
        subscription_data: {
          ...(trialEnd ? { trial_end: trialEnd } : {}),
          metadata: { planId: resolvedPlanId, priceId, ...(company?.id ? { companyId: company.id } : {}) },
        },
        // Always save a card, even though nothing is charged during the trial.
        payment_method_collection: 'always',
        ...(couponId
          ? { discounts: [{ coupon: couponId }] }
          : { allow_promotion_codes: true }),
        phone_number_collection: { enabled: true },
        tax_id_collection: { enabled: true },
        success_url: `${appUrl}/?checkout=success&plan=${resolvedPlanId}${trialEnd ? '&trial=1' : ''}`,
        cancel_url:  `${appUrl}/?checkout=cancelled`,
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('Stripe checkout error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PORTAL ─────────────────────────────────────────────────────────────────
  if (action === 'portal') {
    const user = await requireAuth(req, res);
    if (!user) return;

    const supabase = admin();

    const { data: profileData } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single();

    if (!profileData?.company_id) {
      return res.status(400).json({ error: 'Could not find your company record.' });
    }

    const { data: companyData } = await supabase
      .from('companies').select('stripe_customer_id').eq('id', profileData.company_id).single();

    const customerId = companyData?.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe subscription found for your account.' });
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        // The app has no /settings page; it opens on the home screen.
        return_url: `${appUrl}/`,
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('Stripe portal error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}. Use 'checkout' or 'portal'.` });
}
