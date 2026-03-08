import React from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Tell TypeScript about the Stripe custom element
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'stripe-pricing-table': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        'pricing-table-id'?: string;
        'publishable-key'?: string;
        'customer-email'?: string;
      }, HTMLElement>;
    }
  }
}

// Stripe Price IDs — fill these in from your Stripe Dashboard after creating products
const STRIPE_PRICES = {
  starter_monthly: import.meta.env.VITE_STRIPE_STARTER_MONTHLY || '',
  starter_yearly: import.meta.env.VITE_STRIPE_STARTER_YEARLY || '',
  pro_monthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY || '',
  pro_yearly: import.meta.env.VITE_STRIPE_PRO_YEARLY || '',
  business_monthly: import.meta.env.VITE_STRIPE_BUSINESS_MONTHLY || '',
  business_yearly: import.meta.env.VITE_STRIPE_BUSINESS_YEARLY || '',
  enterprise_monthly: import.meta.env.VITE_STRIPE_ENTERPRISE_MONTHLY || '',
  enterprise_yearly: import.meta.env.VITE_STRIPE_ENTERPRISE_YEARLY || '',
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    color: 'blue',
    description: 'Perfect for solo contractors or small teams just getting started.',
    monthlyPrice: 29,
    yearlyPrice: 290,
    users: 2,
    contacts: 100,
    features: [
      'Up to 2 users',
      'Up to 100 active contacts',
      'CRM & Kanban pipeline',
      'Job & work order management',
      'Document templates',
      'Insurance claims tracking',
      'Email & SMS notifications',
      'Mobile-friendly interface',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Rocket,
    color: 'purple',
    description: 'For growing roofing companies ready to scale operations.',
    monthlyPrice: 69,
    yearlyPrice: 690,
    users: 5,
    contacts: 500,
    popular: true,
    features: [
      'Up to 5 users',
      'Up to 500 active contacts',
      'Everything in Starter',
      'Supplement tracking',
      'Material order management',
      'Sales metrics & reporting',
      'PDF export for reports',
      'Calendar & scheduling',
      'AI assistant',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    icon: Building2,
    color: 'green',
    description: 'For established roofing businesses managing large teams and high volume.',
    monthlyPrice: 129,
    yearlyPrice: 1290,
    users: 15,
    contacts: 2000,
    features: [
      'Up to 15 users',
      'Up to 2,000 active contacts',
      'Everything in Pro',
      'Team performance metrics',
      'Individual sales rep dashboards',
      'Advanced QuickBooks integration',
      'HailTrace weather integration',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: Star,
    color: 'orange',
    description: 'For large roofing enterprises with unlimited scale and dedicated support.',
    monthlyPrice: 249,
    yearlyPrice: 2490,
    users: 'Unlimited',
    contacts: 'Unlimited',
    features: [
      'Unlimited users',
      'Unlimited contacts',
      'Everything in Business',
      'Custom integrations',
      'White-label options',
      'Dedicated account manager',
      'Custom onboarding',
      'SLA guarantee',
    ],
  },
];

const ADD_ONS = [
  { id: 'extra_users_5', name: '+ 5 Additional Users', price: 25, period: '/mo' },
  { id: 'extra_contacts_500', name: '+ 500 Additional Contacts', price: 15, period: '/mo' },
  { id: 'extra_contacts_export', name: 'Contact Export (one-time)', price: 10, period: '' },
];

const colorMap: Record<string, string> = {
  blue: 'border-blue-500 bg-blue-50',
  purple: 'border-purple-500 bg-purple-50',
  green: 'border-green-500 bg-green-50',
  orange: 'border-orange-500 bg-orange-50',
};

const iconColorMap: Record<string, string> = {
  blue: 'text-blue-600 bg-blue-100',
  purple: 'text-purple-600 bg-purple-100',
  green: 'text-green-600 bg-green-100',
  orange: 'text-orange-600 bg-orange-100',
};

const buttonColorMap: Record<string, string> = {
  blue: 'bg-blue-600 hover:bg-blue-700',
  purple: 'bg-purple-600 hover:bg-purple-700',
  green: 'bg-green-600 hover:bg-green-700',
  orange: 'bg-orange-600 hover:bg-orange-700',
};

const BillingSettings: React.FC = () => {
  const apiBase = import.meta.env.VITE_EMAIL_API_BASE_URL || '';

  const handleManageBilling = async () => {
    try {
      const res = await fetch(`${apiBase}/api/stripe-portal`, { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert('Could not open billing portal.');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-sm text-gray-500 mt-1">All features included in every plan — scale at your own pace.</p>
        </div>
        <Button variant="outline" onClick={handleManageBilling} className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Manage Billing
        </Button>
      </div>

      {/* Stripe Pricing Table — handles all checkout securely */}
      <div className="mb-10">
        <stripe-pricing-table
          pricing-table-id="prctbl_1T8ahXQ4qbAu1D2SCifFughX"
          publishable-key="pk_live_51T8YyaQ4qbAu1D2STcaoAsxjqScvBgvTttf0k5DXp8t0BbDswCY6Hqdtd81MOlWeQqPBGCkAFBtAidM5Fsa8n0JK006K6b0Uv7"
        />
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
              <button className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 14-day trial note */}
      <p className="text-center text-xs text-gray-400 mt-6">
        All plans include a <strong>14-day free trial</strong>. No credit card required to start. Cancel anytime.
      </p>
    </div>
  );
};

export default BillingSettings;
