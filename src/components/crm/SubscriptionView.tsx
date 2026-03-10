import React, { useEffect, useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import {
  CreditCard,
  Zap,
  Users,
  Star,
  Shield,
  ExternalLink,
  BarChart2,
  Check,
} from 'lucide-react';

const PLANS = [
  {
    key: 'starter' as const,
    name: 'Starter',
    price: 29,
    annualPrice: 24.17,
    annualTotal: 290,
    userLimit: 2,
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_live_a1lVAavUvt9xYretp7T0BHll2l5Kylc9ZosPvSYeU8AllloRXyeT78O5v0#fidkdWxOYHwnPyd1blppbHNgWjA0UT1cfGRUMXRnRHA0QTdWUWZkakR2fW90VmZzR2JzUXFxYzVuMEFddT1xNUdnQXZyRlwzTXRhcWE9NEhKaVJgVHRVR0JGbkRDR3FEbGFIMEN2ZD1rNU9ONTUzTjNnNVBzMicpJ2ZpbGBrcVdgY2B3YGtmYExhJz9rcGlpKSdmcHZxamhgd0BoZGxpJz8nb2BjY3dgfEUzNDF3YHZxandgK2ZqaCcpJ2FgY2RwaXFUcGRrcWxxfCc%2Fa3BpaSkndnBndmZ3bHVxbGprUGtsdHBga2B2dkBrZGdpYGEnP2NkaXZgeCUl',
    features: [
      'Up to 2 users',
      'Unlimited contacts',
      'Core CRM features',
      'Pipeline board',
      'Invoicing',
      'Email support',
    ],
    icon: <Zap className="w-5 h-5 text-blue-500" />,
    color: 'blue',
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: 59,
    annualPrice: 49.17,
    annualTotal: 590,
    userLimit: 5,
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_live_b13lZDaKn9TxoLZeJTVhNOc9RAPYAyttYb6IIxba59QrnkJl1we7jV7eGM#fidkdWxOYHwnPyd1blppbHNgWjA0UT1cfGRUMXRnRHA0QTdWUWZkakR2fW90VmZzR2JzUXFxYzVuMEFddT1xNUdnQXZyRlwzTXRhcWE9NEhKaVJgVHRVR0JGbkRDR3FEbGFIMEN2ZD1rNU9ONTUzTjNnNVBzMicpJ3ZwZ3Zmd2x1cWxqa1BrbHRwYGtgdnZAa2RnaWBhJz9jZGl2YHgl',
    features: [
      'Up to 5 users',
      'Unlimited contacts',
      'Full pipeline visibility',
      'Insurance claim tracking',
      'Supplement tracking',
      'Team reporting',
    ],
    icon: <Star className="w-5 h-5 text-indigo-500" />,
    highlight: true,
    color: 'indigo',
  },
  {
    key: 'business' as const,
    name: 'Business',
    price: 99,
    annualPrice: 82.50,
    annualTotal: 990,
    userLimit: 10,
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_live_a1in9NCQ6zK8m9Pk9U9X4qFeSdVYrGaVrQ9vI95lJ8MfrxxUbcGCflWLi5#fidkdWxOYHwnPyd1blppbHNgWjA0UT1cfGRUMXRnRHA0QTdWUWZkakR2fW90VmZzR2JzUXFxYzVuMEFddT1xNUdnQXZyRlwzTXRhcWE9NEhKaVJgVHRVR0JGbkRDR3FEbGFIMEN2ZD1rNU9ONTUzTjNnNVBzMicpJ2ZpbGBrcVdgY2B3YGtmYExhJz9rcGlpKSdmcHZxamhgd0BoZGxpJz8nb2BjY3dgfEUzNDF3YHZxandgK2ZqaCcpJ2FgY2RwaXFUcGRrcWxxfCc%2Fa3BpaSkndnBndmZ3bHVxbGprUGtsdHBga2B2dkBrZGdpYGEnP2NkaXZgeCUl',
    features: [
      'Up to 10 users',
      'Unlimited contacts',
      'AI assistant',
      'Advanced analytics',
      'Material order templates',
      'Priority support',
    ],
    icon: <Shield className="w-5 h-5 text-emerald-500" />,
    color: 'emerald',
  },
  {
    key: 'enterprise' as const,
    name: 'Enterprise',
    price: 179,
    annualPrice: 149.17,
    annualTotal: 1790,
    userLimit: Infinity,
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_live_a1MQMNSLfrqdeCjmXx3EGEirNW9EhSEFzXxbaOUtOkFw09ZWR88FayUx0A#fidkdWxOYHwnPyd1blppbHNgWjA0UT1cfGRUMXRnRHA0QTdWUWZkakR2fW90VmZzR2JzUXFxYzVuMEFddT1xNUdnQXZyRlwzTXRhcWE9NEhKaVJgVHRVR0JGbkRDR3FEbGFIMEN2ZD1rNU9ONTUzTjNnNVBzMicpJ2ZpbGBrcVdgY2B3YGtmYExhJz9rcGlpKSdmcHZxamhgd0BoZGxpJz8nb2BjY3dgfEUzNDF3YHZxandgK2ZqaCcpJ2FgY2RwaXFUcGRrcWxxfCc%2Fa3BpaSkndnBndmZ3bHVxbGprUGtsdHBga2B2dkBrZGdpYGEnP2NkaXZgeCUl',
    features: [
      'Unlimited users',
      'Unlimited contacts',
      'All features included',
      'Custom onboarding',
      'Dedicated support',
      'QuickBooks sync',
    ],
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

export default function SubscriptionView() {
  const { state } = useCRM();
  const { profile } = useAuth();
  const [company, setCompany] = useState<DbCompany | null>(null);

  useEffect(() => {
    const companyId = profile?.company_id || state.companyId;
    if (!companyId) return;
    db.getCompany(companyId).then((c) => { if (c) setCompany(c); });
  }, [profile?.company_id, state.companyId]);

  const plan = company?.subscription_plan ?? 'trial';
  const status = company?.subscription_status ?? 'trialing';
  const daysLeft = trialDaysRemaining(company?.trial_ends_at);
  const userCount = state.teamMembers.length || 1;

  function handleManageBilling() {
    const a = document.createElement('a');
    a.href = 'https://billing.stripe.com/p/login/aFa9AVb73faq5vsfmw6Na00';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

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
              {plan === 'trial'
                ? 'Free Trial'
                : `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`}
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
            onClick={handleManageBilling}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Manage Billing
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

      {/* Comparison chart callout */}
      <a
        href="/crm-user-tier-comparison.html"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-4 px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
            <BarChart2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">How does TrussCTR compare?</p>
            <p className="text-xs text-blue-600 mt-0.5">See how our plans stack up against AccuLynx, JobNimbus, Roofr &amp; more</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-medium text-blue-600 group-hover:text-blue-700 whitespace-nowrap">
          View chart
          <ExternalLink className="w-4 h-4" />
        </div>
      </a>

      {/* Custom pricing grid */}
      <div>
        <h4 className="text-base font-semibold text-gray-900 mb-4">Available Plans</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.key}
              className={`relative rounded-xl border-2 p-5 flex flex-col gap-4 transition-shadow hover:shadow-md ${
                highlightColors[p.color]
              }`}
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
                <div className="text-2xl font-bold text-gray-900">${p.price}<span className="text-sm font-normal text-gray-500">/mo</span></div>
                <div className="text-xs text-gray-500 mt-0.5">${p.annualPrice}/mo annual (${p.annualTotal.toLocaleString()}/yr)</div>
              </div>
              <ul className="space-y-1.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                    <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={p.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full text-center py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors ${btnColors[p.color]} ${
                  plan === p.key ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {plan === p.key ? 'Current Plan' : 'Get Started'}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
