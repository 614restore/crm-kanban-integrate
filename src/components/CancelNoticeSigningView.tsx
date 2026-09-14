// Copied from QuoteMGR src/components/CancelNoticeSigningView.tsx (read-only reference).
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import SignatureCanvas from '@/components/SignatureCanvas';
import { getLegalNotice, calculateCancellationDeadline } from '@/lib/legalNotices';
import type { Company } from '@/data/quoteData';

interface CancelNoticeSigningViewProps {
  quoteId: string;
  company: Company;
  shareToken: string;
}

// Standalone digital "3-Day Right to Cancel" signing page — a manager
// one-off tool (see [[document_email_routing]] / DocumentsWizard's "Share
// Digital Copy" action). Deliberately separate from the normal quote/
// contingency signing flow: it's reachable only when an owner/admin has
// explicitly enabled standalone_cancel_share_enabled for this quote, and the
// legal text reuses the same state-aware notice utilities as the printed
// version so the wording never drifts between the paper and digital copies.
const CancelNoticeSigningView: React.FC<CancelNoticeSigningViewProps> = ({
  quoteId,
  company,
  shareToken,
}) => {
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSignModal, setShowSignModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    loadQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  const loadQuote = async () => {
    setLoading(true);
    try {
      const { data: q, error } = await supabase
        .from('quotes')
        .select(`
          id, quote_number, created_at, sent_at,
          standalone_cancel_share_enabled,
          standalone_cancel_signature_data, standalone_cancel_signed_by, standalone_cancel_signed_at,
          customer:customers(first_name, last_name, email, state)
        `)
        .eq('id', quoteId)
        .single();
      if (error) throw error;
      setQuote(q);
      if (q?.standalone_cancel_signed_at) setSigned(true);
    } catch {
      toast.error('Failed to load this notice');
    } finally {
      setLoading(false);
    }
  };

  const formatLongDate = (date: Date | string | null | undefined) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const customerName = quote
    ? [quote.customer?.first_name, quote.customer?.last_name].filter(Boolean).join(' ') || 'Customer'
    : 'Customer';

  const legalNotice = quote ? getLegalNotice(quote.customer?.state, company.state) : null;
  const cancellationDeadline = quote
    ? calculateCancellationDeadline(quote.sent_at || quote.created_at || new Date())
    : null;

  const handleSign = async (sigData: string, signerName: string) => {
    setShowSignModal(false);
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('sign-cancel-notice', {
        body: {
          share_token: shareToken,
          signature_data: sigData,
          signer_name: signerName || customerName,
          signer_email: quote?.customer?.email || '',
        },
      });
      if (error) {
        let detail = error.message;
        try {
          const ctx = (error as any).context;
          const parsed = ctx && typeof ctx.json === 'function' ? await ctx.json() : ctx;
          if (parsed?.error) detail = parsed.error;
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      await loadQuote();
      setSigned(true);
      toast.success('Signature received. Thank you.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save signature. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!quote || !quote.standalone_cancel_share_enabled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Link Not Available</h2>
          <p className="text-gray-500 text-sm">
            This link is invalid or is no longer active. Please contact your contractor for an updated link.
          </p>
        </div>
      </div>
    );
  }

  const Header = () => (
    <div className="bg-[#1e3a5f] text-white px-4 py-5">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        {company.logo_url ? (
          <img src={company.logo_url} alt={company.name} className="h-10 object-contain bg-white/10 rounded-lg p-1 flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
        )}
        <div>
          <p className="text-blue-200 text-xs uppercase tracking-wider">{legalNotice?.cancelTitle || 'Notice of Right to Cancel'}</p>
          <h1 className="font-bold text-lg leading-tight">{company.name}</h1>
        </div>
      </div>
    </div>
  );

  const NoticeDocument = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-red-50 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-700">Legal Notice — Required by Federal &amp; State Law</p>
          <h2 className="font-bold text-gray-900 mt-0.5">{legalNotice?.cancelTitle}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Quote #{quote.quote_number} — {company.name}</p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4 text-sm text-gray-700 leading-relaxed">
        <div>
          <p className="font-semibold text-gray-800 mb-1.5">Your Right to Cancel</p>
          <p>{legalNotice?.cancelBody}</p>
          <p className="mt-2">
            This right applies to the transaction in Quote #{quote.quote_number}. You must cancel in writing no
            later than midnight of <strong>{formatLongDate(cancellationDeadline)}</strong>.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Cancellation Deadline</p>
          <p className="text-lg font-bold text-amber-900 mt-0.5">{formatLongDate(cancellationDeadline)}</p>
          <p className="text-xs text-amber-700 mt-0.5">Must cancel in writing by midnight on this date</p>
        </div>

        <div>
          <p className="font-semibold text-gray-800 mb-1.5">How to Cancel</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Prepare a written notice stating you are canceling this transaction. Include the date, your name, address, and your signature.</li>
            <li>
              Deliver or mail your notice to {company.name}
              {company.address ? ` at ${company.address}` : ''}
              {company.email ? `, or email to ${company.email}` : ''}.
            </li>
            <li>Your notice must be delivered or postmarked before midnight of the cancellation deadline shown above.</li>
            <li>Any payments made by you will be returned within 10 business days of the contractor receiving your cancellation notice. Any security interest arising from this transaction will be cancelled.</li>
          </ol>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="font-semibold text-gray-800 mb-1.5">Effect of Cancellation</p>
          <p>
            If you cancel this transaction, any property traded in, any payments made by you, and any negotiable
            instrument executed by you will be returned within 10 business days following receipt of your
            cancellation notice. Any security interest arising out of the transaction will be cancelled. If you
            cancel, you must make available to the seller, in substantially as good condition as when received,
            any goods delivered to you under this contract; or you may comply with the seller's instructions
            regarding return shipment at the seller's expense and risk. If you do not make the goods available to
            the seller, or if you agree to return the goods and do not do so, you remain liable for performance of
            all obligations under the contract.
          </p>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="font-semibold text-gray-800 mb-1.5">Notice to Buyer</p>
          <p>
            Do not sign this contract before you read it. You are entitled to a copy of the contract at the time
            you sign. Keep it to protect your legal rights. A contractor may not start work or require payment
            until the three-day cancellation period has expired, unless you expressly request that work begin
            immediately for emergency purposes. You should not waive your right to cancel unless a genuine
            emergency exists.
          </p>
        </div>
      </div>
    </div>
  );

  if (signed) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Signature Received</p>
              <p className="text-xs text-green-700">
                Signed by {quote.standalone_cancel_signed_by || customerName} on {formatLongDate(quote.standalone_cancel_signed_at)}.
              </p>
            </div>
          </div>
          <NoticeDocument />
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Signature</p>
            <img
              src={quote.standalone_cancel_signature_data}
              alt="Signature"
              className="h-16 max-w-full border border-gray-200 rounded-lg bg-gray-50 p-1.5 object-contain"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <NoticeDocument />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-600 mb-1 font-medium">Ready to sign?</p>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Please review the notice above, then sign below to acknowledge that you have received, read, and
            understand this Notice of Right to Cancel.
          </p>
          <button
            onClick={() => setShowSignModal(true)}
            disabled={saving}
            className="w-full bg-[#1e3a5f] hover:bg-[#152d4a] text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle className="w-5 h-5" /> Sign Notice of Right to Cancel</>
            )}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Your electronic signature is legally equivalent to your handwritten signature.
          </p>
        </div>
      </div>

      {showSignModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 sticky top-0 bg-white sm:rounded-t-2xl rounded-t-2xl z-10">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Sign Notice of Right to Cancel</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sign to acknowledge receipt of this notice.
                </p>
              </div>
              <button onClick={() => setShowSignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <SignatureCanvas
                onSign={(sigData, signerName) => handleSign(sigData, signerName)}
                signatureConsentText="By signing above, I acknowledge that I have received, read, and understand this Notice of Right to Cancel."
                hideCancelNotice={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CancelNoticeSigningView;
