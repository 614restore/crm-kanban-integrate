import React from 'react';
import SubscriptionView from '@/components/crm/SubscriptionView';

const BillingSettings: React.FC = () => {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing &amp; Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your TrussCTR plan, subscription status, and billing access from one place.</p>
      </div>
      <SubscriptionView />
    </div>
  );
};

export default BillingSettings;
