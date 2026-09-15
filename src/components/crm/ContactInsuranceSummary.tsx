import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ClaimAmounts {
  claim_amount: number | null;
  approved_amount: number | null;
  deductible: number | null;
  status: string;
}

const money = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

/** Insurance claim totals for one customer, shown on the contact's Financial tab. */
export default function ContactInsuranceSummary({ contactId }: { contactId: string }) {
  const [claims, setClaims] = useState<ClaimAmounts[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('insurance_claims')
      .select('claim_amount, approved_amount, deductible, status')
      .eq('contact_id', contactId)
      .then(({ data, error }) => {
        if (error) { console.error('[ContactInsuranceSummary] Failed to load claims:', error.message); return; }
        if (!cancelled) setClaims((data as ClaimAmounts[]) ?? []);
      });
    return () => { cancelled = true; };
  }, [contactId]);

  // Denied claims pay nothing, so they don't count toward the totals.
  const counted = claims.filter(c => c.status !== 'denied');
  if (counted.length === 0) return null;

  const claimed = counted.reduce((sum, c) => sum + Number(c.claim_amount ?? 0), 0);
  const approved = counted.reduce((sum, c) => sum + Number(c.approved_amount ?? 0), 0);
  const deductible = counted.reduce((sum, c) => sum + Number(c.deductible ?? 0), 0);
  const fromInsurer = Math.max(approved - deductible, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} className="text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Insurance</h3>
        <span className="text-sm text-gray-500">
          {counted.length} claim{counted.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">Amount Claimed</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{money(claimed)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Approved by Insurer</p>
          <p className="text-xl font-bold text-green-700 mt-1">{money(approved)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Deductible (customer pays)</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{money(deductible)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Expected from Insurer</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{money(fromInsurer)}</p>
        </div>
      </div>
    </div>
  );
}
