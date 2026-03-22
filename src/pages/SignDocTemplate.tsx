// Customer-facing page for viewing and signing a document template
// URL: /sign-doc?token=<sign_token>

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SignaturePad } from '@/components/crm/SignaturePad';
import { CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';

type PageState = 'loading' | 'ready' | 'already_signed' | 'error' | 'success';

interface DocMeta {
  id: string;
  name: string;
  status: string;
  html: string;
  signedBy: string | null;
  signedAt: string | null;
  companyName: string;
  alreadySigned: boolean;
}

function getApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return window.location.origin;
}

export default function SignDocTemplate() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [doc, setDoc] = useState<DocMeta | null>(null);
  const [signerName, setSignerName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No signing token in the link. Please check your email for the correct link.');
      setPageState('error');
      return;
    }
    loadDoc();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadDoc = async () => {
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/sign-doc?action=get&token=${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed to load document (${res.status})`);

      const docData: DocMeta = body.doc;
      setDoc(docData);

      if (docData.alreadySigned) {
        setPageState('already_signed');
        return;
      }

      setPageState('ready');

      // Fire view-tracking in the background (once per load, non-blocking)
      fetch(`${base}/api/sign-doc?action=track-view&token=${encodeURIComponent(token)}`, {
        method: 'POST',
      }).catch(() => {/* non-critical */});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load document.';
      setError(message);
      setPageState('error');
    }
  };

  const handleSign = async (signatureData: string) => {
    if (!signerName.trim()) return;
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/sign-doc?action=sign&token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedBy: signerName.trim(), signatureData }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed to save signature (${res.status})`);
      setPageState('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save your signature. Please try again.';
      setError(message);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p>Loading document…</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Document</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // ── Already signed ────────────────────────────────────────────────────────
  if (pageState === 'already_signed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Already Signed</h1>
          <p className="text-gray-600">
            <strong>{doc?.name}</strong> has already been signed
            {doc?.signedBy ? ` by ${doc.signedBy}` : ''}.
          </p>
          {doc?.signedAt && (
            <p className="text-sm text-gray-400 mt-2">
              {new Date(doc.signedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-4">
            Your signature has been saved for <strong>{doc?.name}</strong>.
          </p>
          <p className="text-sm text-gray-500">
            A copy has been sent to {doc?.companyName || 'the contractor'} and you will receive a
            confirmation email shortly.
          </p>
        </div>
      </div>
    );
  }

  // ── Ready to sign ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          {doc?.companyName && (
            <p className="text-sm text-gray-500 mb-1">{doc.companyName}</p>
          )}
          <div className="flex items-center justify-center gap-2">
            <FileText size={22} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Review &amp; Sign Document</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">{doc?.name}</p>
        </div>

        {/* Document preview */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-xs text-blue-700 font-medium">
            Please read the entire document before signing
          </div>
          <iframe
            srcDoc={doc?.html || ''}
            className="w-full border-0"
            style={{ minHeight: '600px', height: '65vh' }}
            title={doc?.name}
            sandbox="allow-same-origin"
          />
        </div>

        {/* Signature panel */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Your Signature</h2>

          {/* Signer name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Enter your full legal name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Signature pad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Draw Your Signature <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">Use your mouse or finger to sign in the box below.</p>
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
            By saving your signature you agree to the terms of this document and acknowledge that
            your electronic signature is legally binding.
          </p>
        </div>
      </div>
    </div>
  );
}
