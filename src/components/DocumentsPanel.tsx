// Copied from QuoteMGR src/components/DocumentsPanel.tsx (read-only reference).
import React, { useEffect, useState, useCallback } from 'react';
import {
  X, Award, Loader2, CheckCircle2, Check, Eye, Link, Copy, Shield, FileText, Image, Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import PhotoUploader from '@/components/PhotoUploader';
import type { EstimatePhoto } from '@/data/quoteData';

interface DocumentsPanelProps {
  quote: any;
  company: any;
  onClose: () => void;
  onCertSent?: (quoteId: string) => void;
}

const DocumentsPanel: React.FC<DocumentsPanelProps> = ({ quote, company, onClose, onCertSent }) => {
  // ── Photos ──────────────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<EstimatePhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<Set<string>>(new Set());

  // ── Cert options ─────────────────────────────────────────────────────────────
  const [certSending, setCertSending] = useState(false);
  const [certSentAt, setCertSentAt] = useState<string | null>(
    quote.completion_certificate_sent_at ?? null
  );
  const [showPhotoSection, setShowPhotoSection] = useState(false);

  const isInsurance = !!quote.contingency_enabled;
  const hasContingencySig = !!quote.contingency_signature_data;
  const hasRetailSig = !isInsurance && !!quote.signature_data;
  const hasCancelSig = isInsurance ? !!quote.contingency_cancel_signature_data : !!quote.cancel_signature_data;

  const [includeContingency, setIncludeContingency] = useState(isInsurance && hasContingencySig);
  const [includeCancel, setIncludeCancel] = useState(hasCancelSig);

  // ── Email editing ─────────────────────────────────────────────────────────────
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(quote.customer?.email ?? '');
  const [savingEmail, setSavingEmail] = useState(false);
  const [customerEmail, setCustomerEmail] = useState(quote.customer?.email ?? '');

  const customerName = quote.customer
    ? `${quote.customer.first_name} ${quote.customer.last_name}`.trim()
    : 'Customer';

  // ── Load photos ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoadingPhotos(true);
      const [{ data: photoRows }, enableErr] = await Promise.all([
        supabase.from('quote_photos').select('*').eq('quote_id', quote.id).order('sort_order'),
        !quote.completion_certificate_enabled
          ? supabase.from('quotes').update({ completion_certificate_enabled: true }).eq('id', quote.id)
          : Promise.resolve({ error: null }),
      ]);
      if (enableErr && (enableErr as any).error) console.error('Failed to enable cert:', (enableErr as any).error);
      const loaded = (photoRows ?? []) as EstimatePhoto[];
      setPhotos(loaded);
      setSelectedPhotoUrls(new Set(loaded.map(p => p.photo_url)));
      setLoadingPhotos(false);
      if (loaded.length > 0) setShowPhotoSection(true);
    };
    init();
  }, [quote.id, quote.completion_certificate_enabled]);

  const handlePhotosChange = useCallback(async (updated: EstimatePhoto[]) => {
    const prevPhotos = photos;
    setPhotos(updated);
    setSelectedPhotoUrls(prev => {
      const existingUrls = new Set(updated.map(p => p.photo_url));
      const kept = new Set([...prev].filter(url => existingUrls.has(url)));
      updated.forEach(p => {
        if (!prevPhotos.find(old => old.photo_url === p.photo_url)) kept.add(p.photo_url);
      });
      return kept;
    });
    await supabase.from('quote_photos').delete().eq('quote_id', quote.id);
    if (updated.length > 0) {
      const rows = updated.map((p, i) => ({
        quote_id: quote.id, photo_url: p.photo_url, caption: p.caption,
        damage_type: p.damage_type, location: p.location, notes: p.notes, sort_order: i,
      }));
      const { error } = await supabase.from('quote_photos').insert(rows);
      if (error) toast.error('Failed to save photos');
    }
  }, [quote.id, photos]);

  const togglePhoto = (url: string) => {
    setSelectedPhotoUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };

  // ── Copy cert link ───────────────────────────────────────────────────────────
  const handleCopyLink = async () => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
    const link = `${window.location.origin}${base}?token=${quote.share_token}&cert=1`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Certificate link copied!');
    } catch {
      const el = document.createElement('textarea');
      el.value = link;
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
      toast.success('Certificate link copied!');
    }
  };

  const handleViewCert = () => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
    window.open(`${window.location.origin}${base}?token=${quote.share_token}&cert=1`, '_blank');
  };

  // ── Save customer email ───────────────────────────────────────────────────────
  const handleSaveEmail = async () => {
    const trimmed = emailDraft.trim();
    if (!trimmed || !trimmed.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase
      .from('customers')
      .update({ email: trimmed })
      .eq('id', quote.customer?.id);
    setSavingEmail(false);
    if (error) {
      toast.error('Failed to update email');
    } else {
      setCustomerEmail(trimmed);
      setEditingEmail(false);
      toast.success('Email updated');
    }
  };

  // ── Send cert ────────────────────────────────────────────────────────────────
  const handleSendCert = async () => {
    const alreadySent = certSentAt;
    const confirmed = window.confirm(
      alreadySent
        ? `A certificate was already sent on ${new Date(alreadySent).toLocaleDateString()}. Send another copy to ${customerEmail}?`
        : `Send the Completion Certificate to ${customerEmail}?`
    );
    if (!confirmed) return;

    setCertSending(true);
    try {
      const selectedPhotos = photos
        .filter(p => selectedPhotoUrls.has(p.photo_url))
        .map(p => ({ photo_url: p.photo_url, caption: p.caption, location: p.location, notes: p.notes }));

      const { error } = await supabase.functions.invoke('send-completion-certificate', {
        body: {
          quote_id: quote.id,
          company_id: company.id,
          dashboard_url: window.location.origin,
          selected_photos: selectedPhotos,
          include_contingency: includeContingency,
          include_cancel: includeCancel,
        },
      });
      if (error) {
        let detail = error.message;
        try {
          const ctx = (error as any).context;
          const parsed = ctx && typeof ctx.json === 'function' ? await ctx.json() : ctx;
          if (parsed?.details) detail = parsed.details;
          else if (parsed?.error) detail = parsed.error;
        } catch { /* ignore */ }
        toast.error(`Failed to send: ${detail}`, { duration: 8000 });
      } else {
        const sentAt = new Date().toISOString();
        setCertSentAt(sentAt);
        toast.success(`Documents sent to ${customerEmail}`, { duration: 5000, icon: '🏅' });
        onCertSent?.(quote.id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send');
    } finally {
      setCertSending(false);
    }
  };

  // ── What gets sent summary ───────────────────────────────────────────────────
  const docsSummary: string[] = ['Completion Certificate'];
  if (includeContingency && hasContingencySig) docsSummary.push('Signed Contingency');
  else if (!isInsurance && hasRetailSig) docsSummary.push('Signed Contract Page');
  if (includeCancel && hasCancelSig) docsSummary.push('3-Day Right to Cancel');
  if (selectedPhotoUrls.size > 0) docsSummary.push(`${selectedPhotoUrls.size} Photo${selectedPhotoUrls.size !== 1 ? 's' : ''}`);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="bg-[#1e3a5f] px-6 py-5 flex items-start justify-between shrink-0">
          <div>
            <p className="text-blue-300 text-xs uppercase tracking-wider mb-1">Documents</p>
            <h2 className="text-white text-lg font-bold">{customerName}</h2>
            <p className="text-blue-200 text-sm mt-0.5">{quote.quote_number}</p>
          </div>
          <button onClick={onClose} className="text-blue-300 hover:text-white transition-colors mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cert sent / signed status */}
        {certSentAt && (
          <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700">
              {quote.certificate_customer_signed_at
                ? <>Certificate <span className="font-semibold">signed</span> by {customerName} — both parties have executed this document.</>
                : <>Certificate sent {new Date(certSentAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} — awaiting customer signature.</>
              }
            </p>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* ── Quick links (when cert has been sent) ── */}
          {certSentAt && quote.share_token && (
            <div className="flex gap-2">
              <button
                onClick={handleViewCert}
                className="flex-1 flex items-center justify-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                <Eye className="w-4 h-4" />
                {quote.certificate_customer_signed_at ? 'View Signed Certificate' : 'View Certificate'}
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
            </div>
          )}

          {/* ── Completion Certificate section ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Documents to Send</h3>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100">

              {/* Completion Certificate — always included */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-4 h-4 rounded bg-amber-500 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Completion Certificate</p>
                    <p className="text-xs text-gray-500">
                      {quote.certificate_customer_signed_at
                        ? `Signed by ${customerName}`
                        : certSentAt
                          ? 'Sent — awaiting customer signature'
                          : 'Customer will sign electronically'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Signed contingency option — insurance only */}
              {isInsurance && hasContingencySig && (
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeContingency}
                    onChange={e => setIncludeContingency(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-600"
                  />
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Include Signed Contingency Agreement</p>
                      <p className="text-xs text-gray-500">Signed by {quote.contingency_signed_by || customerName}</p>
                    </div>
                  </div>
                </label>
              )}

              {/* Retail sig page — always shown when available */}
              {hasRetailSig && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-4 h-4 rounded bg-amber-500 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Signed Contract Page</p>
                      <p className="text-xs text-gray-500">Tier selected + customer signature</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3-day right to cancel */}
              {hasCancelSig && (
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCancel}
                    onChange={e => setIncludeCancel(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Include Signed 3-Day Right to Cancel</p>
                    <p className="text-xs text-gray-500">Customer's cancellation acknowledgment</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* ── Photos section ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Project &amp; Completion Photos</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowPhotoSection(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {loadingPhotos ? 'Loading…' : photos.length === 0 ? 'No photos added yet — tap to add' : `${selectedPhotoUrls.size} of ${photos.length} photo${photos.length !== 1 ? 's' : ''} selected`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Upload and choose which photos to include in the certificate</p>
              </div>
              <span className={`text-xs font-medium transition-colors ${showPhotoSection ? 'text-teal-600' : 'text-gray-400'}`}>
                {showPhotoSection ? 'Hide ▲' : 'Show ▼'}
              </span>
            </button>
          </div>

          {/* ── Photo section (expandable) ── */}
          {showPhotoSection && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
                  Add / Manage Photos
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Upload project photos, then select which ones to include in the certificate.
                </p>
                {loadingPhotos ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <PhotoUploader photos={photos} onChange={handlePhotosChange} quoteId={quote.id} />
                )}
              </div>

              {/* Selection grid */}
              {!loadingPhotos && photos.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Select for Certificate
                    </h3>
                    <div className="flex gap-3 text-xs font-medium">
                      <button type="button" onClick={() => setSelectedPhotoUrls(new Set(photos.map(p => p.photo_url)))} className="text-teal-600 hover:text-teal-700">All</button>
                      <button type="button" onClick={() => setSelectedPhotoUrls(new Set())} className="text-gray-400 hover:text-gray-600">None</button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {selectedPhotoUrls.size} of {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map(photo => {
                      const selected = selectedPhotoUrls.has(photo.photo_url);
                      return (
                        <button
                          key={photo.photo_url}
                          type="button"
                          onClick={() => togglePhoto(photo.photo_url)}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${selected ? 'border-teal-500' : 'border-gray-200 opacity-50'}`}
                        >
                          <img src={photo.photo_url} alt={photo.caption || ''} className="w-full h-20 object-cover" />
                          <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow ${selected ? 'bg-teal-500' : 'bg-white border border-gray-300'}`}>
                            {selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          {photo.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-0.5">
                              <p className="text-white text-[10px] truncate">{photo.caption}</p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-200 px-6 py-4 bg-gray-50 space-y-2">
          {/* Inline email editor */}
          {editingEmail ? (
            <div className="flex gap-2 items-center mb-1">
              <input
                type="email"
                value={emailDraft}
                onChange={e => setEmailDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveEmail(); if (e.key === 'Escape') setEditingEmail(false); }}
                autoFocus
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="customer@email.com"
              />
              <button
                onClick={handleSaveEmail}
                disabled={savingEmail}
                className="px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
              <button
                onClick={() => { setEditingEmail(false); setEmailDraft(customerEmail); }}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                Cancel
              </button>
            </div>
          ) : null}

          {!customerEmail && !editingEmail ? (
            <div className="space-y-1">
              <p className="text-sm text-red-600 text-center">No customer email on file — add one before sending.</p>
              <button
                onClick={() => setEditingEmail(true)}
                className="w-full text-sm text-amber-700 hover:text-amber-800 font-medium underline"
              >
                Add email address
              </button>
            </div>
          ) : !editingEmail ? (
            <button
              onClick={handleSendCert}
              disabled={certSending}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-wait text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
            >
              {certSending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : <><Award className="w-4 h-4" /> {certSentAt ? 'Resend Documents' : 'Send Documents'}</>
              }
            </button>
          ) : null}

          {!editingEmail && (
            <div className="flex items-center justify-center gap-1">
              <p className="text-xs text-gray-400">
                {customerEmail ? `Sends to ${customerEmail}` : 'Add customer email'}
                {docsSummary.length > 0 && ` · ${docsSummary.join(', ')}`}
              </p>
              {customerEmail && (
                <button
                  onClick={() => { setEmailDraft(customerEmail); setEditingEmail(true); }}
                  className="text-gray-400 hover:text-amber-600 transition-colors"
                  title="Edit email address"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DocumentsPanel;
