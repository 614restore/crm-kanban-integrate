// The page a customer opens from a quote link: /?token=<share_token>, optionally
// with &preview=1 (CC recipient, read-only), &cert=1 (completion certificate) or
// &cancel_notice=1 (standalone right-to-cancel notice).
//
// Ported from QuoteMGR src/components/AppLayout.tsx (loadContactPortalEstimate and
// the portal render branch). No sign-in: the quote and its company come from the
// token-checked get_quote_for_customer function, and QuotePreview loads the rest
// through the get_quote_*_for_customer functions.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Company } from '@/data/quoteData';
import QuotePreview from '@/components/QuotePreview';
import CertificateSigningView from '@/components/CertificateSigningView';
import CancelNoticeSigningView from '@/components/CancelNoticeSigningView';

export default function CustomerQuotePortal() {
  const { token, isPreviewLink, isCertLink, isCancelNoticeLink } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      token: params.get('token') || '',
      isPreviewLink: params.get('preview') === '1',
      isCertLink: params.get('cert') === '1',
      isCancelNoticeLink: params.get('cancel_notice') === '1',
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not_found' | 'error' | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [customer, setCustomer] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_quote_for_customer', { share_token: token });
      if (rpcError) throw rpcError;
      const row: any = Array.isArray(data) ? data[0] : null;
      if (!row) {
        setError('not_found');
        return;
      }
      setQuoteId(row.id);
      setCompany({
        id: row.company_id,
        name: row.company_name,
        email: row.company_email,
        phone: row.company_phone,
        address: row.company_address,
        city: row.company_city,
        state: row.company_state,
        zip: row.company_zip,
        logo_url: row.company_logo_url,
        logo_zoom: row.company_logo_zoom ?? 100,
        about_text: row.company_about_text,
        warranty_text: row.company_warranty_text,
        license_number: row.company_license_number,
        website: row.company_website,
        about_mission: row.company_about_mission ?? null,
        about_tagline: row.company_about_tagline ?? null,
        about_highlights: row.company_about_highlights ?? null,
        about_showcase_photos: row.company_about_showcase_photos ?? null,
        about_bg_image_url: row.company_about_bg_image_url ?? null,
        about_bg_opacity: row.company_about_bg_opacity ?? 0.12,
        about_bg_zoom: row.company_about_bg_zoom ?? 100,
        about_process_steps: row.company_about_process_steps ?? null,
        about_page_template: row.company_about_page_template ?? 'about_us',
        sales_can_edit_pricing: false,
        invite_code: undefined,
      } as Company);
      setCustomer({
        id: row.customer_id,
        first_name: row.customer_first_name,
        last_name: row.customer_last_name,
        email: row.customer_email,
        phone: row.customer_phone,
        address: row.customer_address,
        city: row.customer_city,
        state: row.customer_state,
        zip: row.customer_zip,
      });
      // CC recipients get a ?preview=1 link that must not mark the quote viewed.
      if (!isPreviewLink) {
        supabase.rpc('mark_quote_viewed', { share_token: token }).then(({ error: e }) => {
          if (e) console.warn('mark_quote_viewed error:', e.message);
        });
      }
    } catch (err) {
      console.error('[CustomerQuotePortal] load error:', err);
      setError('error');
    } finally {
      setLoading(false);
    }
  }, [token, isPreviewLink]);

  useEffect(() => {
    if (token) load();
    else { setLoading(false); setError('not_found'); }
  }, [token, load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="w-10 h-10 border-[3px] border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          <p className="text-base font-semibold text-gray-800">Loading your quote…</p>
          <p className="text-sm text-gray-500">This will only take a moment.</p>
        </div>
      </div>
    );
  }

  if (error || !quoteId || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 text-center px-6 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-3xl">📋</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Quote Not Available</h2>
          {error === 'error' ? (
            <p className="text-sm text-gray-600 leading-relaxed">
              We had trouble loading your quote. Please check your internet connection and try again, or contact your contractor for assistance.
            </p>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">
              This quote link could not be found. It may have been removed or the link may be incomplete. Please contact your contractor for an updated link.
            </p>
          )}
          {error === 'error' && (
            <button
              onClick={load}
              className="mt-2 px-6 py-2.5 bg-[#1e3a5f] text-white rounded-xl font-semibold text-sm hover:bg-[#152d4a] transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isCancelNoticeLink) {
    return <CancelNoticeSigningView quoteId={quoteId} company={company} shareToken={token} />;
  }

  if (isCertLink) {
    return <CertificateSigningView quoteId={quoteId} company={company} shareToken={token} />;
  }

  return (
    <QuotePreview
      quoteId={quoteId}
      company={company}
      onBack={() => window.location.replace(window.location.pathname)}
      isCustomerView={true}
      shareToken={token}
      isPreviewLink={isPreviewLink}
      initialCustomer={customer}
    />
  );
}
