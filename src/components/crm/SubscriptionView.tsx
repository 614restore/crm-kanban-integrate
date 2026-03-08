import React, { useEffect, useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db, DbCompany } from '@/lib/database';
import { toast } from 'sonner';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  Users,
  ArrowRight,
  Star,
} from 'lucide-react';

const PLANS = [
  {
    key: 'starter' as const,
    name: 'Starter',
    price: 49,
    userLimit: 3,
    contactLimit: 100,
    features: [
      'Up to 3 users',
      '100 contacts',
      'Core CRM features',
      'Pipeline board',
      'Invoicing',
      'Email support',
    ],
    icon: <Zap className="w-5 h-5 text-blue-500" />,
  },
  {
    key: 'professional' as const,
    name: 'Professional',
    price: 99,
    userLimit: 10,
    contactLimit: Infinity,
    features: [
      'Up to 10 users',
      'Unlimited contacts',
      'All features',
      'AI assistant',
      'Automations',
      'Priority email support',
    ],
    icon: <Star className="w-5 h-5 text-indigo-500" />,
    highlight: true,
  },
  {
    key: 'enterprise' as const,
    name: 'Enterprise',
    price: 199,
    userLimit: Infinity,
    contactLimit: Infinity,
    features: [
      'Unlimited users',
      'Unlimited contacts',
      'All features',
      'QuickBooks sync',
      'Priority support',
      'Dedicated onboarding',
    ],
    icon: <Users className="w-5 h-5 text-purple-500" />,
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

  const contactCount = state.contacts.length;
  const userCount = state.teamMembers.length || 1;

  const currentPlanIndex = PLANS.findIndex((p) => p.key === plan);

  function handleManageBilling() {
    // Use anchor navigation to avoid popup blocker issues
    const a = document.createElement('a');
    a.href = 'https://billing.stripe.com/p/login/aFa9AVb73faq5vsfmw6Na00';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handlePlanAction(_planKey: string) {
    // Scroll to the Stripe pricing table below
    document.querySelector('stripe-pricing-table')?.scrollIntoView({ behavior: 'smooth' });
  }

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

        {/* Usage stats */}
        {plan !== 'trial' && (
          <div className="mt-5 grid grid-cols-2 gap-4">
            {(() => {
              const current = PLANS.find((p) => p.key === plan);
              if (!current) return null;
              const userLimitLabel = current.userLimit === Infinity ? '∞' : String(current.userLimit);
              const contactLimitLabel = current.contactLimit === Infinity ? '∞' : String(current.contactLimit);
              const userPct = current.userLimit === Infinity ? 0 : Math.min(100, (userCount / current.userLimit) * 100);
              const contactPct = current.contactLimit === Infinity ? 0 : Math.min(100, (contactCount / current.contactLimit) * 100);
              return (
                <>
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
                      <span className="font-medium text-gray-900">{contactCount} / {contactLimitLabel}</span>
                    </div>
                    {current.contactLimit !== Infinity && (
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${contactPct}%` }} />
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Stripe Pricing Table */}
      <div>
        <h4 className="text-base font-semibold text-gray-900 mb-4">Available Plans</h4>
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-x-auto">
          {/* @ts-expect-error stripe-pricing-table is a custom element */}
          <stripe-pricing-table
            pricing-table-id="prctbl_1T8ahXQ4qbAu1D2SCifFughX"
            publishable-key="pk_live_51T8YyaQ4qbAu1D2STcaoAsxjqScvBgvTttf0k5DXp8t0BbDswCY6Hqdtd81MOlWeQqPBGCkAFBtAidM5Fsa8n0JK006K6b0Uv7"
            customer-email={profile?.email ?? ''}
          />
        </div>
      </div>
    </div>
  );
}
