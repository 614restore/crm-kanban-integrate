// Stripe checkout and billing portal, shared by the Subscription page and the
// card step new companies go through before their free trial starts.

// Price IDs come from Vite env vars (set in Vercel dashboard for live, .env.local for dev)
export const PRICE_IDS: Record<string, string> = {
  starter:    import.meta.env.VITE_STRIPE_STARTER_MONTHLY  || '',
  pro:        import.meta.env.VITE_STRIPE_PRO_MONTHLY      || '',
  business:   import.meta.env.VITE_STRIPE_BUSINESS_MONTHLY || '',
  enterprise: import.meta.env.VITE_STRIPE_ENTERPRISE_MONTHLY || '',
};

// Vercel API base; empty means the same site the app is served from.
export const API_BASE: string = import.meta.env.VITE_EMAIL_API_BASE_URL || '';

async function post(body: Record<string, unknown>, accessToken?: string | null): Promise<string> {
  const res = await fetch(`${API_BASE}/api/stripe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data.url as string;
}

/**
 * Opens Stripe Checkout for a plan. Signed in, the checkout is tied to your
 * company and, during the free trial, saves the card without charging it
 * until the trial ends.
 */
export async function startCheckout(planKey: string, accessToken?: string | null) {
  const priceId = PRICE_IDS[planKey];
  if (!priceId) throw new Error('This plan is not available to buy online yet. Please contact us.');
  window.location.href = await post({ action: 'checkout', priceId, planId: planKey }, accessToken);
}

/** Opens the Stripe billing portal: change plan, update the card, or cancel. */
export async function openBillingPortal(accessToken: string) {
  window.location.href = await post({ action: 'portal' }, accessToken);
}
