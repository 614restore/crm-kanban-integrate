import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import {
  CreditCard,
  Zap,
  Users,
  Star,
  Shield,
  Check,
  ChevronDown,
  Loader2,
} from 'lucide-react';

// Price IDs come from Vite env vars (set in Vercel dashboard for live, .env.local for dev)
const PRICE_IDS: Record<string, string> = {
  starter:    import.meta.env.VITE_STRIPE_STARTER_MONTHLY  || '',
  pro:        import.meta.env.VITE_STRIPE_PRO_MONTHLY      || '',
  business:   import.meta.env.VITE_STRIPE_BUSINESS_MONTHLY || '',
  enterprise: import.meta.env.VITE_STRIPE_ENTERPRISE_MONTHLY || '',
};

// Vercel API base (empty on GitHub Pages static hosting — falls back to billing portal)
const API_BASE: string = import.meta.env.VITE_EMAIL_API_BASE_URL || '';
const STRIPE_BILLING_PORTAL_URL: string = import.meta.env.VITE_STRIPE_BILLING_PORTAL_URL || '';

const PLANS = [
  {
    key: 'starter' as const,
    name: 'Starter',
    price: 59,
    annualPrice: 49.17,
    annualTotal: 590,
    userLimit: 2,
    features: ['Up to 2 users','Unlimited contacts','Core CRM features','Pipeline board','Invoicing','Email support'],
    icon: <Zap className="w-5 h-5 text-blue-500" />,
    color: 'blue',
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: 119,
    annualPrice: 99.17,
    annualTotal: 1190,
    userLimit: 5,
    features: ['Up to 5 users','Unlimited contacts','Full pipeline visibility','Insurance claim tracking','Supplement tracking','Team reporting'],
    icon: <Star className="w-5 h-5 text-indigo-500" />,
    highlight: true,
    color: 'indigo',
  },
  {
    key: 'business' as const,
    name: 'Business',
    price: 229,
    annualPrice: 190.83,
    annualTotal: 2290,
    userLimit: 10,
    features: ['Up to 10 users','Unlimited contacts','AI assistant','Advanced analytics','Material order templates','Priority support'],
    icon: <Shield className="w-5 h-5 text-emerald-500" />,
    color: 'emerald',
  },
  {
    key: 'enterprise' as const,
    name: 'Scale',
    price: 399,
    annualPrice: 332.50,
    annualTotal: 3990,
    userLimit: Infinity,
    features: ['Unlimited users','Unlimited contacts','All features included','Custom onboarding','Dedicated support','QuickBooks sync'],
    icon: <Users className="w-5 h-5 text-purple-500" />,
    color: 'purple',
  },
];

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const map: Record<string, { label: string; className: string }> = {
    active:   { label: 'Active',    className: 'bg-green-100 text-green-700' },
    trialing: { label: 'Trialing',  className: 'bg-yellow-100 text-yellow-700' },
    past_due: { label: 'Past Due',  className: 'bg-red-100 text-red-700' },
    canceled: { label: 'Canceled',  className: 'bg-gray-100 text-gray-600' },
  };
  const { label, className } = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function trialDaysRemaining(trialEndsAt?: string): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// Resolve to an absolute app-root path so iframe loading is stable across web + mobile shells.
function buildChartSrc(): string {
  const rawBase = import.meta.env.BASE_URL || '/';
  const withLeadingSlash = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  const normalizedBase = withLeadingSlash.replace(/\/{2,}/g, '/').replace(/\/?$/, '/');
  return `${normalizedBase}crm-user-tier-comparison.html`;
}

const chartSrc = buildChartSrc();

export default function SubscriptionView() {
  const { state } = useCRM();
  const { profile, session } = useAuth();
  const [company, setCompany] = useState<DbCompany | null>(null);
  const [chartVisible, setChartVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const companyId = profile?.company_id || state.companyId;
    if (!companyId) return;
    db.getCompany(companyId).then((c) => { if (c) setCompany(c); });
  }, [profile?.company_id, state.companyId]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setChartVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const plan = company?.subscription_plan ?? 'trial';
  const status = company?.subscription_status ?? 'trialing';
  const daysLeft = trialDaysRemaining(company?.trial_ends_at);
  const userCount = state.teamMembers.length || 1;

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
<<<<<<< HEAD
        const res = await fetch(`${API_BASE}/api/stripe`, {
=======
        const res = await fetch(`${API_BASE}/api/stripe-portal`, {
>>>>>>> dcbcf53 (Fix Stripe billing table and portal config)
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
<<<<<<< HEAD
          body: JSON.stringify({ action: 'portal' }),
=======
>>>>>>> dcbcf53 (Fix Stripe billing table and portal config)
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

    // If we have an API base and a priceId, create a fresh Stripe session
    if (API_BASE && priceId) {
      setLoadingPlan(planKey);
      try {
        const res = await fetch(`${API_BASE}/api/stripe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'checkout', priceId, planId: planKey }),
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

    // Fallback: send user to the Stripe billing portal to subscribe
    await handleManageBilling();
  }, [handleManageBilling]);

  const highlightColors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50',
    indigo: 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-400',
    emerald: 'border-emerald-200 bg-emerald-50',
    purple: 'border-purple-200 bg-purple-50',
  };

  const btnColors: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    indigo: 'bg-indigo-600 hover:bg-indigo-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
  };

  return (
    <div className="space-y-6">

      {/* Current plan header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-1">
              {plan === 'trial' ? 'Free Trial' : `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`}
            </h3>
            <div className="flex items-center gap-2">
              <StatusBadge status={status} />
              {status === 'trialing' && daysLeft !== null && (
                <span className="text-sm text-yellow-700 font-medium">
                  {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining in your trial
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => void handleManageBilling()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            {portalLoading ? 'Opening…' : 'Manage Billing'}
          </button>
        </div>

        {plan !== 'trial' && (() => {
          const current = PLANS.find((p) => p.key === plan);
          if (!current) return null;
          const userLimitLabel = current.userLimit === Infinity ? '\u221e' : String(current.userLimit);
          const userPct = current.userLimit === Infinity ? 0 : Math.min(100, (userCount / current.userLimit) * 100);
          return (
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Users</span>
                  <span className="font-medium text-gray-900">{userCount} / {userLimitLabel}</span>
                </div>
                {current.userLimit !== Infinity && (
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${userPct}%` }} />
                  </div>
                )}
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Contacts</span>
                  <span className="font-medium text-gray-900">Unlimited</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Pricing grid */}
      <div>
        <h4 className="text-base font-semibold text-gray-900 mb-4">Available Plans</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.key}
              className={`relative rounded-xl border-2 p-5 flex flex-col gap-4 transition-shadow hover:shadow-md ${highlightColors[p.color]}`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                  Most Popular
                </div>
              )}
              <div className="flex items-center gap-2">
                {p.icon}
                <span className="font-semibold text-gray-900 text-sm">{p.name}</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  ${p.price}<span className="text-sm font-normal text-gray-500">/mo</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  ${p.annualPrice}/mo annual (${p.annualTotal.toLocaleString()}/yr)
                </div>
              </div>
              <ul className="space-y-1.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                    <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(p.key)}
                disabled={plan === p.key || loadingPlan === p.key}
                className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors ${btnColors[p.color]} ${
                  (plan === p.key || loadingPlan === p.key) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loadingPlan === p.key && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {plan === p.key ? 'Current Plan' : loadingPlan === p.key ? 'Redirecting…' : 'Get Started'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Checkout error banner */}
      {checkoutError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {checkoutError}
        </div>
      )}

      {/* Scroll-down banner + embedded comparison chart */}
      <div ref={chartRef} className="space-y-3">
        <div
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold tracking-wide shadow transition-all duration-700 ${
            chartVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <ChevronDown className="w-4 h-4 animate-bounce" />
          SCROLL DOWN TO COMPARE FEATURES
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>

        <div className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <iframe
            src={chartSrc}
            title="TrussCTR Plan Feature Comparison"
            className="w-full"
            style={{ height: '900px', border: 'none' }}
            loading="lazy"
          />
        </div>
      </div>

    </div>
  );
}
