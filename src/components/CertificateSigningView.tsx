// Copied from QuoteMGR src/components/CertificateSigningView.tsx (read-only reference).
import React, { useState, useEffect } from 'react';
import { CheckCircle, Award, Loader2, X, Building2, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import SignatureCanvas from '@/components/SignatureCanvas';
import type { Company } from '@/data/quoteData';

const fetchDataUri = async (url: string): Promise<string> => {
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return url;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
};

const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const buildCertHtml = (
  company: Company,
  quote: any,
  photos: any[],
  customerName: string,
  completionDate: string | null | undefined,
  logoDataUri: string,
  photoDataUris: string[],
): string => {
  const fmtDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' }) : '—';

  const contractorChecks = [
    'All work specified in the Customer Service Agreement has been completed in accordance with its terms and conditions.',
    'All work has been performed in a workmanlike manner and in accordance with applicable industry standards and building codes.',
    'All materials used in the performance of the work are of good quality and suitable for their intended purpose.',
    'The work site has been cleaned and left in a safe and orderly condition.',
    'All required permits and inspections have been obtained and completed.',
  ];
  const customerChecks = [
    'All work described in the Customer Service Agreement has been completed to my satisfaction.',
    'I have inspected the completed work and found it to be satisfactory.',
    'I have no outstanding complaints or concerns regarding the quality of work performed.',
    'I understand that by signing this Certificate, I release the Contractor from further obligations, except as provided in the warranty section of the original agreement.',
  ];

  const photoGrid = photos.length > 0 ? `
    <div class="section">
      <p class="section-title">Completion Photos</p>
      <div class="photo-grid">
        ${photos.map((p, i) => `
          <div class="photo-cell">
            <img src="${esc(photoDataUris[i] || p.photo_url)}" alt="${esc(p.caption || `Photo ${i+1}`)}" class="photo-img">
            ${p.caption ? `<p class="photo-cap">${esc(p.caption)}</p>` : ''}
          </div>`).join('')}
      </div>
    </div>` : '';

  const contractorSig = quote.contractor_signature_data
    ? `<img src="${esc(quote.contractor_signature_data)}" class="sig-img" alt="Contractor signature">`
    : '<div class="sig-blank"></div>';
  const customerSig = quote.certificate_customer_signature_data
    ? `<img src="${esc(quote.certificate_customer_signature_data)}" class="sig-img" alt="Customer signature">`
    : '<div class="sig-blank"></div>';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=816, initial-scale=1">
<title>Certificate of Completion — ${esc(company.name)}</title>
<style>
  @page { margin: 0.5in; size: 8.5in 11in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111827; line-height: 1.5; background: white; }
  .header { border-left: 4px solid #1e3a5f; background: linear-gradient(to right, rgba(30,58,95,0.05), transparent); padding: 16px 20px 14px; margin-bottom: 8px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .logo { max-width: 160px; max-height: 60px; object-fit: contain; }
  .company-name { font-size: 16px; font-weight: 800; color: #1e3a5f; line-height: 1.2; }
  .company-detail { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .header-right { text-align: right; }
  .cert-header { padding: 14px 20px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: flex-start; gap: 10px; }
  .cert-title { font-size: 15px; font-weight: 700; color: #111827; }
  .cert-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .section { padding: 14px 20px; border-top: 1px solid #f3f4f6; }
  .section-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
  .section-title { font-size: 12px; font-weight: 600; color: #1f2937; margin-bottom: 8px; }
  .check-list { list-style: none; }
  .check-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; font-size: 11px; color: #374151; }
  .check-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #22c55e; flex-shrink: 0; margin-top: 1px; background: rgba(34,197,94,0.12); }
  .check-dot.blue { border-color: #60a5fa; background: rgba(96,165,250,0.12); }
  .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 8px; }
  .photo-cell img.photo-img { width: 100%; aspect-ratio: 1; object-fit: cover; border: 1px solid #e5e7eb; display: block; }
  .photo-cap { font-size: 9px; color: #6b7280; margin-top: 3px; line-height: 1.3; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 6px; }
  .sig-label { font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
  .sig-img { height: 56px; max-width: 100%; border: 1px solid #e5e7eb; background: #f9fafb; padding: 3px; object-fit: contain; display: block; }
  .sig-blank { height: 56px; border: 2px dashed #d1d5db; background: #f9fafb; }
  .sig-name { font-size: 12px; font-weight: 600; color: #111827; margin-top: 5px; }
  .sig-role { font-size: 10px; color: #6b7280; }
  .sig-date { font-size: 10px; color: #9ca3af; margin-top: 2px; }
</style>
</head>
<body>
<div class="header">
  <div>
    ${logoDataUri ? `<img src="${esc(logoDataUri)}" class="logo" alt="${esc(company.name)}">` : `<div class="company-name">${esc(company.name)}</div>`}
  </div>
  <div class="header-right">
    <div class="company-name">${esc(company.name)}</div>
    ${company.address ? `<div class="company-detail">${esc(company.address)}</div>` : ''}
    ${(company.city || company.state) ? `<div class="company-detail">${esc([company.city, company.state, company.zip].filter(Boolean).join(', '))}</div>` : ''}
    ${company.phone ? `<div class="company-detail">${esc(company.phone)}</div>` : ''}
    ${company.email ? `<div class="company-detail">${esc(company.email)}</div>` : ''}
  </div>
</div>

<div class="cert-header">
  <div>
    <div class="cert-title">Certificate of Completion</div>
    <div class="cert-sub">Prepared for <strong>${esc(customerName)}</strong>${completionDate ? ` · Completion Date: <strong>${esc(fmtDate(completionDate))}</strong>` : ''}</div>
  </div>
</div>

<div class="section">
  <div class="section-box">
    <p class="section-title">${esc(company.name)} hereby certifies that:</p>
    <ul class="check-list">
      ${contractorChecks.map(item => `<li class="check-item"><div class="check-dot"></div><span>${esc(item)}</span></li>`).join('')}
    </ul>
  </div>
</div>

<div class="section">
  <p class="section-title">By signing below, <strong>${esc(customerName)}</strong> acknowledges that:</p>
  <ul class="check-list">
    ${customerChecks.map(item => `<li class="check-item"><div class="check-dot blue"></div><span>${esc(item)}</span></li>`).join('')}
  </ul>
</div>

${photoGrid}

<div class="section">
  <div class="sig-grid">
    <div>
      <p class="sig-label">Contractor</p>
      ${contractorSig}
      <p class="sig-name">${esc(quote.contractor_signed_by || company.name)}</p>
      <p class="sig-role">${esc(company.name)}</p>
      ${company.license_number ? `<p class="sig-role">License #${esc(company.license_number)}</p>` : ''}
      <p class="sig-date">${fmtDate(quote.contractor_signed_at)}</p>
    </div>
    <div>
      <p class="sig-label">Customer</p>
      ${customerSig}
      <p class="sig-name">${esc(customerName)}</p>
      <p class="sig-role">Customer</p>
      ${quote.certificate_customer_signed_at ? `<p class="sig-date">${fmtDate(quote.certificate_customer_signed_at)}</p>` : ''}
    </div>
  </div>
</div>

<script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));</script>
</body>
</html>`;
};

interface CertificateSigningViewProps {
  quoteId: string;
  company: Company;
  shareToken: string;
}

const CertificateSigningView: React.FC<CertificateSigningViewProps> = ({
  quoteId,
  company,
  shareToken,
}) => {
  const [quote, setQuote] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSignModal, setShowSignModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadQuote();
    // Mark certificate as viewed for anonymous (customer) visitors
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user && shareToken) {
        supabase.rpc('mark_certificate_viewed', { share_token: shareToken }).catch(console.error);
      }
    });
  }, [quoteId]);

  const loadQuote = async () => {
    setLoading(true);
    try {
      const [{ data: q, error }, { data: photoRows }] = await Promise.all([
        supabase
          .from('quotes')
          .select(`
            id, quote_number, status, signed_at, signed_by,
            contractor_signature_data, contractor_signed_by, contractor_signed_at,
            certificate_customer_signature_data, certificate_customer_signed_at,
            completion_certificate_enabled,
            project_description, cover_page_title,
            customer:customers(first_name, last_name, email, state)
          `)
          .eq('id', quoteId)
          .single(),
        supabase
          .from('quote_photos')
          .select('id, photo_url, caption, sort_order')
          .eq('quote_id', quoteId)
          .order('sort_order'),
      ]);
      if (error) throw error;
      if (q) {
        setQuote(q);
        if (q.certificate_customer_signed_at) setSigned(true);
      }
      setPhotos(photoRows || []);
    } catch {
      toast.error('Failed to load certificate');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    });
  };

  const customerName = quote
    ? [quote.customer?.first_name, quote.customer?.last_name].filter(Boolean).join(' ') || 'Customer'
    : 'Customer';

  const completionDate = quote?.contractor_signed_at || quote?.signed_at;

  const handlePrint = async () => {
    if (!quote) return;
    setPrinting(true);
    try {
      const [logoDataUri, ...photoDataUris] = await Promise.all([
        company.logo_url ? fetchDataUri(company.logo_url) : Promise.resolve(''),
        ...photos.map(p => fetchDataUri(p.photo_url)),
      ]);
      const html = buildCertHtml(company, quote, photos, customerName, completionDate, logoDataUri, photoDataUris);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (win) setTimeout(() => URL.revokeObjectURL(url), 60000);
      else toast.error('Pop-up blocked — please allow pop-ups and try again.');
    } catch {
      toast.error('Failed to generate print document. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  const handleSign = async (sigData: string) => {
    setShowSignModal(false);
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('sign-certificate', {
        body: {
          share_token: shareToken,
          signature_data: sigData,
          signer_name: customerName,
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
      // Refresh so we get the saved signature data to display
      await loadQuote();
      setSigned(true);
      toast.success('Certificate signed successfully! Thank you.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save signature. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading certificate...</p>
        </div>
      </div>
    );
  }

  // ── Invalid / not-signed quote ──────────────────────────────────────────────
  const canSign = quote && (quote.status === 'signed' || quote.completion_certificate_enabled);
  if (!canSign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Certificate Not Available</h2>
          <p className="text-gray-500 text-sm">
            This certificate link is invalid or the project has not been completed yet.
          </p>
        </div>
      </div>
    );
  }

  // ── Shared certificate document (used in both signed read-only and unsigned views) ──
  const CertificateDocument = ({ customerSigData }: { customerSigData?: string | null }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:rounded-none print:shadow-none print:border-0">

      {/* Company header — visible only when printing / saving as PDF */}
      <div className="hidden print:flex items-start justify-between gap-4 px-6 pt-6 pb-5 mb-1 border-l-4 border-[#1e3a5f] bg-gradient-to-r from-[#1e3a5f]/5 to-transparent">
        <div className="flex-shrink-0">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              style={{ maxWidth: 180, maxHeight: 70, objectFit: 'contain' }}
            />
          ) : (
            <span className="text-xl font-bold text-[#1e3a5f]">{company.name}</span>
          )}
        </div>
        <div className="text-right text-sm">
          <p className="font-bold text-[#1e3a5f] text-lg leading-tight">{company.name}</p>
          {company.address && <p className="text-gray-500 text-xs mt-0.5">{company.address}</p>}
          {(company.city || company.state) && (
            <p className="text-gray-500 text-xs">{[company.city, company.state, company.zip].filter(Boolean).join(', ')}</p>
          )}
          {company.phone && <p className="text-gray-500 text-xs">{company.phone}</p>}
          {company.email && <p className="text-gray-500 text-xs">{company.email}</p>}
        </div>
      </div>

      <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
        <Award className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="font-bold text-gray-900">Certificate of Completion</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Prepared for <strong>{customerName}</strong>
            {completionDate && (
              <> · Completion Date: <strong>{formatDate(completionDate)}</strong></>
            )}
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Contractor completion statement */}
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="font-semibold text-sm text-gray-800 mb-3">
            {company.name} hereby certifies that:
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              'All work specified in the Customer Service Agreement has been completed in accordance with its terms and conditions.',
              'All work has been performed in a workmanlike manner and in accordance with applicable industry standards and building codes.',
              'All materials used in the performance of the work are of good quality and suitable for their intended purpose.',
              'The work site has been cleaned and left in a safe and orderly condition.',
              'All required permits and inspections have been obtained and completed.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Customer acknowledgment */}
        <div className="px-1">
          <p className="font-semibold text-sm text-gray-800 mb-3">
            By signing below, <strong>{customerName}</strong> acknowledges that:
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              'All work described in the Customer Service Agreement has been completed to my satisfaction.',
              'I have inspected the completed work and found it to be satisfactory.',
              'I have no outstanding complaints or concerns regarding the quality of work performed.',
              'I understand that by signing this Certificate, I release the Contractor from further obligations, except as provided in the warranty section of the original agreement.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Completion photos */}
        {photos.length > 0 && (
          <div className="border-t border-gray-100 pt-5">
            <p className="font-semibold text-sm text-gray-800 mb-3">Completion Photos</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="space-y-1">
                  <img
                    src={photo.photo_url}
                    alt={photo.caption || 'Completion photo'}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200 print:rounded-none"
                  />
                  {photo.caption && (
                    <p className="text-xs text-gray-500 leading-tight">{photo.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature blocks side by side */}
        <div className="border-t border-gray-100 pt-5 grid grid-cols-2 gap-6">
          {/* Contractor */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Contractor
            </p>
            {quote.contractor_signature_data ? (
              <img
                src={quote.contractor_signature_data}
                alt="Contractor signature"
                className="h-16 max-w-full border border-gray-200 rounded-lg bg-gray-50 p-1.5 object-contain mb-2"
              />
            ) : (
              <div className="h-16 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center mb-2">
                <p className="text-xs font-semibold text-gray-400">{company.name}</p>
              </div>
            )}
            <p className="font-semibold text-gray-800 text-sm">
              {quote.contractor_signed_by || company.name}
            </p>
            <p className="text-xs text-gray-500">{company.name}</p>
            {company.license_number && (
              <p className="text-xs text-gray-400">License #{company.license_number}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{formatDate(quote.contractor_signed_at)}</p>
          </div>

          {/* Customer */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Customer
            </p>
            {customerSigData ? (
              <img
                src={customerSigData}
                alt="Customer signature"
                className="h-16 max-w-full border border-gray-200 rounded-lg bg-gray-50 p-1.5 object-contain mb-2"
              />
            ) : (
              <div className="h-16 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center mb-2">
                <p className="text-xs text-gray-400">Awaiting signature</p>
              </div>
            )}
            <p className="font-semibold text-gray-800 text-sm">{customerName}</p>
            <p className="text-xs text-gray-500">Customer</p>
            {customerSigData && (
              <p className="text-xs text-gray-400 mt-1">{formatDate(quote.certificate_customer_signed_at)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Signed / read-only view ─────────────────────────────────────────────────
  if (signed) {
    return (
      <div className="min-h-screen bg-gray-50 print:bg-white">
        {/* Header */}
        <div className="bg-[#1e3a5f] text-white px-4 py-5 print:hidden">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="h-10 object-contain bg-white/10 rounded-lg p-1 flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
              )}
              <div>
                <p className="text-blue-200 text-xs uppercase tracking-wider">Certificate of Completion</p>
                <h1 className="font-bold text-lg leading-tight">{company.name}</h1>
              </div>
            </div>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-wait"
            >
              {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {printing ? 'Preparing…' : 'Print / Save PDF'}
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {/* Signed confirmation banner */}
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3 print:hidden">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Certificate Signed</p>
              <p className="text-xs text-green-700">
                Signed by {customerName} on {formatDate(quote.certificate_customer_signed_at)}.
                Use the Print button above to save a PDF copy for your records.
              </p>
            </div>
          </div>

          <CertificateDocument customerSigData={quote.certificate_customer_signature_data} />
        </div>
      </div>
    );
  }

  // ── Unsigned view ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white px-4 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-10 object-contain bg-white/10 rounded-lg p-1 flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          )}
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-wider">Certificate of Completion</p>
            <h1 className="font-bold text-lg leading-tight">{company.name}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <CertificateDocument />

        {/* Sign CTA */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-600 mb-1 font-medium">Ready to sign?</p>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Please review the certificate above, then sign below to acknowledge that your project
            has been completed to your satisfaction.
          </p>
          <button
            onClick={() => setShowSignModal(true)}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Sign Certificate
              </>
            )}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Your electronic signature is legally equivalent to your handwritten signature.
          </p>
        </div>
      </div>

      {/* Signature modal */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 sticky top-0 bg-white sm:rounded-t-2xl rounded-t-2xl z-10">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Sign Certificate of Completion</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sign to acknowledge your project has been completed to your satisfaction.
                </p>
              </div>
              <button
                onClick={() => setShowSignModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <SignatureCanvas
                onSign={(sigData) => handleSign(sigData)}
                signatureConsentText="By signing above, I acknowledge that all work has been completed to my satisfaction and I accept this Certificate of Completion as a legally binding document."
                hideCancelNotice={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateSigningView;
