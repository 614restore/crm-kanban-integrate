import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SignaturePad } from '@/components/crm/SignaturePad';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface EstimateDetails {
  id: string;
  estimate_number: string;
  title: string;
  total: number;
  status: string;
  contact_id: string;
}

type PageState = 'loading' | 'ready' | 'already_signed' | 'error' | 'success';

function getApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return window.location.origin;
}

export default function SignDocument() {
  const [searchParams] = useSearchParams();
  const estimateId = searchParams.get('estimateId') || searchParams.get('id') || '';
  const token = searchParams.get('token') || '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [estimate, setEstimate] = useState<EstimateDetails | null>(null);
  const [signerName, setSignerName] = useState('');
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    if (!estimateId) {
      setError('No estimate ID provided in the link.');
      setPageState('error');
      return;
    }
    fetchEstimate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId]);

  const fetchEstimate = async () => {
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('App configuration error.');
      }

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(estimateId)}&select=id,estimate_number,title,total,status,contact_id`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Estimate not found.');
      }

      const est = data[0];

      if (est.status === 'accepted') {
        setEstimate(est);
        setPageState('already_signed');
        return;
      }

      if (!['sent', 'viewed'].includes(est.status)) {
        throw new Error(`This estimate cannot be signed (status: ${est.status}).`);
      }

      // Token is validated server-side in document-handler.mjs when the customer signs.
      // We do NOT fetch or compare sign_token client-side — that would expose it in the network response.

      setEstimate(est);
      setPageState('ready');

      // Try to fetch company name for display
      try {
        const cRes = await fetch(
          `${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(estimateId)}&select=company_id`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        const cData = await cRes.json();
        if (cData?.[0]?.company_id) {
          const compRes = await fetch(
            `${SUPABASE_URL}/rest/v1/companies?id=eq.${cData[0].company_id}&select=name`,
            { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
          );
          const compData = await compRes.json();
          if (compData?.[0]?.name) setCompanyName(compData[0].name);
        }
      } catch {
        // Non-critical
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load estimate.');
      setPageState('error');
    }
  };

  const handleSign = async (signatureData: string) => {
    if (!signerName.trim()) return;
    if (!estimate) return;

    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/sign-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimateId: estimate.id,
          signedBy: signerName.trim(),
          signatureData,
          token,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Failed to save signature (${res.status})`);
      }

      setPageState('success');
    } catch (err: any) {
      setError(err.message || 'Failed to save your signature. Please try again.');
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p>Loading estimate…</p>
        </div>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Estimate</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (pageState === 'already_signed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Already Signed</h1>
          <p className="text-gray-600">
            Estimate <strong>{estimate?.estimate_number}</strong> has already been signed and accepted.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-4">
            Your signature has been saved for estimate <strong>{estimate?.estimate_number}</strong>.
          </p>
          <p className="text-sm text-gray-500">
            {companyName || 'The contractor'} will be notified and will follow up shortly.
          </p>
        </div>
      </div>
    );
  }

  // pageState === 'ready'
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          {companyName && (
            <p className="text-sm text-gray-500 mb-1">{companyName}</p>
          )}
          <h1 className="text-2xl font-bold text-gray-900">Sign Estimate</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Estimate summary */}
          <div className="bg-blue-50 border-b border-blue-100 p-6">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1">
              {estimate?.estimate_number}
            </p>
            <h2 className="text-lg font-bold text-gray-900">{estimate?.title}</h2>
            <p className="text-2xl font-bold text-blue-700 mt-2">
              ${Number(estimate?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Signer name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Signature pad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Draw Your Signature <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Use your mouse or finger to draw your signature below.
              </p>
              <SignaturePad
                onSave={dataUrl => {
                  if (!signerName.trim()) {
                    setError('Please enter your full name before signing.');
                    return;
                  }
                  setError('');
                  handleSign(dataUrl);
                }}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle size={14} />
                {error}
              </p>
            )}

            <p className="text-xs text-gray-400 text-center">
              By saving your signature, you agree to the terms of this estimate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
