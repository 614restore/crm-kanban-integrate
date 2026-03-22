import React, { useCallback, useState } from 'react';
import { CreditCard, Plus, Zap, Rocket, Building2, Star, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/authContext';
import PlanComparisonChart from './PlanComparisonChart';

// Tell TypeScript about the Stripe custom element
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'stripe-pricing-table': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        'pricing-table-id'?: string;
        'publishable-key'?: string;
        'customer-email'?: string;
        'client-reference-id'?: string;
      }, HTMLElement>;
    }
  }
}

const ADD_ONS = [
  { id: 'extra_users_5', name: '+ 5 Additional Users', price: 25, period: '/mo' },
  { id: 'extra_contacts_500', name: '+ 500 Additional Contacts', price: 15, period: '/mo' },
  { id: 'extra_contacts_export', name: 'Contact Export (one-time)', price: 10, period: '' },
];

const PRICE_IDS: Record<string, string> = {
  starter: import.meta.env.VITE_STRIPE_STARTER_MONTHLY || '',
  pro: import.meta.env.VITE_STRIPE_PRO_MONTHLY || '',
  business: import.meta.env.VITE_STRIPE_BUSINESS_MONTHLY || '',
  enterprise: import.meta.env.VITE_STRIPE_ENTERPRISE_MONTHLY || '',
};

const API_BASE: string = import.meta.env.VITE_EMAIL_API_BASE_URL || '';
const STRIPE_PRICING_TABLE_ID: string = import.meta.env.VITE_STRIPE_PRICING_TABLE_ID || '';
const STRIPE_PUBLISHABLE_KEY: string = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_BILLING_PORTAL_URL: string = import.meta.env.VITE_STRIPE_BILLING_PORTAL_URL || '';

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    icon: <Zap className="w-5 h-5 text-blue-500" />,
    accent: 'bg-blue-600 hover:bg-blue-700',
    features: ['Up to 2 users', 'Unlimited contacts', 'Core CRM features', 'Pipeline board'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 59,
    icon: <Star className="w-5 h-5 text-indigo-500" />,
    accent: 'bg-indigo-600 hover:bg-indigo-700',
    features: ['Up to 5 users', 'Insurance claim tracking', 'Supplement tracking', 'Team reporting'],
  },
  {
    key: 'business',
    name: 'Business',
    price: 99,
    icon: <Rocket className="w-5 h-5 text-emerald-500" />,
    accent: 'bg-emerald-600 hover:bg-emerald-700',
    features: ['Up to 10 users', 'AI assistant', 'Advanced analytics', 'Priority support'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 179,
    icon: <Building2 className="w-5 h-5 text-slate-600" />,
    accent: 'bg-slate-800 hover:bg-slate-900',
    features: ['Unlimited users', 'Dedicated support', 'QuickBooks sync', 'Custom onboarding'],
  },
] as const;

const BillingSettings: React.FC = () => {
  const { profile, session } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const usingHostedPricingTable = Boolean(STRIPE_PRICING_TABLE_ID && STRIPE_PUBLISHABLE_KEY);

  const openExternalBillingUrl = useCallback((url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleManageBilling = useCallback(async () => {
    setCheckoutError(null);

    if (API_BASE && session?.access_token) {
      setPortalLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/stripe-portal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to open billing portal');
        window.location.href = data.url;
        return;
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : 'Could not open billing portal. Please try again.');
      } finally {
        setPortalLoading(false);
      }
    }

    if (STRIPE_BILLING_PORTAL_URL) {
      openExternalBillingUrl(STRIPE_BILLING_PORTAL_URL);
      return;
    }

    setCheckoutError('Billing portal is not configured. Set VITE_STRIPE_BILLING_PORTAL_URL or connect the app to the Stripe portal API.');
  }, [openExternalBillingUrl, session?.access_token]);

  const handleCheckout = useCallback(async (planKey: string) => {
    setCheckoutError(null);
    const priceId = PRICE_IDS[planKey];

    if (API_BASE && priceId) {
      setLoadingPlan(planKey);
      try {
        const res = await fetch(`${API_BASE}/api/stripe-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId, planId: planKey }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
        window.location.href = data.url;
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      } finally {
        setLoadingPlan(null);
      }
      return;
    }

    await handleManageBilling();
  }, [handleManageBilling]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing &amp; Subscription</h1>
          <p className="text-sm text-gray-500 mt-1">All features included in every plan — scale at your own pace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void handleManageBilling()} className="flex items-center gap-2" disabled={portalLoading}>
            <CreditCard className="w-4 h-4" />
            {portalLoading ? 'Opening…' : 'Manage Billing'}
          </Button>
        </div>
      </div>

      {/* Stripe Pricing Table */}
      <div className="mb-10">
        {usingHostedPricingTable ? (
          <stripe-pricing-table
            pricing-table-id={STRIPE_PRICING_TABLE_ID}
            publishable-key={STRIPE_PUBLISHABLE_KEY}
            client-reference-id={profile?.company_id || undefined}
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Stripe hosted pricing table is not configured. Set `VITE_STRIPE_PRICING_TABLE_ID` and `VITE_STRIPE_PUBLISHABLE_KEY` to use it. Using the in-app checkout cards below instead.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {PLANS.map((plan) => (
                <div key={plan.key} className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    {plan.icon}
                    <span className="font-semibold text-gray-900">{plan.name}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${plan.price}<span className="text-sm font-normal text-gray-500">/mo</span>
                  </div>
                  <ul className="space-y-2 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleCheckout(plan.key)}
                    disabled={loadingPlan === plan.key}
                    className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                      plan.accent
                    } ${loadingPlan === plan.key ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loadingPlan === plan.key && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loadingPlan === plan.key ? 'Redirecting...' : 'Choose Plan'}
                  </button>
                </div>
              ))}
            </div>
            {checkoutError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {checkoutError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add-ons */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Add-Ons</h2>
        <p className="text-xs text-gray-500 mb-4">Extend your plan as your business grows.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ADD_ONS.map((addon) => (
            <div key={addon.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{addon.name}</p>
                <p className="text-xs text-gray-500">${addon.price}{addon.period}</p>
              </div>
              <button onClick={() => void handleManageBilling()} className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* TrussCTR Comparison Chart (v2) */}
      <PlanComparisonChart />

      {/* 14-day trial note */}
      <p className="text-center text-xs text-gray-400 mt-6">
        All plans include a <strong>14-day free trial</strong>. No credit card required to start. Cancel anytime.
      </p>
    </div>
  );
};

export default BillingSettings;
