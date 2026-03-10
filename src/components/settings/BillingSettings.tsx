import React, { useState } from 'react';
import { CreditCard, Plus, Zap, Rocket, Building2, Star } from 'lucide-react';
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

const BillingSettings: React.FC = () => {
  const { profile } = useAuth();

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
          <h1 className="text-2xl font-bold text-gray-900">Billing &amp; Subscription</h1>
          <p className="text-sm text-gray-500 mt-1">All features included in every plan — scale at your own pace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleManageBilling} className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Manage Billing
          </Button>
        </div>
      </div>

      {/* Stripe Pricing Table */}
      <div className="mb-10">
        <stripe-pricing-table
          pricing-table-id="prctbl_1T8ahXQ4qbAu1D2SCifFughX"
          publishable-key="pk_live_51T8YyaQ4qbAu1D2STcaoAsxjqScvBgvTttf0k5DXp8t0BbDswCY6Hqdtd81MOlWeQqPBGCkAFBtAidM5Fsa8n0JK006K6b0Uv7"
          client-reference-id={profile?.company_id || undefined}
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
              <button onClick={handleManageBilling} className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700">
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
