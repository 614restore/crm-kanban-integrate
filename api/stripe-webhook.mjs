// api/stripe-webhook.mjs
// Handles Stripe webhook events to activate/deactivate subscriptions
// Environment variables required:
//   STRIPE_SECRET_KEY         — your Stripe secret key
//   STRIPE_WEBHOOK_SECRET     — webhook signing secret from Stripe Dashboard
//   SUPABASE_URL              — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (for admin writes)
//
// Webhook endpoint to register in Stripe Dashboard:
//   https://your-vercel-app.vercel.app/api/stripe-webhook
//
// Events to enable in Stripe Dashboard:
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted
//   invoice.payment_failed

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe webhook not configured' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  let event;
  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Set up Supabase admin client for updating subscription records
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const planId = session.metadata?.planId || '';

        // Store subscription info against the user (look up by Stripe customer email)
        if (session.customer_details?.email) {
          await supabase
            .from('subscriptions')
            .upsert({
              email: session.customer_details.email,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: planId,
              status: 'active',
              trial_end: session.subscription ? null : null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'email' });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await supabase
          .from('subscriptions')
          .update({
            status: sub.status,
            plan: sub.metadata?.planId || sub.items?.data?.[0]?.price?.metadata?.planId || '',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await supabase
            .from('subscriptions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription);
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object;
        // Mark trial ending soon — front-end can show a banner
        await supabase
          .from('subscriptions')
          .update({ trial_ending_soon: true, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
