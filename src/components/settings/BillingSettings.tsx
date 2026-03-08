import React, { useState } from 'react';
import { CreditCard, Plus, Zap, Rocket, Building2, Star, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
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
    monthlyPrice: 59,
    yearlyPrice: 590,
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
    monthlyPrice: 99,
    yearlyPrice: 990,
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
    monthlyPrice: 179,
    yearlyPrice: 1790,
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

const COMPARISON_SECTIONS = [
  {
    category: '📋 CRM & Contact Management',
    rows: [
      { feature: 'Contact Management', trussctr: '✅ Full', jobNimbus: '✅ Full', acculynx: '✅ Full', hatch: '✅ Full', serviceTitan: '✅ Full', roofr: '⚠️ Limited' },
      { feature: 'Custom Pipeline / Kanban Board', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '✅', roofr: '⚠️' },
      { feature: 'Lead & Opportunity Tracking', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '✅', serviceTitan: '✅', roofr: '✅' },
      { feature: 'Job Status Progression', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '✅', roofr: '⚠️' },
    ],
  },
  {
    category: '📄 Documents & Contracts',
    rows: [
      { feature: 'Proposal Templates', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '✅', roofr: '✅' },
      { feature: 'Contract w/ Signature Fields', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '✅', roofr: '✅' },
      { feature: '3-Day Right to Cancel Notice', trussctr: '✅', jobNimbus: '❌', acculynx: '❌', hatch: '❌', serviceTitan: '❌', roofr: '❌' },
      { feature: 'Per-Customer Editable Templates', trussctr: '✅', jobNimbus: '⚠️', acculynx: '⚠️', hatch: '❌', serviceTitan: '✅', roofr: '⚠️' },
      { feature: 'Document Upload (WO, MO, etc.)', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '✅', roofr: '⚠️' },
    ],
  },
  {
    category: '🏦 Insurance & Supplements',
    rows: [
      { feature: 'Insurance Claim Tracking', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '❌', roofr: '⚠️' },
      { feature: 'Supplement Tracking', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '❌', roofr: '❌' },
      { feature: 'Claims Linked to Customer Profile', trussctr: '✅', jobNimbus: '⚠️', acculynx: '✅', hatch: '❌', serviceTitan: '❌', roofr: '❌' },
    ],
  },
  {
    category: '📊 Sales Metrics & Reporting',
    rows: [
      { feature: 'Individual Sales Rep Metrics', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '✅', serviceTitan: '✅', roofr: '❌' },
      { feature: 'Team Performance Dashboard', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '⚠️', serviceTitan: '✅', roofr: '❌' },
      { feature: 'PDF Export for Reports', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '✅', roofr: '⚠️' },
    ],
  },
  {
    category: '🔧 Material & Work Orders',
    rows: [
      { feature: 'Material Order Management', trussctr: '✅', jobNimbus: '⚠️', acculynx: '✅', hatch: '❌', serviceTitan: '✅', roofr: '✅' },
      { feature: 'Material Templates (Asphalt, Metal, etc.)', trussctr: '✅', jobNimbus: '❌', acculynx: '⚠️', hatch: '❌', serviceTitan: '⚠️', roofr: '✅' },
      { feature: 'Work Order Tracking', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '✅', roofr: '⚠️' },
    ],
  },
  {
    category: '💳 Billing & Payments',
    rows: [
      { feature: 'Invoicing & Payment Tracking', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '✅', roofr: '✅' },
      { feature: 'QuickBooks Integration', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '✅', roofr: '❌' },
      { feature: 'Subscription Billing (Stripe)', trussctr: '✅', jobNimbus: '❌', acculynx: '❌', hatch: '❌', serviceTitan: '❌', roofr: '❌' },
    ],
  },
  {
    category: '🤖 AI & Automation',
    rows: [
      { feature: 'AI Assistant (built-in)', trussctr: '✅', jobNimbus: '❌', acculynx: '❌', hatch: '✅', serviceTitan: '⚠️', roofr: '❌' },
      { feature: 'Weather / HailTrace Integration', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '❌', serviceTitan: '❌', roofr: '⚠️' },
      { feature: 'Automated Notifications', trussctr: '✅', jobNimbus: '✅', acculynx: '✅', hatch: '✅', serviceTitan: '✅', roofr: '⚠️' },
    ],
  },
  {
    category: '💰 Pricing',
    rows: [
      { feature: 'Starting Monthly Price', trussctr: '$29/mo', jobNimbus: '$74/mo', acculynx: '$79/mo', hatch: '$59/mo', serviceTitan: '$398/mo', roofr: '$89/mo' },
      { feature: 'All Features in Base Plan', trussctr: '✅', jobNimbus: '❌', acculynx: '❌', hatch: '❌', serviceTitan: '❌', roofr: '❌' },
      { feature: 'No Per-Feature Upsells', trussctr: '✅', jobNimbus: '❌', acculynx: '❌', hatch: '❌', serviceTitan: '❌', roofr: '❌' },
      { feature: 'Free Trial', trussctr: '14 days', jobNimbus: '14 days', acculynx: 'Demo only', hatch: '14 days', serviceTitan: 'Demo only', roofr: '14 days' },
    ],
  },
];

const ComparisonTable: React.FC = () => {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const headers = ['Feature', 'TrussCTR', 'JobNimbus', 'AccuLynx', 'Hatch', 'ServiceTitan', 'Roofr'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">TrussCTR vs. The Competition</h2>
        <p className="text-xs text-gray-500 mt-0.5">Click a category to expand the comparison</p>
      </div>
      {COMPARISON_SECTIONS.map((section, i) => (
        <div key={i} className="border-b border-gray-100 last:border-0">
          <button
            onClick={() => toggle(i)}
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800">{section.category}</span>
            {openSections.has(i) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
          {openSections.has(i) && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    {headers.map((h, hi) => (
                      <th key={hi} className={`px-4 py-2 text-left font-semibold ${hi === 1 ? 'text-blue-700 bg-blue-50' : 'text-gray-600'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, ri) => (
                    <tr key={ri} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">{row.feature}</td>
                      <td className="px-4 py-2 font-semibold text-blue-700 bg-blue-50/40">{row.trussctr}</td>
                      <td className="px-4 py-2 text-gray-600">{row.jobNimbus}</td>
                      <td className="px-4 py-2 text-gray-600">{row.acculynx}</td>
                      <td className="px-4 py-2 text-gray-600">{row.hatch}</td>
                      <td className="px-4 py-2 text-gray-600">{row.serviceTitan}</td>
                      <td className="px-4 py-2 text-gray-600">{row.roofr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const BillingSettings: React.FC = () => {

  const handleManageBilling = () => {
    const a = document.createElement('a');
    a.href = 'https://billing.stripe.com/p/login/aFa9AVb73faq5vsfmw6Na00';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-sm text-gray-500 mt-1">All features included in every plan — scale at your own pace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.open('/trussctr-comparison.html', '_blank')} className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Compare Plans
          </Button>
          <Button variant="outline" onClick={handleManageBilling} className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Manage Billing
          </Button>
        </div>
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

      {/* Competitor Comparison */}
      <div className="mt-8">
        <ComparisonTable />
      </div>

      {/* 14-day trial note */}
      <p className="text-center text-xs text-gray-400 mt-6">
        All plans include a <strong>14-day free trial</strong>. No credit card required to start. Cancel anytime.
      </p>
    </div>
  );
};

export default BillingSettings;
