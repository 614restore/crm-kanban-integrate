// api/stripe-portal.mjs
// Creates a Stripe Customer Portal session so users can manage their subscription
// Environment variables required:
//   STRIPE_SECRET_KEY         — your Stripe secret key
//   APP_URL                   — your app's base URL
//   SUPABASE_URL              — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_auth-middleware.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate the caller — no unauthenticated access
  const user = await requireAuth(req, res);
  if (!user) return;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    console.error('APP_URL env var is not configured — cannot complete Stripe portal redirect');
    return res.status(500).json({ error: 'APP_URL is not configured on this server. Contact support.' });
  }

  // Look up the company's Stripe customer ID server-side — never trust caller-supplied customerId
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: profileData } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!profileData?.company_id) {
    return res.status(400).json({ error: 'Could not find your company record.' });
  }

  const { data: companyData } = await supabase
    .from('companies')
    .select('stripe_customer_id')
    .eq('id', profileData.company_id)
    .single();

  const customerId = companyData?.stripe_customer_id;
  if (!customerId) {
    return res.status(400).json({ error: 'No Stripe subscription found for your account.' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings?tab=billing`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    return res.status(500).json({ error: err.message });
  }
}
