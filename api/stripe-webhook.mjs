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
//   invoice.payment_succeeded

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

/** Look up the company row that owns a given Stripe customer ID. */
async function getCompanyByStripeCustomer(supabase, stripeCustomerId) {
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .limit(1)
    .single();
  return data?.id ?? null;
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

        // Prefer client_reference_id (company UUID passed from the pricing table embed).
        // Fall back to looking up the auth user by email, then their profile.
        let companyId = session.client_reference_id || null;

        if (!companyId && session.customer_details?.email) {
          // Look up auth user by email using the admin API (paginate to find the right user)
          let matchedUser = null;
          let page = 1;
          const perPage = 1000;
          while (!matchedUser) {
            const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage });
            if (listErr || !users?.length) break;
            matchedUser = users.find(
              (u) => u.email?.toLowerCase() === session.customer_details.email.toLowerCase()
            );
            if (users.length < perPage) break; // last page
            page++;
          }
          if (matchedUser) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', matchedUser.id)
                .single();
              companyId = profileData?.company_id ?? null;
          }
        }

        if (companyId) {
          await supabase
            .from('companies')
            .update({
              subscription_status: 'active',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: planId || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', companyId);
        } else {
          console.warn('checkout.session.completed: could not resolve company_id for email', session.customer_details?.email);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const companyId = await getCompanyByStripeCustomer(supabase, sub.customer);
        if (companyId) {
          await supabase
            .from('companies')
            .update({
              subscription_status: sub.status,
              plan: sub.metadata?.planId || sub.items?.data?.[0]?.price?.metadata?.planId || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', companyId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const companyId = await getCompanyByStripeCustomer(supabase, sub.customer);
        if (companyId) {
          await supabase
            .from('companies')
            .update({ subscription_status: 'canceled', updated_at: new Date().toISOString() })
            .eq('id', companyId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.customer) {
          const companyId = await getCompanyByStripeCustomer(supabase, invoice.customer);
          if (companyId) {
            await supabase
              .from('companies')
              .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
              .eq('id', companyId);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.customer) {
          const companyId = await getCompanyByStripeCustomer(supabase, invoice.customer);
          if (companyId) {
            await supabase
              .from('companies')
              .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
              .eq('id', companyId);
          }
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Informational — no action needed, the trial banner handles UI
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

