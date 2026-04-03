// api/stripe-checkout.mjs
// Creates a Stripe Checkout session for a given price ID
// Environment variables required:
//   STRIPE_SECRET_KEY  — your Stripe secret key (sk_live_... or sk_test_...)
//   APP_URL            — your app's base URL (e.g. https://614restore.github.io/crm-kanban-integrate)

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  const { priceId, planId, couponId } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'priceId is required' });
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
      subscription_data: {
        trial_period_days: 14,
        metadata: { planId: planId || '' },
      },
      // If a couponId is passed, apply it directly (disables the promo code field to avoid double-dipping)
      ...(couponId
        ? { discounts: [{ coupon: couponId }] }
        : { allow_promotion_codes: true }),
      phone_number_collection: { enabled: true },
      tax_id_collection: { enabled: true },
      success_url: `${appUrl}/?checkout=success&plan=${planId}`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
}
