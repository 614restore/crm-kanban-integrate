// api/stripe-checkout.mjs
// Creates a Stripe Checkout session for a given price ID
// Environment variables required:
//   STRIPE_SECRET_KEY  — your Stripe secret key (sk_live_... or sk_test_...)
//   APP_URL            — your app's base URL (e.g. https://crm-kanban-integrate.vercel.app)

import Stripe from 'stripe';
import { requireAuth } from './_auth-middleware.mjs';

/**
 * Build a server-side price ID → plan name map from env vars.
 * This is the ONLY source of truth for plan names — the client's planId
 * is intentionally ignored to prevent price/plan manipulation.
 */
function buildPriceToPlnMap() {
  return new Map(
    [
      [process.env.VITE_STRIPE_STARTER_MONTHLY,    'starter'],
      [process.env.VITE_STRIPE_STARTER_YEARLY,     'starter'],
      [process.env.VITE_STRIPE_PRO_MONTHLY,        'pro'],
      [process.env.VITE_STRIPE_PRO_YEARLY,         'pro'],
      [process.env.VITE_STRIPE_BUSINESS_MONTHLY,   'business'],
      [process.env.VITE_STRIPE_BUSINESS_YEARLY,    'business'],
      [process.env.VITE_STRIPE_SCALE_MONTHLY,      'scale'],
      [process.env.VITE_STRIPE_SCALE_YEARLY,       'scale'],
    ].filter(([k]) => Boolean(k))
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  // Only read priceId and couponId from the client — planId is NEVER trusted from the client.
  const { priceId, couponId } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'priceId is required' });
  }

  // Derive the plan name server-side from the price ID map.
  // If the priceId is not in our map, it is not a valid plan price — reject it.
  const priceToPlnMap = buildPriceToPlnMap();
  const resolvedPlanId = priceToPlnMap.get(priceId);

  if (!resolvedPlanId) {
    return res.status(400).json({ error: 'Invalid price ID.' });
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    console.error('APP_URL env var is not configured — cannot complete Stripe checkout redirect');
    return res.status(500).json({ error: 'APP_URL is not configured on this server. Contact support.' });
  }

  try {
    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      // Store the server-derived plan name at both the session level (readable
      // immediately in checkout.session.completed) and the subscription level
      // (readable in all future subscription events). Never trust client-supplied values.
      metadata: { planId: resolvedPlanId, priceId },
      subscription_data: {
        trial_period_days: 14,
        metadata: { planId: resolvedPlanId, priceId },
      },
      // If a couponId is passed, apply it directly (disables the promo code field to avoid double-dipping)
      ...(couponId
        ? { discounts: [{ coupon: couponId }] }
        : { allow_promotion_codes: true }),
      phone_number_collection: { enabled: true },
      tax_id_collection: { enabled: true },
      success_url: `${appUrl}/?checkout=success&plan=${resolvedPlanId}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
}
