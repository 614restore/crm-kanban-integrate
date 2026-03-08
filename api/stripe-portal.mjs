// api/stripe-portal.mjs
// Creates a Stripe Customer Portal session so users can manage their subscription
// Environment variables required:
//   STRIPE_SECRET_KEY  — your Stripe secret key
//   APP_URL            — your app's base URL

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

  // The customer ID should be passed from the authenticated session
  // For now, accept it from the request body or a session/auth token lookup
  const { customerId } = req.body || {};

  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required. Pass the Stripe customer ID from your auth session.' });
  }

  const appUrl = process.env.APP_URL || 'https://614restore.github.io/crm-kanban-integrate';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      // Return to app root with internal view hints so refresh always lands on a valid route.
      return_url: `${appUrl}/?view=settings&tab=billing`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    return res.status(500).json({ error: err.message });
  }
}
