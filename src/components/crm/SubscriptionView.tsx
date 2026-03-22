// Subscription view — pricing table loaded from VITE_STRIPE_PRICING_TABLE_ID
import React, { useEffect, useRef, useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import {
  CreditCard,
  ChevronDown,
} from 'lucide-react';

const STRIPE_PRICING_TABLE_ID = import.meta.env.VITE_STRIPE_PRICING_TABLE_ID || '';
const STRIPE_PUBLISHABLE_KEY  = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY  || '';

// Stripe pricing table web component type declaration
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'stripe-pricing-table': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        'pricing-table-id'?: string;
        'publishable-key'?: string;
        'client-reference-id'?: string;
        'customer-email'?: string;
      }, HTMLElement>;
    }
  }
}


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

// Resolves the correct URL for a public asset regardless of Vite base path
const chartSrc = `${import.meta.env.BASE_URL}crm-user-tier-comparison.html`.replace('//', '/');

export default function SubscriptionView() {
  const { state } = useCRM();
  const { profile } = useAuth();
  const [company, setCompany] = useState<DbCompany | null>(null);
  const [chartVisible, setChartVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const companyId = profile?.company_id || state.companyId;
    if (!companyId) return;
    db.getCompany(companyId).then((c) => { if (c) setCompany(c); });
  }, [profile?.company_id, state.companyId]);

  useEffect(() => {
    // Load Stripe pricing table script
    if (!document.querySelector('script[src="https://js.stripe.com/v3/pricing-table.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/pricing-table.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

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

  function handleManageBilling() {
    const a = document.createElement('a');
    a.href = 'https://billing.stripe.com/p/login/aFa9AVb73faq5vsfmw6Na00';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

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
            onClick={handleManageBilling}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Manage Billing
          </button>
        </div>

      </div>

      {/* Stripe Pricing Table */}
      <div>
        <h4 className="text-base font-semibold text-gray-900 mb-4">Available Plans</h4>
        <stripe-pricing-table
          pricing-table-id={STRIPE_PRICING_TABLE_ID}
          publishable-key={STRIPE_PUBLISHABLE_KEY}
          client-reference-id={profile?.company_id ?? undefined}
          customer-email={profile?.email ?? undefined}
        />
      </div>

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
