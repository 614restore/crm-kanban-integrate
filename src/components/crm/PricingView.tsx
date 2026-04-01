import React from 'react';
import { useCRM } from '@/lib/crmStore';
import SubscriptionView from './SubscriptionView';
import { Settings, ArrowRight } from 'lucide-react';

export default function PricingView() {
  const { dispatch } = useCRM();

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Plans & Pricing</h2>
            <p className="text-gray-600 mt-1 max-w-3xl">
              Compare plan options, review your current subscription, and manage billing in one place.
            </p>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'settings' })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <Settings size={16} />
            Open Settings
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <SubscriptionView />
    </div>
  );
}
