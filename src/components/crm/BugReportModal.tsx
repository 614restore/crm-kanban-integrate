// Copied from QuoteMGR src/components/BugReportModal.tsx (read-only reference); props adapted to TrussCTR.
import React, { useState } from 'react';
import { X, Bug, ChevronDown, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const MAX_CHARS = 500;

const BUG_CATEGORIES = [
  'Quote not saving',
  'PDF generation failed',
  'Email not sending',
  'QuickBooks sync issue',
  'Financing / lender issue',
  'Customer search not working',
  'Photos or files not uploading',
  'Pricing or calculations wrong',
  'App crashes or freezes',
  'Login or access issue',
  'Missing or incorrect data',
  'Other',
];

interface Props {
  companyId: string;
  companyName: string;
  userEmail: string;
  userRole?: string;
  onClose: () => void;
}

type Status = 'idle' | 'sending' | 'success' | 'error';

export default function BugReportModal({ companyId, companyName, userEmail, userRole, onClose }: Props) {
  const [category, setCategory]     = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus]         = useState<Status>('idle');
  const [errorMsg, setErrorMsg]     = useState('');

  const charsLeft = MAX_CHARS - description.length;
  const canSubmit = category !== '' && status !== 'sending';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus('sending');
    setErrorMsg('');

    try {
      const { error } = await supabase.functions.invoke('send-bug-report', {
        body: {
          company_id:   companyId,
          company_name: companyName,
          user_email:   userEmail,
          user_role:    userRole,
          platform:     'web',
          category,
          description:  description.trim() || undefined,
        },
      });

      if (error) throw error;
      setStatus('success');
    } catch (err: any) {
      console.error('Bug report error:', err);
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Bug className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Report a Bug</h2>
              <p className="text-xs text-gray-400">We'll look into it right away</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {status === 'success' ? (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Report Received</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Thanks for letting us know. We'll review the issue and follow up if we need more details.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 bg-[#1e3a5f] hover:bg-[#152d4a] text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {/* Category dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                What's not working? <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-colors cursor-pointer"
                >
                  <option value="">Select a category…</option>
                  {BUG_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Description textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Additional details{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <span className={`text-xs tabular-nums ${charsLeft < 50 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {charsLeft} left
                </span>
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Describe what you were doing and what happened…"
                rows={4}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-colors resize-none"
              />
            </div>

            {/* Reporter info pill */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-xs text-gray-500">
              <span className="shrink-0">📋</span>
              <span>
                Sent as <strong className="text-gray-700">{userEmail}</strong> from <strong className="text-gray-700">{companyName}</strong>
              </span>
            </div>

            {/* Error */}
            {status === 'error' && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1e3a5f] hover:bg-[#152d4a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Bug className="w-4 h-4" />
                    Submit Report
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
