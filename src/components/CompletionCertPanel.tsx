// Copied from QuoteMGR src/components/CompletionCertPanel.tsx (read-only reference).
import React, { useEffect, useState, useCallback } from 'react';
import { X, Award, Loader2, CheckCircle2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import PhotoUploader from '@/components/PhotoUploader';
import type { EstimatePhoto } from '@/data/quoteData';

interface CompletionCertPanelProps {
  quote: any;
  company: any;
  onClose: () => void;
  onCertSent?: (quoteId: string) => void;
}

const CompletionCertPanel: React.FC<CompletionCertPanelProps> = ({
  quote,
  company,
  onClose,
  onCertSent,
}) => {
  const [photos, setPhotos] = useState<EstimatePhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<Set<string>>(new Set());
  const [certSending, setCertSending] = useState(false);
  const [certSentAt, setCertSentAt] = useState<string | null>(
    quote.completion_certificate_sent_at ?? null
  );

  const customerName = quote.customer
    ? `${quote.customer.first_name} ${quote.customer.last_name}`.trim()
    : 'Customer';

  // Load existing photos and ensure cert is enabled on the quote
  useEffect(() => {
    const init = async () => {
      setLoadingPhotos(true);
      const [{ data: photoRows }, enableErr] = await Promise.all([
        supabase
          .from('quote_photos')
          .select('*')
          .eq('quote_id', quote.id)
          .order('sort_order'),
        !quote.completion_certificate_enabled
          ? supabase.from('quotes').update({ completion_certificate_enabled: true }).eq('id', quote.id)
          : Promise.resolve({ error: null }),
      ]);
      if (enableErr && (enableErr as any).error) {
        console.error('Failed to enable cert:', (enableErr as any).error);
      }
      const loaded = (photoRows ?? []) as EstimatePhoto[];
      setPhotos(loaded);
      setSelectedPhotoUrls(new Set(loaded.map(p => p.photo_url)));
      setLoadingPhotos(false);
    };
    init();
  }, [quote.id, quote.completion_certificate_enabled]);

  // Persist photo changes back to quote_photos table
  const handlePhotosChange = useCallback(async (updated: EstimatePhoto[]) => {
    const prevPhotos = photos;
    setPhotos(updated);

    // Keep existing selections; auto-select newly added photos
    setSelectedPhotoUrls(prev => {
      const existingUrls = new Set(updated.map(p => p.photo_url));
      const kept = new Set([...prev].filter(url => existingUrls.has(url)));
      updated.forEach(p => {
        if (!prevPhotos.find(old => old.photo_url === p.photo_url)) {
          kept.add(p.photo_url);
        }
      });
      return kept;
    });

    await supabase.from('quote_photos').delete().eq('quote_id', quote.id);
    if (updated.length > 0) {
      const rows = updated.map((p, i) => ({
        quote_id: quote.id,
        photo_url: p.photo_url,
        caption: p.caption,
        damage_type: p.damage_type,
        location: p.location,
        notes: p.notes,
        sort_order: i,
      }));
      const { error } = await supabase.from('quote_photos').insert(rows);
      if (error) toast.error('Failed to save photos');
    }
  }, [quote.id, photos]);

  const togglePhoto = (url: string) => {
    setSelectedPhotoUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleSendCert = async () => {
    const alreadySent = certSentAt;
    const confirmed = window.confirm(
      alreadySent
        ? `A certificate was already sent on ${new Date(alreadySent).toLocaleDateString()}. Send another copy to ${quote.customer?.email}?`
        : `Send the Completion Certificate to ${quote.customer?.email}?`
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
        toast.error(`Failed to send certificate: ${detail}`, { duration: 8000 });
      } else {
        const sentAt = new Date().toISOString();
        setCertSentAt(sentAt);
        toast.success(`Completion Certificate sent to ${quote.customer?.email}`, { duration: 5000, icon: '🏅' });
        onCertSent?.(quote.id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send certificate');
    } finally {
      setCertSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="bg-[#1e3a5f] px-6 py-5 flex items-start justify-between shrink-0">
          <div>
            <p className="text-blue-300 text-xs uppercase tracking-wider mb-1">Completion Certificate</p>
            <h2 className="text-white text-lg font-bold">{customerName}</h2>
            <p className="text-blue-200 text-sm mt-0.5">{quote.quote_number}</p>
          </div>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white transition-colors mt-0.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cert status bar */}
        {certSentAt && (
          <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700">
              Certificate sent on{' '}
              <span className="font-semibold">
                {new Date(certSentAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              {' '}— customer has not yet signed.
            </p>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* Upload section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
              Completion Photos
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Add photos of the completed project. Then choose which ones to include in the certificate below.
            </p>

            {loadingPhotos ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <PhotoUploader
                photos={photos}
                onChange={handlePhotosChange}
                quoteId={quote.id}
              />
            )}
          </div>

          {/* Photo selection for certificate */}
          {!loadingPhotos && photos.length > 0 && (
            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Select Photos for Certificate
                </h3>
                <div className="flex gap-3 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoUrls(new Set(photos.map(p => p.photo_url)))}
                    className="text-amber-600 hover:text-amber-700"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoUrls(new Set())}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    None
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {selectedPhotoUrls.size} of {photos.length} photo{photos.length !== 1 ? 's' : ''} selected for the certificate
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map(photo => {
                  const selected = selectedPhotoUrls.has(photo.photo_url);
                  return (
                    <button
                      key={photo.photo_url}
                      type="button"
                      onClick={() => togglePhoto(photo.photo_url)}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${
                        selected ? 'border-amber-500' : 'border-gray-200 opacity-50'
                      }`}
                    >
                      <img
                        src={photo.photo_url}
                        alt={photo.caption || ''}
                        className="w-full h-20 object-cover"
                      />
                      <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow ${
                        selected ? 'bg-amber-500' : 'bg-white border border-gray-300'
                      }`}>
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

        {/* Footer — send cert button */}
        <div className="shrink-0 border-t border-gray-200 px-6 py-4 bg-gray-50">
          {!quote.customer?.email ? (
            <p className="text-sm text-red-600 text-center">No customer email on file — add one before sending.</p>
          ) : (
            <button
              onClick={handleSendCert}
              disabled={certSending}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-wait text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm"
            >
              {certSending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              ) : (
                <><Award className="w-4 h-4" /> {certSentAt ? 'Resend Completion Certificate' : 'Send Completion Certificate'}</>
              )}
            </button>
          )}
          <p className="text-xs text-gray-400 text-center mt-2">
            Sends to {quote.customer?.email || 'customer email'}
            {photos.length > 0 && selectedPhotoUrls.size > 0 && ` · ${selectedPhotoUrls.size} photo${selectedPhotoUrls.size !== 1 ? 's' : ''} included`}
            {photos.length > 0 && selectedPhotoUrls.size === 0 && ' · no photos included'}
          </p>
        </div>

      </div>
    </div>
  );
};

export default CompletionCertPanel;
