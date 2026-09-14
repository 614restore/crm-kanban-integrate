// Copied from QuoteMGR src/components/QuotePreview.tsx (read-only reference).
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ArrowLeft, Download, Send, Mail, Printer, CheckCircle, Clock, Eye,
  Building2, Phone, Globe, MapPin, Shield, FileText, Camera, AlertCircle, X, Loader2,
  DollarSign, ArrowRight, LayoutList, Monitor, ZoomIn, ExternalLink, PenLine, Star, Award
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sendFullSignedDocumentToCustomer } from '@/lib/fullSignedDocument';
import { toast } from 'sonner';
import { hasPricedLabor, quoteNeedsLabor, LABOR_MISSING_MESSAGE } from '@/lib/laborGuard';
import SignatureCanvas from '@/components/SignatureCanvas';
import Lightbox from '@/components/Lightbox';
import { generateQuotePDF } from '@/lib/pdfGenerator';
import { generateQuoteHTML } from '@/lib/quoteHtmlRenderer';
import { generateAndPrintInspectionReport } from '@/lib/inspectionReportGenerator';
import { quoteUrl, certUrl } from '@/lib/appUrl';
import type { Quote, Company, LineItem, QuotePhoto, QuoteOption } from '@/data/quoteData';
import { statusConfig, tierLabels } from '@/data/quoteData';

interface QuotePreviewProps {
  quoteId: string;
  company: Company;
  onBack: () => void;
  isCustomerView?: boolean;
  shareToken?: string;
  currentUser?: { full_name?: string; email?: string } | null;
  /** True when the viewer is a CC recipient — quote loads read-only without marking it as viewed */
  isPreviewLink?: boolean;
  onConvertToQuote?: (customerId: string) => void;
  onEdit?: () => void;
  /** Pre-loaded customer data from the share-token RPC, used as fallback when RLS blocks the customers join */
  initialCustomer?: any;
}

// Mirrors DashboardView.tsx's getPrimaryVisibleTier/getPrimaryVisibleTierTotal.
// A quote with include_better/include_best both false has no tier to speak
// of (a single Good/"Repair"-only quote) -- sending better_total regardless
// put the wrong number in the email's Estimated Total summary card.
const getEmailQuoteTotal = (q: Quote & { use_per_tier_items?: boolean }): number => {
  const tierTotal = (tier: 'good' | 'better' | 'best'): number => {
    if (q.use_manual_totals === true) {
      const manualKey = `manual_${tier}_total`;
      return q[manualKey] ?? q[`${tier}_total`] ?? 0;
    }
    return q[`${tier}_total`] ?? 0;
  };
  if (q.use_per_tier_items) {
    return tierTotal('good') + tierTotal('better') + tierTotal('best');
  }
  if (q.include_better !== false) return tierTotal('better');
  if (q.include_best !== false) return tierTotal('best');
  return tierTotal('good');
};

const QuotePreview: React.FC<QuotePreviewProps> = ({ quoteId, company, onBack, isCustomerView = false, shareToken, currentUser, isPreviewLink = false, onConvertToQuote, onEdit, initialCustomer }) => {
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [quote, setQuote] = useState<any>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<QuotePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('cover');
  const [showSignature, setShowSignature] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [inspectionGenerating, setInspectionGenerating] = useState(false);
  const [inspectionProgress, setInspectionProgress] = useState('');
  const [showContingencyModal, setShowContingencyModal] = useState(false);
  const [savingContingency, setSavingContingency] = useState(false);
  const [showContingencySigning, setShowContingencySigning] = useState(false);
  const [contingencySignStep, setContingencySignStep] = useState<'agreement' | 'cancel'>('agreement');
  const [contingencyAgreementSig, setContingencyAgreementSig] = useState<string | null>(null);
  const [contingencySignerName, setContingencySignerName] = useState('');
  const [savingContingencySign, setSavingContingencySign] = useState(false);
  const [financingOptions, setFinancingOptions] = useState<any[]>([]);
  const [lenderIntegrations, setLenderIntegrations] = useState<any[]>([]);
  const [selectedFinancing, setSelectedFinancing] = useState<string | null>(null);
  const [signStep, setSignStep] = useState<'fundingChoice' | 'agreement' | 'cancel' | null>(null);
  const [fundingPreference, setFundingPreference] = useState<'cash' | 'financing' | null>(null);
  const [showSentEmail, setShowSentEmail] = useState(false);
  const [showTierSelect, setShowTierSelect] = useState(false);

  // Customer tier-select and upgrade flow
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  // Draft selection inside the tier-picker modal (checkboxes). Committed to selectedTier on Continue.
  const [pickedTiers, setPickedTiers] = useState<Set<string>>(new Set());
  const [customerSelectedSections, setCustomerSelectedSections] = useState<string[] | null>(null);
  const [showUpgradesSelect, setShowUpgradesSelect] = useState(false);
  const [customerSelectedUpgrades, setCustomerSelectedUpgrades] = useState<any[]>([]);
  const [customerServiceRequests, setCustomerServiceRequests] = useState<string[]>([]);
  const [serviceRequestInput, setServiceRequestInput] = useState('');
  const [showRevisionPending, setShowRevisionPending] = useState(false);
  const [showFundingChoice, setShowFundingChoice] = useState(false);
  const [showContractorSign, setShowContractorSign] = useState(false);
  // Tracks whether the saved contractor signature image failed to render (a
  // stale/broken storage URL, etc.) -- lets the re-sign option surface even
  // when contractor_signature_data is technically present but not actually
  // visible on screen. Reset whenever the underlying signature data changes
  // (see the effect below).
  const [contractorSigBroken, setContractorSigBroken] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [showSignOnSite, setShowSignOnSite] = useState(false);
  const [signOnSiteStep, setSignOnSiteStep] = useState<'contractor' | 'handoff' | 'agreement' | 'cancel' | 'done'>('contractor');
  const [signOnSiteContractorSig, setSignOnSiteContractorSig] = useState<string | null>(null);
  const [signOnSiteContractorName, setSignOnSiteContractorName] = useState('');
  const [signOnSiteAgreementSig, setSignOnSiteAgreementSig] = useState<string | null>(null);
  const [savingSignOnSite, setSavingSignOnSite] = useState(false);
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);

  // Manual financing status update (staff-only)
  const [showManualFinancing, setShowManualFinancing] = useState(false);
  const [manualFinancingStatus, setManualFinancingStatus] = useState<string | null>(null);
  const [manualFinancingAmount, setManualFinancingAmount] = useState('');
  const [manualFinancingNote, setManualFinancingNote] = useState('');
  const [savingManualFinancing, setSavingManualFinancing] = useState(false);

  const [agreementSig, setAgreementSig] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: { url: string; caption?: string; notes?: string }[]; index: number } | null>(null);
  const openLightbox = (photoList: { url: string; caption?: string; notes?: string; location?: string }[], index: number) =>
    setLightbox({ photos: photoList, index });

  const [viewMode, setViewMode] = useState<'modern' | 'classic'>(() => {
    return (localStorage.getItem('quotePreviewMode') as 'modern' | 'classic') || 'modern';
  });

  // Generate the new HTML layout — used for both staff and customer views
  const [htmlError, setHtmlError] = React.useState<string | null>(null);
  const quoteHtml = useMemo(() => {
    if (!quote || !company) return '';
    setHtmlError(null);
    try {
      return generateQuoteHTML({
        quote,
        lineItems,
        photos,
        company,
        customer: quote.customer || {},
        signatureData: quote.signature_data,
        signedBy: quote.signed_by,
        signedAt: quote.signed_at,
        cancelSignatureData: quote.cancel_signature_data,
        cancelSignedAt: quote.cancel_signed_at,
        contractorSignatureData: quote.contractor_signature_data,
        contractorSignedBy: quote.contractor_signed_by,
        contractorSignedAt: quote.contractor_signed_at,
        quoteOptions: quoteOptions.length > 0 ? quoteOptions : undefined,
      });
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Unknown error';
      console.error('quoteHtml generation failed:', err);
      setHtmlError(msg);
      return '';
    }
  }, [isCustomerView, quote, lineItems, photos, company, quoteOptions]);

  useEffect(() => {
    loadQuote();
    loadFinancingOptions();
    if (!shareToken) loadLenderIntegrations(); // lender_integrations has auth-only RLS
  }, [quoteId]);

  useEffect(() => {
    setContractorSigBroken(false);
  }, [quote?.contractor_signature_data]);

  // Fetch the logged-in user's email so we can BCC them on every send
  useEffect(() => {
    if (!isCustomerView) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.email) setAuthUserEmail(data.user.email);
      });
    }
  }, [isCustomerView]);

  // Listen for print requests from the floating button inside the live HTML iframe.
  // Read previewIframeRef directly — refs are always current, no stale-closure risk.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.action !== 'quotePrint') return;
      const iframeWin = previewIframeRef.current?.contentWindow;
      if (iframeWin) {
        iframeWin.focus();
        iframeWin.print();
        toast.success('Print dialog opened — select "Save as PDF" to download');
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Customer view renders the quote inside an iframe under a `fixed` parent
  // shell. If the browser's native Print / Cmd+P is used instead of our
  // Print/Save PDF buttons (which target the iframe directly), the print
  // pipeline renders the OUTER page — and `position: fixed` content is
  // dropped or clipped to a blank page by most print engines (Safari
  // included). Cloning the iframe's real content into the top-level
  // document just before printing, then removing it after, makes native
  // print produce the actual document regardless of how it was triggered.
  useEffect(() => {
    if (!isCustomerView) return;
    const CLONE_ID = '__live_print_clone__';
    const STYLE_ATTR = 'data-live-print-clone';

    const handleBeforePrint = () => {
      const iframe = previewIframeRef.current;
      const iframeDoc = iframe?.contentDocument;
      if (!iframeDoc?.body) return;
      document.getElementById(CLONE_ID)?.remove();
      document.querySelectorAll(`style[${STYLE_ATTR}]`).forEach(s => s.remove());

      iframeDoc.querySelectorAll('style').forEach(styleTag => {
        const cloned = document.createElement('style');
        cloned.textContent = styleTag.textContent;
        cloned.setAttribute(STYLE_ATTR, 'true');
        document.head.appendChild(cloned);
      });

      const clone = document.createElement('div');
      clone.id = CLONE_ID;
      clone.innerHTML = iframeDoc.body.innerHTML;
      document.body.appendChild(clone);
      document.body.classList.add('live-printing');
    };

    const handleAfterPrint = () => {
      document.getElementById(CLONE_ID)?.remove();
      document.querySelectorAll(`style[${STYLE_ATTR}]`).forEach(s => s.remove());
      document.body.classList.remove('live-printing');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      handleAfterPrint();
    };
  }, [isCustomerView]);

  const loadQuote = async () => {
    setLoading(true);
    try {
      // Fetch quote + all related data in parallel so quoteHtml is generated
      // with photos already available on the first render — avoiding a second
      // iframe reload that resets scroll position and hides the photos page.
      // A customer opening a share link is anonymous, and RLS on these tables
      // requires an authenticated team member — the direct selects returned
      // zero rows and the page rendered "Quote not found". These SECURITY
      // DEFINER functions take the share token as an argument, so they return
      // rows only to someone who actually holds the link. Staff keep the direct
      // reads, which RLS already allows and which carry the customer/creator
      // joins the builder relies on.
      const useTokenReads = isCustomerView && !!shareToken;

      const [{ data: q }, { data: items }, { data: optionsData }, { data: photoData }] = useTokenReads
        ? await Promise.all([
            supabase.rpc('get_quote_row_for_customer', { share_token: shareToken })
              .then(r => ({ data: r.data?.[0] ?? null })),
            supabase.rpc('get_quote_line_items_for_customer', { share_token: shareToken })
              .then(r => ({ data: [...(r.data ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) })),
            supabase.rpc('get_quote_options_for_customer', { share_token: shareToken })
              .then(r => ({ data: [...(r.data ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) })),
            supabase.rpc('get_quote_photos_for_customer', { share_token: shareToken })
              .then(r => ({ data: [...(r.data ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) })),
          ])
        : await Promise.all([
            supabase.from('quotes').select('*, customer:customers(*), creator:team_members(*)').eq('id', quoteId).single(),
            supabase.from('quote_line_items').select('*').eq('quote_id', quoteId).order('sort_order'),
            supabase.from('quote_options').select('*').eq('quote_id', quoteId).order('sort_order'),
            supabase.from('quote_photos').select('*').eq('quote_id', quoteId).order('sort_order'),
          ]);

      if (q) {
        // RLS may block the customers join for anonymous viewers — fall back to
        // the customer data already fetched via the SECURITY DEFINER RPC.
        if (!q.customer && initialCustomer) q.customer = initialCustomer;
        // Honour the saved quote style preference
        if (q.quote_style === 'classic') setViewMode('classic');
        else if (q.quote_style === 'professional') setViewMode('modern');
        // Only mark as viewed / track the event for the primary customer.
        // CC recipients open a ?preview=1 link (isPreviewLink=true) — they can
        // read the quote but their visit must never flip the status to "viewed".
        if (!isPreviewLink) {
          if (isCustomerView && (q.status === 'sent' || q.status === 'viewed') && shareToken) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
              await supabase.rpc('mark_quote_viewed', { share_token: shareToken });
            }
          }
          // Track viewed event for all non-signed customer visits (deduped 60 min server-side)
          if (isCustomerView && shareToken && q.status !== 'signed') {
            const c = q.customer;
            const actorName = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || undefined : undefined;
            // An inspection report reports 'report_opened' rather than
            // 'viewed'. That event used to come from a tracking pixel in the
            // email, so it fired when the mail client loaded images — the
            // contractor was told the report had been opened when only the
            // email had been. This fires when the document itself renders.
            const openEvent =
              q.project_type === 'inspection_report' ? 'report_opened' : 'viewed';
            supabase.functions.invoke('track-quote-event', {
              body: { share_token: shareToken, event_type: openEvent, actor_name: actorName, actor_email: c?.email || undefined },
            }).catch(console.error);
          }
        }
        // Set all state together so quoteHtml is built with photos on first render
        setQuote(q);
      }
      if (items) setLineItems(items as LineItem[]);
      if (optionsData && optionsData.length > 0) {
        const opts = optionsData as QuoteOption[];
        setQuoteOptions(opts);
        setSelectedOptionId(opts[0].id);
      }
      if (photoData) setPhotos(photoData as QuotePhoto[]);
    } catch (err) {
      toast.error('Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const loadFinancingOptions = async () => {
    try {
      const { data } = await supabase
        .from('financing_options')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('sort_order');
      if (data) setFinancingOptions(data);
    } catch (err) {
      console.error('Failed to load financing options:', err);
    }
  };

  // ── Customer activity tracker ──────────────────────────────────────────────
  const trackQuoteEvent = (event_type: string, meta?: string, customer?: any) => {
    if (!shareToken || !isCustomerView) return;
    const c = customer ?? quote?.customer;
    const actorName = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || undefined : undefined;
    supabase.functions.invoke('track-quote-event', {
      body: { share_token: shareToken, event_type, meta, actor_name: actorName, actor_email: c?.email || undefined },
    }).catch(console.error);
  };

  // Initiates the two-step signing flow and fires the signing_started event
  const startSigningFlow = (opts?: { goToSignaturePage?: boolean }) => {
    setShowSignature(true);
    setSignStep('agreement');
    if (opts?.goToSignaturePage) setCurrentPage('signature');
    trackQuoteEvent('signing_started');
  };

  // Called after tier/sections/upgrades selection — shows funding choice then proceeds to sign
  const openFundingStep = () => {
    setShowFundingChoice(true);
  };

  const handleFundingContinue = async () => {
    setShowFundingChoice(false);
    const hasOptions = financingOptions.length > 0 || lenderIntegrations.length > 0;
    if (fundingPreference === 'financing' && !hasOptions) {
      // No financing configured — record customer interest and notify the company
      try {
        await supabase.from('quotes').update({
          financing_status: 'pending',
        }).eq('id', quoteId);

        const contractorEmail = company.quote_sender_email || company.quote_reply_to_email || company.email;
        const signerName = `${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim() || 'Customer';
        const shareUrl = quote?.share_token ? `${window.location.origin}/?token=${quote.share_token}` : null;
        if (contractorEmail) {
          supabase.functions.invoke('send-quote-email', {
            body: {
              company_id: company.id,
              share_token: quote?.share_token,
              to_email: contractorEmail,
              to_name: company.name,
              from_company: company.name,
              quote_number: quote?.quote_number,
              quote_url: shareUrl,
              email_subject: `Financing Interest — ${signerName} on Quote #${quote?.quote_number || ''}`,
              email_message: `${signerName} has indicated they are interested in financing for Quote #${quote?.quote_number || ''}.\n\nPlease reach out to them with financing options or an application link so they can proceed.`,
            },
          }).catch(console.error);
        }
      } catch {
        // Non-fatal — still let them proceed to sign
      }
    }
    startSigningFlow({ goToSignaturePage: true });
  };

  const loadLenderIntegrations = async () => {
    try {
      const { data } = await supabase
        .from('lender_integrations')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_enabled', true);
      if (data) setLenderIntegrations(data);
    } catch (err) {
      console.error('Failed to load lender integrations:', err);
    }
  };

  const handleAgreementSign = (signatureData: string) => {
    setAgreementSig(signatureData);
    setShowSignature(false);
    setSignStep('cancel');
  };

  const handleCancelSign = async (cancelSigData: string) => {
    if (!agreementSig || !quote) return;
    setSignStep(null);
    const signerName = `${quote.customer?.first_name || ''} ${quote.customer?.last_name || ''}`.trim() || 'Customer';
    const signerEmail = quote.customer?.email || '';
    try {
      // Use the security-definer RPC so anonymous (customer) users can sign
      // without needing direct INSERT access to quote_signatures.
      const { data: rpcResult, error: rpcError } = await supabase.rpc('sign_quote_customer', {
        p_share_token:           shareToken || quote.share_token,
        p_signer_name:           signerName,
        p_signer_email:          signerEmail,
        p_signature_data:        agreementSig,
        p_cancel_signature_data: cancelSigData,
        p_selected_tier:         selectedTier ?? null,
        p_selected_sections:     customerSelectedSections ?? null,
        p_selected_upgrades:     customerSelectedUpgrades?.length ? customerSelectedUpgrades : null,
        p_funding_preference:    fundingPreference ?? null,
      });
      if (rpcError) throw rpcError;
      if (rpcResult?.[0]?.was_updated === false) {
        toast.error('This quote has already been signed.');
        loadQuote();
        return;
      }
      const signedAt = new Date().toISOString();

      // Generate signed HTML and upload to Supabase storage.
      // Using the HTML renderer produces output identical to the web preview —
      // no layout differences, no missing photos, no cut-off content.
      let signedPdfBase64: string | undefined;
      let signedPdfFilename: string | undefined;
      try {
        const signedQuoteData = {
          ...quote,
          signed_at: signedAt,
          signed_by: signerName,
          signature_data: agreementSig,
          cancel_signature_data: cancelSigData,
        };

        // Generate a true PDF for the email attachment and storage
        const pdfDoc = await generateQuotePDF(
          signedQuoteData as any,
          company,
          lineItems,
          photos,
          () => {},
          quoteOptions.length > 0 ? quoteOptions : undefined,
        );

        const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
        const pdfBytes = pdfDoc.output('arraybuffer');
        signedPdfFilename = `${quote.quote_number}_${signerName.replace(/\s+/g, '_')}_signed.pdf`;
        signedPdfBase64 = pdfBase64;

        // Upload PDF to Supabase storage
        const storagePath = `${quoteId}/${Date.now()}-signed.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('signed-quotes')
          .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('signed-quotes')
            .getPublicUrl(storagePath);
          if (publicUrlData?.publicUrl) {
            await supabase.from('quotes').update({
              signed_pdf_url: publicUrlData.publicUrl,
            }).eq('id', quoteId);
          }
        }
      } catch (pdfErr) {
        console.error('Signed PDF generation/upload error (non-fatal):', pdfErr);
      }

      // Notify the sales rep and customer via the edge function
      if (quote.share_token) {
        supabase.functions.invoke('send-quote-alert', {
          body: {
            share_token: quote.share_token,
            event_type: 'signed',
            payment_method: fundingPreference ?? undefined,
            signed_pdf_base64: signedPdfBase64,
            signed_pdf_filename: signedPdfFilename,
            signer_signature_data: agreementSig ?? undefined,
            signer_name: signerName,
          },
        }).catch(console.error);
      }

      toast.success('Document signed successfully! Thank you.');
      setAgreementSig(null);
      setFundingPreference(null);
      loadQuote();
    } catch (err) {
      toast.error('Failed to save signature. Please try again.');
    }
  };

  // The on-screen preview iframe can exist while its document is still empty:
  // srcDoc not yet applied, a re-render that swapped the element, or a print
  // fired before first paint. Printing that window succeeds silently and
  // produces a ~1KB blank PDF -- no error in the console, nothing to debug
  // from. Confirm the document actually contains rendered pages before
  // trusting it; otherwise the caller falls through to the hidden-iframe
  // path, which waits for load and images before printing.
  const iframeHasRenderedContent = (win: Window | null | undefined) => {
    try {
      const body = win?.document?.body;
      return !!body && body.querySelector('.page') !== null;
    } catch {
      // Cross-origin or detached document — treat as unusable.
      return false;
    }
  };

  const handlePrint = () => {
    if (viewMode === 'modern' && quoteHtml) {
      // Use the already-rendered iframe — images are already loaded, no timing issues
      const iframeWin = previewIframeRef.current?.contentWindow;
      if (iframeWin && iframeHasRenderedContent(iframeWin)) {
        iframeWin.focus();
        iframeWin.print();
        return;
      }
      // Fallback: inject a hidden iframe and wait for images to fully load
      const hidden = document.createElement('iframe');
      hidden.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1200px;height:1px;border:0;';
      document.body.appendChild(hidden);
      hidden.addEventListener('load', () => {
        // Wait for images inside the iframe to load before printing
        const imgs = Array.from(hidden.contentDocument?.images ?? []);
        const imageLoadPromise = imgs.length
          ? Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })))
          : Promise.resolve();
        imageLoadPromise.then(() => {
          hidden.contentWindow?.print();
          setTimeout(() => { try { document.body.removeChild(hidden); } catch { /* ignore */ } }, 60000);
        });
      });
      hidden.srcdoc = quoteHtml;
    } else {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    if (!quote) return;

    // ── Professional layout: print the already-rendered preview iframe ──
    // Customer view skips the print dialog and falls through to jsPDF for a direct download
    if (viewMode === 'modern' && quoteHtml && !isCustomerView) {
      // First try: use the preview iframe already on screen (no popup needed)
      const iframeWin = previewIframeRef.current?.contentWindow;
      if (iframeWin && iframeHasRenderedContent(iframeWin)) {
        iframeWin.focus();
        iframeWin.print();
        toast.success('Print dialog opened — select "Save as PDF" to download');
        return;
      }
      // Fallback: inject a hidden iframe, wait for load, then print
      setPdfGenerating(true);
      setPdfProgress('Preparing Professional layout...');
      try {
        const hidden = document.createElement('iframe');
        // Width matters: a 1px-wide iframe lays the document out against a
        // 1px viewport, so the print comes out empty or mangled.
        hidden.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1200px;height:1px;border:0;';
        document.body.appendChild(hidden);
        hidden.addEventListener('load', () => {
          // Wait for the images rather than a flat timer -- a quote carrying
          // 20+ photos is nowhere near ready 400ms after load.
          const imgs = Array.from(hidden.contentDocument?.images ?? []);
          const imageLoadPromise = imgs.length
            ? Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })))
            : Promise.resolve();
          imageLoadPromise.then(() => {
            hidden.contentWindow?.print();
            toast.success('Print dialog opened — select "Save as PDF" to download');
            setTimeout(() => { try { document.body.removeChild(hidden); } catch { /* ignore */ } }, 60000);
          });
        });
        hidden.srcdoc = quoteHtml;
      } catch (err) {
        console.error('Professional PDF error:', err);
        toast.error('Failed to prepare Professional PDF');
      } finally {
        setPdfGenerating(false);
        setPdfProgress('');
      }
      return;
    }

    // ── Classic layout: jsPDF ──
    setPdfGenerating(true);
    setPdfProgress('Preparing...');
    try {
      const doc = await generateQuotePDF(
        quote,
        company,
        lineItems,
        photos,
        (step) => setPdfProgress(step),
        quoteOptions.length > 0 ? quoteOptions : undefined,
      );
      const customerName = quote.customer
        ? `${quote.customer.first_name}_${quote.customer.last_name}`.replace(/\s+/g, '_')
        : 'Customer';
      doc.save(`${quote.quote_number}_${customerName}.pdf`);
      toast.success('PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
      setPdfProgress('');
    }
  };

  const handleDownloadLive = () => {
    if (!quoteHtml) { toast.error('Live preview not available'); return; }
    const iframeWin = previewIframeRef.current?.contentWindow;
    if (iframeWin) {
      iframeWin.focus();
      iframeWin.print();
      toast.success('Print dialog opened — select "Save as PDF" to download');
      return;
    }
    const hidden = document.createElement('iframe');
    hidden.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1200px;height:1px;border:0;';
    document.body.appendChild(hidden);
    hidden.addEventListener('load', () => {
      const imgs = Array.from(hidden.contentDocument?.images ?? []);
      const ready = imgs.length
        ? Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })))
        : Promise.resolve();
      ready.then(() => {
        hidden.contentWindow?.print();
        toast.success('Print dialog opened — select "Save as PDF" to download');
        setTimeout(() => { try { document.body.removeChild(hidden); } catch { /* ignore */ } }, 60000);
      });
    });
    hidden.srcdoc = quoteHtml;
  };

  const handleGenerateInspectionReport = async () => {
    if (!quote || photos.length === 0) {
      if (onEdit) {
        onEdit();
      } else {
        toast.error('No inspection photos found for this quote. Please add photos before generating the report.');
      }
      return;
    }
    setInspectionGenerating(true);
    setInspectionProgress('Starting…');
    try {
      await generateAndPrintInspectionReport({
        quote: {
          quote_number: quote.quote_number,
          cover_page_title: quote.cover_page_title,
          project_description: quote.project_description,
          created_at: quote.created_at,
          cover_photo_url: quote.cover_photo_url,
        },
        photos,
        company,
        customer: {
          first_name: quote.customer?.first_name || '',
          last_name: quote.customer?.last_name || '',
          address: quote.customer?.address,
          city: quote.customer?.city,
          state: quote.customer?.state,
          zip: quote.customer?.zip,
        },
        onProgress: (msg) => setInspectionProgress(msg),
      });
      toast.success('Print dialog opened — select "Save as PDF" to download the inspection report');
    } catch (err) {
      console.error('Inspection report error:', err);
      toast.error('Failed to generate inspection report. Please try again.');
    } finally {
      setInspectionGenerating(false);
      setInspectionProgress('');
    }
  };

  const [certSending, setCertSending] = useState(false);

  const handleSendCertificateFromPreview = async () => {
    if (!quote) return;
    if (!quote.customer?.email) {
      toast.error('No customer email on file — add one before sending the certificate.');
      return;
    }
    const alreadySent = quote.completion_certificate_sent_at;
    const confirmed = window.confirm(
      alreadySent
        ? `A certificate was already sent on ${new Date(alreadySent).toLocaleDateString()}. Send another copy to ${quote.customer.email}?`
        : `Send the Completion Certificate to ${quote.customer.email}?`
    );
    if (!confirmed) return;
    setCertSending(true);
    try {
      // Enable the cert on this quote if not already (makes the cert link accessible to the customer)
      if (!quote.completion_certificate_enabled) {
        await supabase.from('quotes').update({ completion_certificate_enabled: true }).eq('id', quoteId);
      }
      const { error } = await supabase.functions.invoke('send-completion-certificate', {
        body: { quote_id: quoteId, company_id: company.id, dashboard_url: window.location.origin },
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
        toast.success(`Completion Certificate sent to ${quote.customer.email}`, { duration: 5000, icon: '🏅' });
        await loadQuote();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send certificate');
    } finally {
      setCertSending(false);
    }
  };

  const handleSaveContingency = async (dataUri: string, signerName: string) => {
    setSavingContingency(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .update({
          contingency_signature_data: dataUri,
          contingency_signed_by: signerName,
          contingency_signed_at: new Date().toISOString(),
          contingency_enabled: true,
        })
        .eq('id', quoteId);
      if (error) throw error;
      // Refresh quote state
      const { data: updated } = await supabase
        .from('quotes')
        .select('*, customer:customers(*)')
        .eq('id', quoteId)
        .single();
      if (updated) setQuote(updated);
      toast.success('Contingency agreement signed');
    } catch (err: any) {
      toast.error(`Failed to save signature: ${err.message}`);
      throw err;
    } finally {
      setSavingContingency(false);
    }
  };

  const handleSignOnSiteFinish = async (customerSigData: string, customerSigName: string, cancelSigData: string | null) => {
    if (!quote) return;
    setSavingSignOnSite(true);
    try {
      // Save contractor signature first (direct DB write — contractor is authenticated)
      if (signOnSiteContractorSig) {
        await supabase.from('quotes').update({
          contractor_signature_data: signOnSiteContractorSig,
          contractor_signed_at:      new Date().toISOString(),
          contractor_signed_by:      signOnSiteContractorName || currentUser?.full_name || 'Company Representative',
        }).eq('id', quoteId);
      }
      // Save customer signature via RPC (handles status update + notifications)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('sign_quote_customer', {
        p_share_token:           quote.share_token,
        p_signer_name:           customerSigName,
        p_signer_email:          quote.customer?.email || '',
        p_signature_data:        customerSigData,
        p_cancel_signature_data: cancelSigData,
        p_selected_tier:         null,
        p_selected_sections:     null,
        p_selected_upgrades:     null,
        p_funding_preference:    null,
      });
      if (rpcError) throw rpcError;
      if (rpcResult?.[0]?.was_updated === false) {
        toast.error('This agreement has already been signed.');
        loadQuote();
        setShowSignOnSite(false);
        return;
      }
      // For inspection reports, also save contingency-specific fields
      if (quote?.contingency_enabled) {
        await supabase.from('quotes').update({
          contingency_signature_data:        customerSigData,
          contingency_signed_by:             customerSigName,
          contingency_signed_at:             new Date().toISOString(),
          contingency_cancel_signature_data: cancelSigData,
          contingency_cancel_signed_at:      cancelSigData ? new Date().toISOString() : null,
        }).eq('id', quoteId);
      }
      setSignOnSiteStep('done');
      loadQuote();
      toast.success('Signed on site — document saved!');

      // Both parties just signed in person — send the customer their fully-executed copy
      if (quote?.share_token && quote?.customer?.email) {
        const isInspection = quote.project_type === 'inspection_report';
        const docLabel = isInspection ? 'Signed Contingency Agreement' : 'Signed Agreement';
        // Build and attach the executed document. Calling send-quote-alert
        // directly sent the customer an email announcing their signed copy
        // with no copy attached — the alert only attaches what the caller
        // hands it.
        sendFullSignedDocumentToCustomer(quoteId, company).catch(console.error);
        toast.success(`${docLabel} sent to ${quote.customer.email}`, { duration: 4000, icon: '📧' });
      }
    } catch (err: any) {
      toast.error(`Failed to save signature: ${err.message}`);
    } finally {
      setSavingSignOnSite(false);
    }
  };

  const handleContingencyAgreementSign = (sigData: string) => {
    setContingencyAgreementSig(sigData);
    setContingencySignStep('cancel');
  };

  const handleContingencyCancelSign = async (cancelSigData: string) => {
    if (!contingencyAgreementSig || !quote) return;
    setSavingContingencySign(true);
    const signerName = contingencySignerName.trim() ||
      `${quote.customer?.first_name || ''} ${quote.customer?.last_name || ''}`.trim() || 'Customer';
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('sign_quote_customer', {
        p_share_token:           shareToken || quote.share_token,
        p_signer_name:           signerName,
        p_signer_email:          quote.customer?.email || '',
        p_signature_data:        contingencyAgreementSig,
        p_cancel_signature_data: cancelSigData,
        p_selected_tier:         null,
        p_selected_sections:     null,
        p_selected_upgrades:     null,
        p_funding_preference:    null,
      });
      if (rpcError) throw rpcError;
      if (rpcResult?.[0]?.was_updated === false) {
        toast.error('This agreement has already been signed.');
        loadQuote();
        return;
      }
      // Also store contingency-specific columns
      await supabase.from('quotes').update({
        contingency_signature_data:        contingencyAgreementSig,
        contingency_signed_by:             signerName,
        contingency_signed_at:             new Date().toISOString(),
        contingency_cancel_signature_data: cancelSigData,
        contingency_cancel_signed_at:      new Date().toISOString(),
      }).eq('id', quoteId);
      setShowContingencySigning(false);
      loadQuote();
      toast.success('Agreement signed — thank you!');

      // Send the customer their signed contingency copy — with the document
      // actually attached. This previously posted a bare 'signed' alert, so
      // the homeowner got an email about a copy they never received.
      if (quote?.share_token) {
        sendFullSignedDocumentToCustomer(quoteId, company).catch(err => {
          console.error(err);
          // Fall back to the bare notification rather than going silent.
          supabase.functions.invoke('send-quote-alert', {
            body: {
              share_token: quote.share_token,
              event_type: 'signed',
              signer_name: signerName,
              signer_signature_data: contingencyAgreementSig,
            },
          }).catch(console.error);
        });
      }
    } catch (err: any) {
      toast.error(`Failed to save signature: ${err.message}`);
    } finally {
      setSavingContingencySign(false);
    }
  };

  const handleConvertToQuote = () => {
    if (!quote?.customer_id) {
      toast.error('No customer attached to this inspection report');
      return;
    }
    if (window.confirm('Start a new full quote for the same customer? The inspection photos will remain on the inspection report.')) {
      onConvertToQuote?.(quote.customer_id);
    }
  };

  const handleSendEmail = async () => {
    if (!quote?.customer?.email) {
      toast.error('No customer email');
      return;
    }
    if (quoteNeedsLabor(quote) && !hasPricedLabor(lineItems)) {
      toast.error(LABOR_MISSING_MESSAGE, { duration: 8000 });
      return;
    }
    try {
      const isInspectionReport = quote.project_type === 'inspection_report';
      // completion_certificate_enabled stays true for the life of the quote once a
      // certificate has ever been sent from it — it must never hijack this generic
      // "Email" button on an inspection report, or the report + contingency agreement
      // silently gets replaced by the certificate. Sending the certificate has its own
      // dedicated buttons (handleSendCertificateFromPreview / CompletionCertPanel).
      const isCompletionCert = !isInspectionReport && !!quote.completion_certificate_enabled;
      const hasContingency = !!quote.contingency_enabled;
      const sentSubject = isCompletionCert
        ? `Completion Certificate – ${quote.quote_number} from ${company.name}`
        : isInspectionReport
          ? `Inspection Report & Insurance Contingency Agreement – ${quote.quote_number} from ${company.name}`
          : `Quote ${quote.quote_number} from ${company.name}`;
      const reportLine = (quote.include_measurement_report && quote.measurement_report_url)
        ? `\n\nYour measurement report: ${quote.measurement_report_url}`
        : '';
      const sentMessage = isCompletionCert
        ? `Hi ${quote.customer.first_name || 'there'},\n\nThank you for your business — we truly appreciate it!\n\nAttached is your Completion Certificate for project #${quote.quote_number}. This is the final document that will be submitted to your insurance company to confirm that all work has been fully completed.\n\nThe certificate also includes your basic warranty information for your records. Please keep a copy for your files.\n\nIf you have any questions, don't hesitate to reach out.\n\nThank you again,\n${company.name}`
        : isInspectionReport
          ? `Hi ${quote.customer.first_name || 'there'},\n\nThank you for the opportunity to inspect your property. Please find your Inspection Report attached for your review.\n\n${hasContingency ? `This report also includes an Insurance Contingency Agreement for your signature. By signing, you are authorizing ${company.name} to work directly with your insurance company on your behalf to process your claim. You are not committing to any out-of-pocket cost at this time — our work only begins once your insurance claim has been approved.\n\nHere is how the process works:\n1. We submit your inspection report to your insurance company.\n2. Your insurance company reviews the claim and issues an approval.\n3. Once approved, we schedule the work and get started.\n4. Your out-of-pocket cost is limited to your deductible only.\n\nPlease review the report and sign the contingency agreement using the link below.\n\n` : `Please review the report and let us know if you have any questions.\n\n`}If you have any questions about the inspection findings or the claims process, please do not hesitate to reach out — we are here to help every step of the way.\n\nThank you,\n${company.name}`
          : `Hi ${quote.customer.first_name || 'there'},\n\nYour quote is ready to review. Please click the link to view your proposal.${reportLine}\n\nThank you,\n${company.name}`;
      // BCC the logged-in user so they get a copy — the edge function sends
      // a token-free version so clicking the link never flips the quote to "viewed"
      const bccEmail = authUserEmail || company.quote_sender_email || company.quote_reply_to_email || company.email;
      const customerName = `${quote.customer.first_name} ${quote.customer.last_name}`.trim();

      // Use the sending user's personal info if available; fall back to company settings
      const repName = currentUser?.full_name;
      const senderName = repName
        ? `${company.quote_sender_name || company.name} | ${repName}`
        : (company.quote_sender_name || company.name);
      const senderReplyTo = currentUser?.email || company.quote_reply_to_email || company.email;

      const { error: sendError } = await supabase.functions.invoke('send-quote-email', {
        body: {
          company_id: company.id,
          to_email: quote.customer.email,
          to_name: customerName,
          from_company: company.name,
          from_name: senderName,
          from_email: company.quote_sender_email || company.email,
          reply_to_email: senderReplyTo,
          bcc_email: bccEmail,
          bcc_customer_name: customerName,
          quote_number: quote.quote_number,
          share_token: quote.share_token,
          ...(isCompletionCert
            ? { certificate_url: certUrl(quote.share_token) }
            : { quote_url: quoteUrl(quote.share_token) }),
          quote_type: quote.project_type,
          quote_total: getEmailQuoteTotal(quote),
          project_description: quote.project_description,
          dashboard_url: window.location.origin,
          email_subject: sentSubject,
          email_message: sentMessage,
          ...(quote.include_measurement_report && quote.measurement_report_url
            ? { measurement_report_url: quote.measurement_report_url }
            : {}),
        }
      });
      if (sendError) {
        let detail = sendError.message;
        try {
          const ctx = (sendError as any).context;
          const parsed = ctx && typeof ctx.json === 'function' ? await ctx.json() : ctx;
          if (parsed?.details) detail = parsed.details;
          else if (parsed?.error) detail = parsed.error;
        } catch { /* ignore */ }
        toast.error(`Email failed: ${detail}`, { duration: 8000 });
      } else {
        const nowIso = new Date().toISOString();
        // Re-sending must not un-sign a document. Every send path set status to
        // 'sent' unconditionally, so emailing a signed quote a second time
        // dropped it back to "sent" on the dashboard while the signatures sat
        // untouched in the row.
        const alreadySigned = !!quote.signed_at || quote.status === 'signed';
        await supabase.from('quotes').update({
          ...(alreadySigned ? {} : { status: 'sent', viewed_at: null }),
          sent_at: nowIso,
          ...(isInspectionReport ? { inspection_report_sent_at: nowIso, inspection_report_viewed_at: null } : {}),
          last_sent_subject: sentSubject,
          last_sent_message: sentMessage,
        }).eq('id', quoteId);
        toast.success(`✓ Quote sent to ${quote.customer.email}`, { duration: 5000, icon: '📧' });
        setShowEmailCompose(false);
        loadQuote();
        setTimeout(() => onBack(), 1500);
      }
    } catch (err) {
      toast.error('Failed to send');
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);

  // Classic view alias — triggers two-step signing flow
  const handleSign = (sigData: string) => handleAgreementSign(sigData);

  const handleContractorSign = async (sigData: string, signerName: string) => {
    try {
      const { error } = await supabase.from('quotes').update({
        contractor_signature_data: sigData,
        contractor_signed_at: new Date().toISOString(),
        contractor_signed_by: signerName || currentUser?.full_name || 'Company Representative',
      }).eq('id', quoteId);
      if (error) throw error;
      setShowContractorSign(false);
      await loadQuote();
      toast.success('Your signature has been added');

      // Both parties have now signed, so send the homeowner the executed document
      // itself — the same one "View Full Document" produces — rather than a link.
      if (quote?.status === 'signed' && quote?.customer?.email && quote?.share_token) {
        const sent = await sendFullSignedDocumentToCustomer(quoteId, company);
        if (sent) toast.success('Signed copy sent to customer', { duration: 4000, icon: '📧' });
      }
    } catch {
      toast.error('Failed to save signature');
    }
  };

  const toggleViewMode = () => {
    const next = viewMode === 'modern' ? 'classic' : 'modern';
    setViewMode(next);
    localStorage.setItem('quotePreviewMode', next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-3 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!quote) {
    return <div className="text-center py-20 text-gray-500">Quote not found</div>;
  }

  // ── Classic view — rendered for customer classic layout OR staff classic preview ──
  const showClassicView =
    (isCustomerView && company.quote_customer_layout === 'classic') ||
    (!isCustomerView && viewMode === 'classic');

  // Classic view variables — used by both customer early-return and staff classic preview
  const classicIsSigned = isCustomerView && quote.status === 'signed';
  const isSigned = quote.status === 'signed';
  const classicInclAbout = quote.include_about_page !== false;
  const classicInclWarranty = quote.include_warranty_page !== false;
  const classicInclCancel = quote.include_cancel_notice !== false;
  const classicInclBetter = quote.include_better !== false;
  const classicInclBest = quote.include_best !== false;
  const classicShowPrices = quote.show_line_item_prices !== false;
  const classicShowTotals = quote.show_section_totals !== false;
  const classicShowDescriptions = quote.show_item_descriptions !== false;
  const classicGrouped = lineItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, LineItem[]>);
  // Multi-scope: items are explicitly linked to a quote_option via quote_option_id.
  // Tiered quotes also create quote_options rows (named Good/Better/Best at save time)
  // but items are NOT linked — so we use good/better/best_tier_name for those.
  const someItemsLinkedToOptions = lineItems.some(i => (i as any).quote_option_id != null);
  const isMultiScopePreview = quoteOptions.length > 0 && someItemsLinkedToOptions;
  const isInspectionReport = quote?.project_type === 'inspection_report';
  const showTierSignButton = !isInspectionReport && !quote?.contingency_enabled;
  const visibleQuoteOptions = isMultiScopePreview && (quote.include_better === false && quote.include_best === false)
    ? quoteOptions.slice(0, 1)
    : quoteOptions;
  const optionTierPages = isMultiScopePreview
    ? visibleQuoteOptions.map(opt => ({ id: `opt-${opt.id}`, label: `✦ ${opt.name}`, tier: 'good' as const, optionId: opt.id }))
    : [];
  const isInsuranceInvoice = quote?.quote_structure_type === 'insurance_invoice';
  const classicTierPages = (isInspectionReport || isInsuranceInvoice || quote?.contingency_enabled)
    ? []
    : isMultiScopePreview
      ? optionTierPages
      : (() => {
        const singleTierMode = !classicInclBetter && !classicInclBest;
        return [
          { id: 'option-good', label: singleTierMode ? '✦ Project Scope' : `✦ ${quote.good_tier_name || 'Good'} Option`, tier: 'good' as const },
          ...(classicInclBetter ? [{ id: 'option-better', label: `✦ ${quote.better_tier_name || 'Better'} Option`, tier: 'better' as const }] : []),
          ...(classicInclBest ? [{ id: 'option-best', label: `✦ ${quote.best_tier_name || 'Best'} Option`, tier: 'best' as const }] : []),
        ];
      })();
  // Inspection reports with contingency: Cover → Photos → About → Contingency (incl. cancel + sigs) → Warranty
  // All other quotes: keep existing tab structure with separate Signature/Cancel pages
  const classicPages = (isInspectionReport && quote?.contingency_enabled)
    ? [
        { id: 'cover', label: 'Cover Page' },
        ...(photos.length > 0 ? [{ id: 'photos', label: 'Inspection Photos' }] : []),
        ...(classicInclAbout ? [{ id: 'about', label: 'About Us' }] : []),
        { id: 'contingency-terms', label: 'Contingency Agreement' },
        ...(classicInclWarranty ? [{ id: 'warranty', label: 'Warranty' }] : []),
      ]
    : [
        { id: 'cover', label: 'Cover Page' },
        ...(classicInclAbout ? [{ id: 'about', label: 'About Us' }] : []),
        ...(photos.length > 0 ? [{ id: 'photos', label: 'Inspection Photos' }] : []),
        ...classicTierPages,
        ...(quote?.contingency_enabled ? [{ id: 'contingency-terms', label: 'Contingency Agreement' }] : []),
        ...(quote?.show_financing && (financingOptions.length > 0 || lenderIntegrations.length > 0) ? [{ id: 'financing', label: 'Financing Options' }] : []),
        ...(classicInclWarranty ? [{ id: 'warranty', label: 'Warranty' }] : []),
        { id: 'signature', label: 'Acceptance & Signature' },
        ...(classicInclCancel ? [{ id: 'cancel', label: 'Right to Cancel' }] : []),
      ];

  const status = statusConfig[quote.status] || statusConfig.draft;

  // Classic view: early return for both customers and staff (staff gets a toggle to switch to Professional)
  if (showClassicView) {
    const inclAbout = classicInclAbout;
    const inclWarranty = classicInclWarranty;
    const inclCancel = classicInclCancel;
    const inclBetter = classicInclBetter;
    const inclBest = classicInclBest;
    const showPrices = classicShowPrices;
    const showTotals = classicShowTotals;
    const showDescriptions = classicShowDescriptions;
    const custGrouped = classicGrouped;
    const custTierPages = classicTierPages;
    const custPages = classicPages;
      return (
        <div className="min-h-screen bg-gray-100">
          {/* Staff-only: full action bar matching the Professional view */}
          {!isCustomerView && (
            <div className="bg-white border-b print:hidden px-4 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-900 truncate">{quote.quote_number}</h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleDownloadPDF}
                  disabled={pdfGenerating}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#ff6b35] text-white rounded-lg hover:bg-[#e55a2b] transition-colors font-medium disabled:opacity-60 disabled:cursor-wait shadow-sm"
                >
                  {pdfGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:inline">{pdfProgress || 'Preparing...'}</span></> : <><Download className="w-4 h-4" /><span className="hidden sm:inline">Download Classic</span><span className="sm:hidden">PDF</span></>}
                </button>
                {quoteHtml && (
                  <button
                    onClick={handleDownloadLive}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#152d4a] transition-colors font-medium shadow-sm"
                    title="Download the live professional layout (what customers see)"
                  >
                    <Download className="w-4 h-4" /><span className="hidden sm:inline">Download Live</span><span className="sm:hidden">Live</span>
                  </button>
                )}
                {(photos.length > 0 || quote?.project_type === 'inspection_report') && (
                  <button
                    onClick={handleGenerateInspectionReport}
                    disabled={inspectionGenerating}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-wait shadow-sm"
                    title={quote?.completion_certificate_enabled ? "Generate completion photos & certificate PDF" : "Generate inspection photo report PDF"}
                  >
                    {inspectionGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:inline">{inspectionProgress || 'Generating…'}</span></>
                    ) : (
                      <><Camera className="w-4 h-4" /><span className="hidden sm:inline">{quote?.completion_certificate_enabled ? 'Completion Photos & Cert' : 'Photo Report'}</span></>
                    )}
                  </button>
                )}
                {isInspectionReport && onEdit && quote?.status !== 'signed' && (
                  <button
                    onClick={onEdit}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#152d4a] transition-colors font-medium"
                    title="Continue editing this inspection report"
                  >
                    <FileText className="w-4 h-4" /><span className="hidden sm:inline">Continue Editing</span>
                  </button>
                )}
                {isInspectionReport && (
                  <button
                    onClick={() => setShowContingencyModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                    title="Insurance contingency agreement"
                  >
                    <FileText className="w-4 h-4" /><span className="hidden sm:inline">Contingency</span>
                  </button>
                )}
                {quote?.status !== 'draft' && (
                  <button
                    onClick={handleSendCertificateFromPreview}
                    disabled={certSending}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-medium disabled:opacity-60 disabled:cursor-wait"
                    title={quote?.completion_certificate_sent_at ? 'Resend Completion Certificate' : 'Send Completion Certificate to customer'}
                  >
                    {certSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                    <span className="sm:hidden">Cert</span>
                    <span className="hidden sm:inline">{quote?.completion_certificate_sent_at ? 'Resend Cert' : 'Send Cert'}</span>
                  </button>
                )}
                {quote?.status !== 'signed' && (
                  <button
                    onClick={() => { setSignOnSiteContractorSig(null); setSignOnSiteContractorName(currentUser?.full_name || company.name || ''); setSignOnSiteAgreementSig(null); setSignOnSiteStep('contractor'); setShowSignOnSite(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                    title="Both contractor and customer sign in person"
                  >
                    <PenLine className="w-4 h-4" /><span className="hidden sm:inline">Sign On Site</span>
                  </button>
                )}
                {isInspectionReport && onConvertToQuote && (
                  <button
                    onClick={handleConvertToQuote}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-medium"
                    title="Convert inspection report to quote"
                  >
                    <ArrowRight className="w-4 h-4" /><span className="hidden sm:inline">Convert to Quote</span>
                  </button>
                )}
                <button onClick={handleSendEmail} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                  <Mail className="w-4 h-4" /><span className="hidden sm:inline">Email</span>
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <Printer className="w-4 h-4" /><span className="hidden sm:inline">Print</span>
                </button>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                  <button
                    onClick={() => { setViewMode('modern'); localStorage.setItem('quotePreviewMode', 'modern'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-gray-500 hover:text-gray-700"
                  >
                    <Monitor className="w-3.5 h-3.5" /><span className="hidden sm:inline">Professional</span>
                  </button>
                  <button
                    onClick={() => { setViewMode('classic'); localStorage.setItem('quotePreviewMode', 'classic'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-[#1e3a5f] text-white shadow-sm"
                  >
                    <LayoutList className="w-3.5 h-3.5" /><span className="hidden sm:inline">Classic</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Customer download bar */}
          {isCustomerView && (
            <div className="bg-white border-b print:hidden px-4 py-2 flex items-center justify-end">
              <button
                onClick={handleDownloadLive}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#152d4a] transition-colors font-medium shadow-sm"
              >
                <Download className="w-4 h-4" /><span>Print / Save PDF</span>
              </button>
            </div>
          )}

          {/* Page Navigation */}
          <div className="bg-white border-b sticky top-0 z-20 print:hidden">
            <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto py-2 items-center">
              {custPages.map((page, idx) => {
                const isTierPage = custTierPages.some(t => t.id === page.id);
                const prevPage = custPages[idx - 1];
                const prevIsTier = prevPage ? custTierPages.some(t => t.id === prevPage.id) : false;
                const isFirstTier = isTierPage && !prevIsTier;
                const tierColor = page.id.includes('good')
                  ? (currentPage === page.id ? 'bg-emerald-700 text-white' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200')
                  : page.id.includes('better')
                  ? (currentPage === page.id ? 'bg-blue-700 text-white' : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200')
                  : page.id.includes('best')
                  ? (currentPage === page.id ? 'bg-amber-600 text-white' : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200')
                  : '';
                return (
                  <React.Fragment key={page.id}>
                    {isFirstTier && (
                      <div className="w-px bg-gray-300 h-6 mx-1 flex-shrink-0" />
                    )}
                    <button
                      onClick={() => setCurrentPage(page.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                        isTierPage
                          ? tierColor
                          : currentPage === page.id
                          ? 'bg-[#1e3a5f] text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}>
                      {page.label}
                    </button>
                    {isTierPage && !custTierPages.some(t => t.id === custPages[idx + 1]?.id) && (
                      <div className="w-px bg-gray-300 h-6 mx-1 flex-shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* COVER */}
              {currentPage === 'cover' && (
                <div className="relative">
                  <div className="bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8e] to-[#1e3a5f] text-white p-12 lg:p-16 min-h-[500px] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-12">
                        {company.logo_url ? <div className="w-12 h-12 shrink-0"><img src={company.logo_url} alt="Logo" className="w-full h-full object-contain" /></div> : <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><Building2 className="w-7 h-7" /></div>}
                        <div><h2 className="text-xl font-bold">{company.name}</h2><p className="text-blue-200 text-sm">{company.license_number ? `License: ${company.license_number}` : ''}</p></div>
                      </div>
                      <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
                        {(quote.completion_certificate_enabled && (!quote.cover_page_title || quote.cover_page_title === 'Inspection Report'))
                          ? 'Completion Photos & Certificate'
                          : quote.cover_page_title}
                      </h1>
                      <p className="text-xl text-blue-200">{quote.project_description}</p>
                    </div>
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white/10 rounded-xl p-5">
                        <p className="text-xs text-blue-300 uppercase tracking-wider mb-2">Prepared For</p>
                        <p className="text-lg font-semibold">{quote.customer?.first_name} {quote.customer?.last_name}</p>
                        <p className="text-blue-200 text-sm">{quote.customer?.address}</p>
                        {quote.customer?.email && <p className="text-blue-200 text-sm mt-1">{quote.customer.email}</p>}
                        {quote.customer?.phone && <p className="text-blue-200 text-sm">{quote.customer.phone}</p>}
                      </div>
                      <div className="bg-white/10 rounded-xl p-5">
                        <p className="text-xs text-blue-300 uppercase tracking-wider mb-2">Quote Details</p>
                        <p className="text-sm"><span className="text-blue-300">Quote #:</span> {quote.quote_number}</p>
                        <p className="text-sm"><span className="text-blue-300">Date:</span> {new Date(quote.created_at).toLocaleDateString()}</p>
                        <p className="text-sm"><span className="text-blue-300">Type:</span> <span className="capitalize">{quote.project_type}</span></p>
                        {(quote as any).sales_rep_photo_url && (
                          <div className="flex items-center gap-2 mt-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 shrink-0">
                              <img
                                src={(quote as any).sales_rep_photo_url}
                                alt="Your rep"
                                className="w-full h-full object-cover"
                                style={{
                                  transform: `scale(${(quote as any).sales_rep_photo_zoom ?? 1})`,
                                  transformOrigin: `${(quote as any).sales_rep_photo_offset_x ?? 50}% ${(quote as any).sales_rep_photo_offset_y ?? 50}%`,
                                }}
                              />
                            </div>
                            <div>
                              <p className="text-xs text-blue-300">Prepared By</p>
                              <p className="text-sm font-medium">{quote.creator?.full_name || company.name}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-gray-50 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500 gap-2">
                    <div className="flex items-center gap-4">
                      {company.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{company.phone}</span>}
                      {company.email && <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{company.email}</span>}
                    </div>
                    <p>{company.address}, {company.city}, {company.state} {company.zip}</p>
                  </div>
                  {/* Sign bar on cover */}
                  {!isSigned && (
                    <div className="p-4 bg-green-50 border-t border-green-100 flex items-center justify-between gap-3">
                      <p className="text-sm text-green-800">Review the pages above, then sign to accept your quote.</p>
                      <button onClick={() => openFundingStep()} className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors"><CheckCircle className="w-4 h-4" /> Go to Signature</button>
                    </div>
                  )}
                  {isSigned && (
                    <div className="p-4 bg-green-50 border-t border-green-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-green-700 font-semibold">
                        <CheckCircle className="w-5 h-5" /> Quote Accepted &amp; Signed — Thank you!
                      </div>
                      {isCustomerView && (
                        <button
                          onClick={() => { try { window.close(); } catch { window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm"
                        >
                          <CheckCircle className="w-4 h-4" /> Done
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ABOUT */}
              {inclAbout && currentPage === 'about' && (
                <div className="relative overflow-hidden">
                  {company.about_bg_image_url && (
                    <div
                      className="absolute inset-0 bg-center bg-no-repeat"
                      style={{
                        backgroundImage: `url(${company.about_bg_image_url})`,
                        backgroundSize: `${company.about_bg_zoom ?? 100}%`,
                        opacity: company.about_bg_opacity ?? 0.12,
                      }}
                    />
                  )}
                  <div className="relative z-10 p-8 lg:p-12">
                    <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><Building2 className="w-5 h-5 text-[#1e3a5f]" /></div><h2 className="text-2xl font-bold text-gray-900">About {company.name}</h2></div>
                    <div className="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-line">{company.about_text || 'Company information has not been set up yet.'}</div>
                  </div>
                </div>
              )}

              {/* OPTION PAGES (new architecture) */}
              {quoteOptions.length > 0 && optionTierPages.map((optPage, optIdx) => {
                if (currentPage !== optPage.id) return null;
                const opt = quoteOptions.find(o => o.id === optPage.optionId);
                if (!opt) return null;
                const optItems = lineItems.filter(i => i.quote_option_id === opt.id);
                const optTotal = optItems.reduce((s, i) => s + i.quantity * (i.good_price ?? i.price ?? 0), 0);
                const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
                const grouped = optItems.reduce((acc, item) => {
                  if (item.hidden_from_customer) return acc;
                  if (!acc[item.category]) acc[item.category] = [];
                  acc[item.category].push(item);
                  return acc;
                }, {} as Record<string, LineItem[]>);
                // Color each option by its position: 0=green, 1=blue, 2=amber
                const optColors = [
                  { headerBg: 'from-emerald-700 to-emerald-600', footerBg: 'bg-emerald-700', badge: 'bg-emerald-500/30' },
                  { headerBg: 'from-blue-700 to-blue-600',       footerBg: 'bg-blue-700',    badge: 'bg-blue-500/30' },
                  { headerBg: 'from-amber-700 to-amber-600',     footerBg: 'bg-amber-700',   badge: 'bg-amber-500/30' },
                ];
                const oc = optColors[optIdx % optColors.length];
                return (
                  <div key={optPage.id}>
                    {/* Header banner — colored by option index */}
                    <div className={`bg-gradient-to-br ${oc.headerBg} text-white p-8 lg:p-10 relative overflow-hidden`}>
                      <div className="absolute inset-0 opacity-10"><div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" /></div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1 relative z-10">Project Overview &amp; Scope</p>
                      <h2 className="text-3xl font-bold mb-2 relative z-10">{opt.name}</h2>
                      <p className="text-white/80 text-2xl font-bold relative z-10">{fmt(optTotal)}</p>
                    </div>
                    <div className="p-8 space-y-6">
                      {Object.entries(grouped).map(([category, catItems]) => {
                        const catTotal = catItems.reduce((s, i) => s + i.quantity * (i.good_price ?? i.price ?? 0), 0);
                        return (
                          <div key={category}>
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                              <h3 className="font-semibold text-gray-900">{category}</h3>
                              {classicShowTotals && <span className="text-sm font-medium text-gray-700">{fmt(catTotal)}</span>}
                            </div>
                            <div className="space-y-2">
                              {catItems.map(item => (
                                <div key={item.id} className={`flex items-start justify-between gap-4 rounded-lg px-2 py-1 -mx-2 ${item.highlighted ? 'bg-amber-50 border border-amber-200' : ''}`}>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5">
                                      {item.highlighted && <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />}
                                      <p className={`text-sm font-medium ${item.highlighted ? 'text-amber-900' : 'text-gray-800'}`}>{item.item_name}</p>
                                    </div>
                                    {classicShowDescriptions && item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                                  </div>
                                  <div className="text-right shrink-0">
                                    {classicShowPrices && <p className={`text-sm font-medium ${item.highlighted ? 'text-amber-700' : 'text-gray-900'}`}>{fmt(item.quantity * (item.price ?? item.good_price))}</p>}
                                    <p className="text-xs text-gray-400">{item.quantity} {item.unit}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {/* Footer banner — same color as header */}
                      <div className={`${oc.footerBg} text-white rounded-xl p-5 flex items-center justify-between`}>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-0.5">Option Total</p>
                          <p className="text-lg font-bold">{opt.name}</p>
                        </div>
                        <p className="text-3xl font-black">{fmt(optTotal)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* TIER PAGES (legacy model) */}
              {/* Use !isMultiScopePreview so tiered quotes with quote_options rows still render here */}
              {!isMultiScopePreview && custTierPages.map(({ id, tier }) => {
                if (currentPage !== id) return null;
                const singleTierMode = !classicInclBetter && !classicInclBest;
                const cfg = { good: { label: singleTierMode ? 'Project Scope' : (quote.good_tier_name || 'Good'), subtitle: singleTierMode ? '' : 'Essential Coverage', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-300', headerBg: 'from-emerald-700 to-emerald-600', badge: null, priceKey: 'good_price' as const, totalKey: 'good_total' as const }, better: { label: quote.better_tier_name || 'Better', subtitle: 'Enhanced Protection', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-300', headerBg: 'from-blue-700 to-blue-600', badge: 'RECOMMENDED', priceKey: 'better_price' as const, totalKey: 'better_total' as const }, best: { label: quote.best_tier_name || 'Best', subtitle: 'Premium Solution', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300', headerBg: 'from-amber-700 to-amber-600', badge: 'BEST VALUE', priceKey: 'best_price' as const, totalKey: 'best_total' as const } }[tier];
                const tierTotal = quote[cfg.totalKey] ?? 0;
                const tierGrouped = lineItems.reduce((acc, item) => {
                  // Internal-only lines (labor) never reach the customer's copy —
                  // their dollars are already inside the tier totals above.
                  if (item.hidden_from_customer) return acc;
                  if (!item.tiers_applicable || item.tiers_applicable.length === 0 || item.tiers_applicable.includes(tier)) {
                    if (!acc[item.category]) acc[item.category] = [];
                    acc[item.category].push(item);
                  }
                  return acc;
                }, {} as Record<string, LineItem[]>);
                // Helper: is a given tier key included in a (possibly multi-tier) selection string?
                const isTierInSelection = (t: string, sel: string | null) =>
                  !!sel && (sel === 'all' || sel.split(',').includes(t));
                const isTierAccepted = (quote.status === 'signed' || quote.status === 'viewed') && isTierInSelection(tier, quote.selected_tier || null);
                const isCustomerPicking = isCustomerView && isTierInSelection(tier, selectedTier) && quote.status !== 'signed';
                return (
                  <div key={id}>
                    <div className={`bg-gradient-to-br ${cfg.headerBg} text-white p-8 lg:p-10 relative overflow-hidden`}>
                      <div className="absolute inset-0 opacity-10"><div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" /></div>
                      {/* ACCEPTED stamp — shows on the signed tier */}
                      {(isTierAccepted || isCustomerPicking) && (
                        <div className="absolute top-1/2 right-6 sm:right-10 -translate-y-1/2 pointer-events-none select-none rotate-[-12deg] opacity-90">
                          <div className="border-[3px] border-white rounded px-3 sm:px-4 py-1.5 relative">
                            <div className="absolute inset-[3px] border border-white/70 rounded" />
                            <span className="text-white font-black text-xl sm:text-2xl tracking-[0.2em] uppercase drop-shadow-md">
                              ACCEPTED
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="relative z-10">
                        {cfg.badge && <span className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">{cfg.badge}</span>}
                        <h2 className="text-3xl font-bold mb-1">{singleTierMode ? cfg.label : `${cfg.label} Option`}</h2>
                        {cfg.subtitle && <p className="text-white/80 text-lg">{cfg.subtitle}</p>}
                        <div className="mt-4 inline-block bg-white/15 rounded-xl px-5 py-3"><p className="text-xs text-white/60 uppercase tracking-widest mb-0.5">Total Investment</p><p className="text-2xl font-bold">{formatCurrency(tierTotal)}</p></div>
                      </div>
                    </div>
                    <div className="p-6 lg:p-10">
                      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-5">What's Included</h3>
                      {Object.entries(tierGrouped).map(([category, items]) => (
                        <div key={category} className="mb-8">
                          <div className="flex items-center gap-2 mb-3"><div className={`w-2 h-2 rounded-full ${cfg.color.replace('text-', 'bg-')}`} /><h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{category}</h4></div>
                          <div className="space-y-3">
                            {items.map(item => {
                              const price = (item as any)[cfg.priceKey];
                              return (
                                <div key={item.id} className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${
                                  item.highlighted
                                    ? 'border-amber-400 bg-amber-50 shadow-sm'
                                    : `${cfg.border} ${cfg.bg}`
                                }`}>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5">
                                      {item.highlighted && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
                                      <p className="font-semibold text-gray-900">{item.item_name}</p>
                                    </div>
                                    {showDescriptions && item.description && <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>}
                                  </div>
                                  {showPrices && <p className={`font-bold shrink-0 ${item.highlighted ? 'text-amber-700' : cfg.color}`}>{formatCurrency(item.quantity * price)}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div className={`border-t-2 ${cfg.border} pt-4 flex items-center justify-between`}><span className="font-bold text-gray-900 text-lg">Total</span><span className={`text-2xl font-bold ${cfg.color}`}>{formatCurrency(tierTotal)}</span></div>
                      {quote.status !== 'signed' && (
                        <div className="mt-6"><button onClick={() => openFundingStep()} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors"><CheckCircle className="w-4 h-4" /> {singleTierMode ? 'Accept This Quote' : 'Accept This Option'}</button></div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* end quoteOptions.length === 0 legacy tier pages */}

              {/* PHOTOS */}
              {currentPage === 'photos' && (
                <div className="p-6 lg:p-10">
                  {/* Section header — matches professional style */}
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Camera className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Photo Documentation</h2>
                      <p className="text-sm text-gray-500 mt-0.5">Documentation of findings during property inspection</p>
                    </div>
                    <span className="ml-auto hidden sm:flex items-center gap-1.5 text-xs text-gray-400 italic">
                      <ZoomIn className="w-3.5 h-3.5 flex-shrink-0" />
                      Tap any photo to enlarge
                    </span>
                  </div>
                  <div className="h-0.5 rounded-full mb-8 mt-4" style={{ background: `linear-gradient(90deg, ${company.quote_primary_color || '#1e3a5f'} 0%, transparent 100%)` }} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {photos.map((photo, i) => (
                      <div
                        key={photo.id}
                        className={`rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow ${photos.length % 2 === 1 && i === photos.length - 1 ? 'md:col-span-2' : ''}`}
                      >
                        {/* Photo with zoom overlay */}
                        <div
                          className="relative cursor-zoom-in group"
                          onClick={() => openLightbox(photos.map(p => ({ url: p.photo_url, caption: p.caption, notes: p.notes, location: p.location })), i)}
                        >
                          <img
                            src={photo.photo_url}
                            alt={photo.caption || `Photo ${i + 1}`}
                            className="w-full object-contain bg-gray-900"
                            style={{ height: photos.length % 2 === 1 && i === photos.length - 1 ? '280px' : '220px' }}
                          />
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                              <ZoomIn className="w-5 h-5 text-gray-800" />
                            </div>
                          </div>
                          {/* Photo number badge */}
                          <div className="absolute top-3 left-3 bg-black/50 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {i + 1} / {photos.length}
                          </div>
                        </div>

                        {/* Card content */}
                        <div className="p-4">
                          {photo.damage_type && (
                            <span className="inline-block mb-2 text-xs font-bold px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-100">
                              {photo.damage_type}
                            </span>
                          )}
                          {photo.caption ? (
                            <h4 className="font-semibold text-gray-900 text-sm leading-snug mb-1">{photo.caption}</h4>
                          ) : (
                            <h4 className="font-medium text-gray-400 text-sm mb-1">Photo {i + 1}</h4>
                          )}
                          {photo.notes && (
                            <p className="text-sm text-gray-500 leading-relaxed">{photo.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FINANCING */}
              {currentPage === 'contingency-terms' && (
                <div className="p-8 lg:p-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <Shield className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Insurance Contingency Agreement</h2>
                      <p className="text-gray-500 text-sm">Review the terms of your contingency agreement</p>
                    </div>
                  </div>
                  <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-center mb-6">
                    <p className="font-bold text-amber-900 text-sm">⚠ THREE (3) BUSINESS DAY RIGHT TO CANCEL</p>
                    <p className="text-xs text-amber-800 mt-1">You may cancel this agreement without penalty within 3 business days of signing.</p>
                  </div>
                  <div className="space-y-4 text-sm text-gray-700">
                    {([
                      ['1. Contingency Basis', 'This Agreement is entered into on a contingency basis. No restoration or repair work will be performed and no payment will be due from the Property Owner unless and until the Property Owner\'s insurance carrier approves a claim for the repair or replacement of damage to the property described herein.'],
                      ['2. Authorization to Act', 'Property Owner hereby authorizes Contractor to communicate directly with Property Owner\'s insurance company, insurance adjuster, and any related parties on Property Owner\'s behalf for the sole purpose of facilitating the insurance claim and scope of approved repairs. This authorization does not constitute assignment of benefits.'],
                      ['3. Scope of Work', 'Contractor agrees to perform all work as outlined and approved in the final insurance scope of loss issued by the insurance carrier. Any supplements or additional line items identified during the course of the project that are approved by the insurance carrier shall be included in the final contract price.'],
                      ['4. Payment Terms', 'Property Owner agrees to pay Contractor all insurance proceeds received from the insurance carrier for covered repairs, including any recoverable depreciation released upon completion of work, all approved supplements, and the applicable insurance deductible as stated in the Property Owner\'s policy. Property Owner shall not profit from the insurance claim proceeds beyond the cost of the completed work.'],
                      ['5. No Out-of-Pocket Cost Representation', 'Contractor makes no guarantee that Property Owner will owe nothing beyond the deductible. Final amounts owed are determined by the insurance carrier\'s approved scope and applicable policy terms.'],
                      ['6. Property Owner Responsibilities', 'Property Owner agrees to promptly provide Contractor with all insurance documentation, adjuster reports, and claim correspondence. Property Owner shall not independently settle or close the insurance claim without written consent from Contractor while this Agreement is in effect.'],
                      ['7. Contractor Obligations', 'Contractor agrees to provide professional workmanship meeting or exceeding industry standards, maintain all required licenses and insurance coverage, and pursue all legitimate supplements on behalf of the Property Owner at no additional charge to the Property Owner beyond the approved insurance scope.'],
                      ['8. Cancellation', 'Either party may cancel this Agreement within three (3) business days of execution without penalty. After the three-day rescission period, cancellation by the Property Owner after work has commenced may result in liability for costs incurred by Contractor up to the date of cancellation.'],
                    ] as [string, string][]).map(([title, body]) => (
                      <div key={title} className="pb-3 border-b border-gray-100 last:border-0">
                        <p className="font-semibold text-gray-900 text-xs mb-0.5">{title}</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{body}</p>
                      </div>
                    ))}
                  </div>

                  {/* Contingency Agreement Signatures */}
                  {(quote.contingency_signature_data || quote.contractor_signature_data) && (
                    <div className="mt-8 space-y-4">
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Signatures</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {quote.contingency_signature_data && (
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                            <p className="text-xs font-semibold text-indigo-700 mb-2">Customer Signature — Contingency Agreement</p>
                            <img src={quote.contingency_signature_data} alt="Customer signature" className="max-w-full h-16 object-contain bg-white border border-indigo-200 rounded-lg p-1" />
                            {quote.contingency_signed_by && <p className="text-xs text-indigo-600 mt-1">{quote.contingency_signed_by}</p>}
                            {quote.contingency_signed_at && <p className="text-xs text-gray-400">{new Date(quote.contingency_signed_at).toLocaleString()}</p>}
                          </div>
                        )}
                        {quote.contractor_signature_data && (
                          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                            <p className="text-xs font-semibold text-blue-700 mb-2">Sales Representative Signature</p>
                            <img src={quote.contractor_signature_data} alt="Contractor signature" className="max-w-full h-16 object-contain bg-white border border-blue-200 rounded-lg p-1" />
                            {quote.contractor_signed_by && <p className="text-xs text-blue-600 mt-1">{quote.contractor_signed_by}</p>}
                            {quote.contractor_signed_at && <p className="text-xs text-gray-400">{new Date(quote.contractor_signed_at).toLocaleString()}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3-Day Right to Cancel — embedded within contingency page for inspection reports */}
                  {isInspectionReport && (
                    <div className="mt-8">
                      <div className="rounded-xl border-2 border-red-300 bg-red-50 overflow-hidden">
                        <div className="bg-red-700 px-4 py-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
                          <span className="text-sm font-bold text-white">3-Day Right to Cancel</span>
                        </div>
                        <div className="p-4 space-y-3 text-sm text-gray-700">
                          <p className="font-semibold">Notice of Right to Cancel</p>
                          <p>The buyer may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction.</p>
                          <p>To cancel, deliver a signed and dated written notice of cancellation to:</p>
                          <div className="bg-white rounded-lg border border-red-200 p-3 text-xs space-y-0.5">
                            <p className="font-semibold">{company.name}</p>
                            {company.email && <p>{company.email}</p>}
                            {company.phone && <p>{company.phone}</p>}
                            {company.address && <p>{company.address}{company.city ? `, ${company.city}` : ''}{company.state ? `, ${company.state}` : ''} {company.zip || ''}</p>}
                          </div>
                          <p>If you cancel, any payments made by you under this contract will be returned within 10 business days of receipt of your cancellation notice, and any security interest arising out of this transaction will be cancelled.</p>
                          {(quote as any).contingency_cancel_signature_data && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-white p-3">
                              <p className="text-xs font-semibold text-red-700 mb-2">Customer Signature — Acknowledgment of Right to Cancel</p>
                              <img src={(quote as any).contingency_cancel_signature_data} alt="Cancel acknowledgment signature" className="max-w-full h-14 object-contain" />
                              {quote.contingency_signed_by && <p className="text-xs text-gray-500 mt-1">{quote.contingency_signed_by}</p>}
                              {(quote as any).contingency_cancel_signed_at && <p className="text-xs text-gray-400">{new Date((quote as any).contingency_cancel_signed_at).toLocaleString()}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentPage === 'financing' && (
                <div className="p-8 lg:p-12">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Financing Options</h2>
                      <p className="text-gray-500 text-sm">Flexible payment solutions to fit your budget</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {financingOptions.map((opt) => (
                      <div key={opt.id} className="border border-gray-200 rounded-xl p-6 hover:border-emerald-300 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900 text-lg">{opt.lender_name}</h3>
                            {(opt.apr_low != null || opt.apr_high != null) && (
                              <p className="text-sm text-gray-600 mt-1">
                                APR: {opt.apr_low != null && opt.apr_high != null && opt.apr_low !== opt.apr_high
                                  ? `${opt.apr_low}–${opt.apr_high}%`
                                  : `${opt.apr_low ?? opt.apr_high}%`}
                              </p>
                            )}
                            {opt.term_months && <p className="text-sm text-gray-600">Term: {opt.term_months} months</p>}
                            {opt.notes && <p className="text-sm text-gray-500 mt-2">{opt.notes}</p>}
                          </div>
                          {opt.application_url && (
                            <a href={opt.application_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors whitespace-nowrap">
                              Apply Now <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {lenderIntegrations.map((lender) => {
                      const ref = quote.share_token || '';
                      const applicationUrls: Record<string, string> = {
                        hearth: `https://apply.hearth.com/?contractorId=${lender.merchant_id || ''}&ref=${ref}`,
                        greensky: `https://www.greenskyonline.com/consumer/apply?merchant=${lender.api_key || ''}&contractor_ref=${ref}`,
                        service_finance: `https://portal.servicefinanceco.com/apply?dealer=${lender.api_key || ''}&ref=${ref}`,
                        synchrony: `https://www.mysynchrony.com/apply?merchant=${lender.api_key || ''}&ref=${ref}`,
                        foundation: `https://apply.foundationfinance.com/?dealer=${lender.api_key || ''}&ref=${ref}`,
                        sunlight: `https://apply.sunlightfinancial.com/?contractor=${lender.merchant_id || ''}&ref=${ref}`,
                      };
                      const lenderNames: Record<string, string> = {
                        hearth: 'Hearth Financing',
                        greensky: 'GreenSky',
                        service_finance: 'Service Finance Company',
                        synchrony: 'Synchrony Home',
                        foundation: 'Foundation Finance',
                        sunlight: 'Sunlight Financial',
                      };
                      const lenderDescs: Record<string, string> = {
                        hearth: 'Personal loans & lines of credit — fast approval, no dealer fees.',
                        greensky: 'Same-as-cash and low monthly payment home improvement loans.',
                        service_finance: 'Roofing & home improvement financing with competitive rates.',
                        synchrony: 'Deferred interest promotions and low APR options.',
                        foundation: 'Contractor-focused lending for exterior home improvement.',
                        sunlight: 'Flexible home improvement loans with competitive rates.',
                      };
                      const applyUrl = applicationUrls[lender.lender_key];
                      const name = lenderNames[lender.lender_key] || lender.lender_name || lender.lender_key;
                      const desc = lenderDescs[lender.lender_key] || '';
                      return (
                        <div key={lender.id || lender.lender_key} className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-6 hover:border-emerald-400 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-gray-900 text-lg">{name}</h3>
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Partner Lender</span>
                              </div>
                              {desc && <p className="text-sm text-gray-600 mt-1">{desc}</p>}
                              {lender.sandbox_mode && <p className="text-xs text-amber-600 mt-1">⚠ Test mode active</p>}
                            </div>
                            {applyUrl && (
                              <a href={applyUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors whitespace-nowrap">
                                Pre-Qualify <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* WARRANTY */}
              {inclWarranty && currentPage === 'warranty' && (
                <div className="p-8 lg:p-12">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                      <Shield className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Warranty Information</h2>
                  </div>

                  {/* Warranty text */}
                  <div className="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                    {company.warranty_text || 'Warranty information has not been set up yet.'}
                  </div>

                  {/* Contact card */}
                  <div className="mt-10 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                    <div className="px-6 py-4" style={{ backgroundColor: company.quote_primary_color || '#1e3a5f' }}>
                      <h3 className="text-white font-bold text-base">Warranty Claims &amp; Questions</h3>
                      <p className="text-white/70 text-xs mt-0.5">Contact us directly — we stand behind our work</p>
                    </div>
                    <div className="bg-white p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {company.phone && (
                        <a href={`tel:${company.phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors no-underline">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${company.quote_accent_color || '#ff6b35'}18` }}>
                            <Phone className="w-4 h-4" style={{ color: company.quote_accent_color || '#ff6b35' }} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium">Phone</p>
                            <p className="text-sm font-semibold text-gray-900">{company.phone}</p>
                          </div>
                        </a>
                      )}
                      {company.email && (
                        <a href={`mailto:${company.email}`} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors no-underline">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${company.quote_accent_color || '#ff6b35'}18` }}>
                            <Mail className="w-4 h-4" style={{ color: company.quote_accent_color || '#ff6b35' }} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium">Email</p>
                            <p className="text-sm font-semibold text-gray-900">{company.email}</p>
                          </div>
                        </a>
                      )}
                      {(company.address || company.city) && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${company.quote_accent_color || '#ff6b35'}18` }}>
                            <MapPin className="w-4 h-4" style={{ color: company.quote_accent_color || '#ff6b35' }} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium">Office</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {[company.address, company.city, company.state].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </div>
                      )}
                      {company.license_number && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${company.quote_accent_color || '#ff6b35'}18` }}>
                            <FileText className="w-4 h-4" style={{ color: company.quote_accent_color || '#ff6b35' }} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium">License #</p>
                            <p className="text-sm font-semibold text-gray-900">{company.license_number}</p>
                          </div>
                        </div>
                      )}
                      {company.website && (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors no-underline sm:col-span-2">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${company.quote_accent_color || '#ff6b35'}18` }}>
                            <Globe className="w-4 h-4" style={{ color: company.quote_accent_color || '#ff6b35' }} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-medium">Website</p>
                            <p className="text-sm font-semibold text-gray-900">{company.website.replace(/^https?:\/\//, '')}</p>
                          </div>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* What happens next timeline */}
                  <div className="mt-10">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">What Happens After You Sign</h3>
                    <div className="relative">
                      {/* Vertical connector line */}
                      <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-200" />
                      <div className="space-y-5">
                        {[
                          { step: 1, title: 'Agreement Signed', desc: 'Your signed proposal is locked in and your project is officially confirmed.' },
                          { step: 2, title: 'Materials Ordered', desc: 'We order and stage all materials specific to your project scope.' },
                          { step: 3, title: 'Project Scheduled', desc: 'Our team contacts you within 1–2 business days to set your installation date.' },
                          { step: 4, title: 'Installation Day', desc: 'Our crew arrives on-site and completes the work to the agreed specification.' },
                          { step: 5, title: 'Final Walkthrough', desc: 'We walk the completed project with you, answer any questions, and confirm your satisfaction.' },
                        ].map(({ step, title, desc }) => (
                          <div key={step} className="flex items-start gap-4 relative">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 font-bold text-sm text-white shadow-sm"
                              style={{ backgroundColor: company.quote_accent_color || '#ff6b35' }}
                            >
                              {step}
                            </div>
                            <div className="flex-1 pt-1.5 pb-1">
                              <p className="font-semibold text-gray-900">{title}</p>
                              <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SIGNATURE */}
              {currentPage === 'signature' && (
                <div className="p-8 lg:p-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Acceptance &amp; Signature</h2>
                  <div className="bg-gray-50 rounded-xl p-6 mb-6"><p className="text-sm text-gray-700 leading-relaxed">By signing below, I acknowledge that I have reviewed the proposal, understand the scope of work, and agree to the terms and pricing. I understand I have a <strong>three (3) business day right to cancel</strong> after signing.</p></div>
                  {isSigned ? (
                    <div className="space-y-4">
                      {/* Customer signature */}
                      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-green-800">Customer Acceptance</p>
                            <p className="text-sm text-green-600">Signed by {quote.signed_by}{quote.signed_at ? ` on ${new Date(quote.signed_at).toLocaleString()}` : ''}</p>
                          </div>
                        </div>
                        {quote.signature_data && <img src={quote.signature_data} alt="Customer signature" className="max-w-xs border border-green-200 rounded-lg bg-white p-2" />}
                      </div>
                      {/* Contractor counter-signature */}
                      <div className={`rounded-xl p-6 border ${quote.contractor_signature_data ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 border-dashed'}`}>
                        <div className="flex items-center gap-3 mb-3">
                          {quote.contractor_signature_data
                            ? <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                            : <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0" />
                          }
                          <div>
                            <p className={`font-semibold ${quote.contractor_signature_data ? 'text-blue-800' : 'text-gray-500'}`}>Contractor Acceptance</p>
                            {quote.contractor_signature_data
                              ? <p className="text-sm text-blue-600">Signed by {quote.contractor_signed_by}{quote.contractor_signed_at ? ` on ${new Date(quote.contractor_signed_at).toLocaleString()}` : ''}</p>
                              : <p className="text-sm text-gray-400">Awaiting contractor counter-signature</p>
                            }
                          </div>
                        </div>
                        {quote.contractor_signature_data && <img src={quote.contractor_signature_data} alt="Contractor signature" className="max-w-xs border border-blue-200 rounded-lg bg-white p-2" />}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
                        <strong>Funding preference:</strong> {fundingPreference === 'financing' ? 'Financing' : fundingPreference === 'cash' ? 'Cash / Check' : 'Not selected'}
                        <button onClick={() => { setShowSignature(false); setSignStep(null); setShowFundingChoice(true); }} className="ml-3 text-blue-600 underline text-xs">Change</button>
                      </div>
                      <SignatureCanvas onSign={(sigData, _name) => handleAgreementSign(sigData)} signerName={`${quote.customer?.first_name || ''} ${quote.customer?.last_name || ''}`.trim()} />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Funding choice modal — classic view */}
          {showFundingChoice && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
              <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl">
                <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">How would you like to pay?</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Choose your payment preference before signing.</p>
                  </div>
                  <button onClick={() => setShowFundingChoice(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="p-5 space-y-3">
                  <button onClick={() => setFundingPreference('cash')} className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors ${fundingPreference === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'}`}>
                    <span className="text-2xl shrink-0">💵</span>
                    <div><p className="font-bold text-gray-900">Cash / Check</p><p className="text-sm text-gray-500 mt-0.5">Pay at project completion or per milestone</p></div>
                    {fundingPreference === 'cash' && <CheckCircle className="w-5 h-5 text-green-600 ml-auto shrink-0 mt-0.5" />}
                  </button>
                  <button onClick={() => setFundingPreference('financing')} className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors ${fundingPreference === 'financing' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                    <span className="text-2xl shrink-0">🏦</span>
                    <div><p className="font-bold text-gray-900">Financing</p><p className="text-sm text-gray-500 mt-0.5">Apply through a financing partner — we'll follow up with options</p></div>
                    {fundingPreference === 'financing' && <CheckCircle className="w-5 h-5 text-blue-600 ml-auto shrink-0 mt-0.5" />}
                  </button>
                  {fundingPreference === 'financing' && financingOptions.length === 0 && lenderIntegrations.length === 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">We'll reach out with financing application details after you sign.</div>
                  )}
                  <button disabled={!fundingPreference} onClick={handleFundingContinue} className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <ArrowRight className="w-4 h-4" /> Continue to Sign
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Two-step signing modals */}
          {showSignature && signStep === 'agreement' && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
              <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl">
                <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100">
                  <div><h3 className="font-bold text-lg text-gray-900">Quote Acceptance Agreement</h3><p className="text-xs text-gray-500 mt-0.5">Sign to accept the scope and pricing.</p></div>
                  <button onClick={() => { setShowSignature(false); setSignStep(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="p-4"><SignatureCanvas onSign={(sigData, _name) => handleAgreementSign(sigData)} signerName={`${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim()} /></div>
              </div>
            </div>
          )}
          {signStep === 'cancel' && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
              <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl">
                <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-amber-100 bg-amber-50 sm:rounded-t-2xl rounded-t-2xl">
                  <div><h3 className="font-bold text-lg text-amber-900">3-Day Right to Cancel — Step 2 of 2</h3><p className="text-xs text-amber-700 mt-0.5">Sign to confirm you received the cancellation notice.</p></div>
                  <button onClick={() => setSignStep(null)} className="p-2 hover:bg-amber-100 rounded-lg"><X className="w-5 h-5 text-amber-700" /></button>
                </div>
                <div className="p-4"><SignatureCanvas onSign={(sigData, _name) => handleCancelSign(sigData)} signerName={`${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim()} /></div>
              </div>
            </div>
          )}
        </div>
      );
  }

  // ── Customer-facing modern view (Professional layout) ──
  if (isCustomerView) {
    return (
      <>
      <style>{`
        /* Cloned print content (injected on beforeprint, below) stays
           hidden on screen — it should only ever be visible to the print
           engine, never during normal browsing. */
        #__live_print_clone__ { display: none; }
        @media print {
          /* Native Cmd+P prints this outer shell, not the iframe. Fixed
             positioning gets dropped/clipped by print engines, so hide it
             and let the beforeprint-injected clone be what actually
             renders on paper. */
          .customer-live-shell { display: none !important; }
          #__live_print_clone__ { display: block !important; }
        }
      `}</style>
      <div className="customer-live-shell fixed inset-0 flex flex-col bg-gray-100">
        {/* iframe fills the viewport */}
        {quoteHtml ? (
          <iframe
            ref={previewIframeRef}
            srcDoc={quoteHtml}
            title="Quote Preview"
            className="flex-1 w-full border-0"
            style={{ minHeight: 0 }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
          </div>
        )}

        {/* Sticky sign bar */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-center gap-3 shadow-lg relative">
          {isSigned && (!isCustomerView || !quote?.completion_certificate_enabled || quote?.certificate_customer_signed_at) ? (
            <div className="flex items-center justify-between w-full gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-green-700 font-semibold">
                <CheckCircle className="w-5 h-5" />
                <span>{isInspectionReport ? 'Agreement Signed — Thank you!' : 'Quote Accepted & Signed — Thank you!'}</span>
              </div>
              {isCustomerView ? (
                <button
                  onClick={() => { try { window.close(); } catch { window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
                  className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm"
                >
                  <CheckCircle className="w-4 h-4" /> Done
                </button>
              ) : (
                quote.contractor_signature_data && !contractorSigBroken ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={quote.contractor_signature_data}
                      alt="Your Signature"
                      className="h-8 object-contain"
                      onError={() => setContractorSigBroken(true)}
                    />
                    <span className="text-xs text-gray-500">{quote.contractor_signed_by}</span>
                    <button
                      onClick={() => setShowContractorSign(true)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Re-sign
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowContractorSign(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <PenLine className="w-4 h-4" />
                    {quote.contractor_signature_data ? 'Signature not showing — Re-sign' : 'Add Your Signature'}
                  </button>
                )
              )}
            </div>
          ) : isCustomerView && showTierSignButton ? (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => {
                  const multiTier = quote.include_better !== false || quote.include_best !== false;
                  if (multiTier) {
                    // Pre-populate checkboxes from any prior selection
                    const prior = selectedTier ? (selectedTier === 'all' ? new Set(['good','better','best']) : new Set(selectedTier.split(','))) : new Set<string>();
                    setPickedTiers(prior);
                    setShowTierSelect(true);
                  } else { openFundingStep(); }
                }}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors shadow-sm"
              >
                <CheckCircle className="w-4 h-4" /> {(quote.include_better === false && quote.include_best === false) ? 'Accept & Sign' : 'Choose Your Option & Sign'}
              </button>
              <p className="text-xs text-gray-400">{(quote.include_better === false && quote.include_best === false) ? 'Review your quote and sign to get started.' : "You'll pick your tier, payment preference, and review everything before signing."}</p>
            </div>
          ) : showTierSignButton ? (
            <span className="text-sm text-gray-500">Awaiting customer signature</span>
          ) : isInspectionReport && quote?.contingency_enabled && !isSigned ? (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => { setContingencySignStep('agreement'); setContingencyAgreementSig(null); setShowContingencySigning(true); }}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Shield className="w-4 h-4" /> Review &amp; Sign Agreement
              </button>
              <p className="text-xs text-gray-400">Sign the insurance contingency agreement and 3-day right to cancel.</p>
            </div>
          ) : quote?.completion_certificate_enabled && !quote?.certificate_customer_signed_at ? (
            <div className="flex flex-col items-center gap-1">
              {isSigned && (
                <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold mb-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Agreement signed
                </div>
              )}
              <button
                onClick={() => {
                  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
                  const token = shareToken || quote.share_token;
                  window.location.href = `${window.location.origin}${base}?token=${token}&cert=1`;
                }}
                className="flex items-center gap-2 px-8 py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 transition-colors shadow-sm"
              >
                <Award className="w-4 h-4" /> Sign Completion Certificate
              </button>
              <p className="text-xs text-gray-400">Sign the Certificate of Completion for this project.</p>
            </div>
          ) : quote?.certificate_customer_signed_at ? (
            // Deliberately NOT gated on completion_certificate_enabled. That flag
            // is current configuration ("does this quote include a certificate"),
            // while certificate_customer_signed_at is a historical fact. Turning
            // the certificate off after the customer had already signed it made
            // this branch fall through to null, so a signed certificate stopped
            // reporting as signed even though the signature was still on record.
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <CheckCircle className="w-5 h-5" />
              <span>Certificate Signed — Thank you!</span>
            </div>
          ) : null}
          {quoteHtml && (
            <button
              onClick={handleDownloadLive}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
          )}
        </div>

        {/* Funding choice modal — part of the "Choose Your Option & Sign" flow */}
        {showFundingChoice && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl">
              <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">How would you like to pay?</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Choose your payment preference before signing.</p>
                </div>
                <button onClick={() => setShowFundingChoice(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <button
                  onClick={() => setFundingPreference('cash')}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors ${fundingPreference === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'}`}
                >
                  <span className="text-2xl shrink-0">💵</span>
                  <div>
                    <p className="font-bold text-gray-900">Cash / Check</p>
                    <p className="text-sm text-gray-500 mt-0.5">Pay at project completion or per milestone</p>
                  </div>
                  {fundingPreference === 'cash' && <CheckCircle className="w-5 h-5 text-green-600 ml-auto shrink-0 mt-0.5" />}
                </button>
                <button
                  onClick={() => setFundingPreference('financing')}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors ${fundingPreference === 'financing' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}
                >
                  <span className="text-2xl shrink-0">🏦</span>
                  <div>
                    <p className="font-bold text-gray-900">Financing</p>
                    <p className="text-sm text-gray-500 mt-0.5">Apply through a financing partner — we'll follow up with options</p>
                  </div>
                  {fundingPreference === 'financing' && <CheckCircle className="w-5 h-5 text-blue-600 ml-auto shrink-0 mt-0.5" />}
                </button>

                {/* Show available financing options if configured */}
                {fundingPreference === 'financing' && (financingOptions.length > 0 || lenderIntegrations.length > 0) && (
                  <div className="mt-1 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Available Options</p>
                    {financingOptions.map((opt) => (
                      <div key={opt.id} className="flex items-start justify-between gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-xl">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{opt.lender_name}</p>
                          {opt.program_name && <p className="text-xs text-gray-600">{opt.program_name}</p>}
                          {(opt.apr_low != null || opt.apr_high != null) && (
                            <p className="text-xs text-gray-500">
                              APR: {opt.apr_low != null && opt.apr_high != null && opt.apr_low !== opt.apr_high
                                ? `${opt.apr_low}–${opt.apr_high}%`
                                : `${opt.apr_low ?? opt.apr_high}%`}
                            </p>
                          )}
                          {opt.term_months && <p className="text-xs text-gray-500">Term: {opt.term_months} months</p>}
                        </div>
                        {opt.application_url && (
                          <a href={opt.application_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 whitespace-nowrap">
                            Apply Now <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Financing interest note when no options are configured */}
                {fundingPreference === 'financing' && financingOptions.length === 0 && lenderIntegrations.length === 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                    We'll reach out with financing application details after you sign.
                  </div>
                )}

                <button
                  disabled={!fundingPreference}
                  onClick={handleFundingContinue}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowRight className="w-4 h-4" /> Continue to Sign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 0: Tier selection modal */}
        {showTierSelect && (() => {
          const goodName = quote.good_tier_name || 'Good';
          const betterName = quote.better_tier_name || 'Better';
          const bestName = quote.best_tier_name || 'Best';
          const inclBetter = quote.include_better !== false;
          const inclBest = quote.include_best !== false;
          // Compute live totals (fallback when saved total is 0, e.g. Strike Mode quotes)
          const calcGood   = lineItems.reduce((s, i) => s + (i.quantity ?? 0) * (i.good_price   ?? 0), 0);
          const calcBetter = lineItems.reduce((s, i) => s + (i.quantity ?? 0) * (i.better_price ?? 0), 0);
          const calcBest   = lineItems.reduce((s, i) => s + (i.quantity ?? 0) * (i.best_price   ?? 0), 0);
          const resolvedGood   = quote.use_manual_totals && quote.manual_good_total   != null ? quote.manual_good_total   : (quote.good_total   || calcGood);
          const resolvedBetter = quote.use_manual_totals && quote.manual_better_total != null ? quote.manual_better_total : (quote.better_total || calcBetter);
          const resolvedBest   = quote.use_manual_totals && quote.manual_best_total   != null ? quote.manual_best_total   : (quote.best_total   || calcBest);
          const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v ?? 0);
          const tiers = [
            { key: 'good' as const, name: goodName, total: resolvedGood, badge: null as string | null, desc: quote.tier_desc_good || 'Essential coverage at the best value.' },
            ...(inclBetter ? [{ key: 'better' as const, name: betterName, total: resolvedBetter, badge: 'Most Popular', desc: quote.tier_desc_better || 'Enhanced protection with added peace of mind.' }] : []),
            ...(inclBest ? [{ key: 'best' as const, name: bestName, total: resolvedBest, badge: 'Best Value', desc: quote.tier_desc_best || 'Premium solution — everything included.' }] : []),
          ];

          // Serialize checked tiers: 1 key → 'good'; 2 keys → 'good,better'; all → 'all'
          const serializePicked = (picked: Set<string>): string => {
            const ordered = ['good', 'better', 'best'].filter(k => picked.has(k));
            if (ordered.length >= tiers.length && tiers.length > 1) return 'all';
            return ordered.join(',');
          };

          const noneChecked = pickedTiers.size === 0;
          const pickedTotal = tiers.filter(t => pickedTiers.has(t.key)).reduce((s, t) => s + t.total, 0);

          const selectTier = (key: string) => {
            setPickedTiers(new Set([key]));
          };

          const handleContinue = () => {
            const picked = [...pickedTiers][0] || 'good';
            setSelectedTier(picked);
            setShowTierSelect(false);
            const cats = [...new Set(lineItems.map(li => li.category))].filter(Boolean);
            setCustomerSelectedSections(cats);
            const upgrades = Array.isArray(quote.upgrades) ? quote.upgrades : [];
            if (upgrades.length > 0) { setShowUpgradesSelect(true); }
            else { openFundingStep(); }
            trackQuoteEvent('tier_selected', picked);
          };

          const checkColors: Record<string, string> = {
            good:   'border-emerald-400 bg-emerald-50',
            better: 'border-blue-400 bg-blue-50',
            best:   'border-amber-400 bg-amber-50',
          };
          const checkActive: Record<string, string> = {
            good:   'bg-emerald-500',
            better: 'bg-blue-500',
            best:   'bg-amber-500',
          };

          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
              <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Choose Your Package</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Select one option — you'll review everything before signing.</p>
                  </div>
                  <button onClick={() => setShowTierSelect(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Tier checkboxes */}
                <div className="p-4 flex flex-col gap-3 overflow-y-auto">
                  {tiers.map(tier => {
                    const checked = pickedTiers.has(tier.key);
                    return (
                      <button
                        key={tier.key}
                        onClick={() => selectTier(tier.key)}
                        className={`w-full text-left border-2 rounded-xl p-4 transition-all hover:shadow-md ${checked ? checkColors[tier.key] : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Radio */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? `${checkActive[tier.key]} border-transparent` : 'border-gray-300 bg-white'}`}>
                            {checked && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 text-base">{tier.name}</span>
                                {tier.badge && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#ff6b35] text-white">{tier.badge}</span>}
                              </div>
                              <span className="text-lg font-bold text-gray-900 flex-shrink-0">{fmt(tier.total)}</span>
                            </div>
                            <p className="text-sm text-gray-500 leading-snug mt-0.5">{tier.desc}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                </div>

                {/* Footer: selected total + Continue */}
                <div className="px-4 pb-5 pt-3 border-t border-gray-100 flex flex-col gap-2">
                  {!noneChecked && (
                    <div className="flex items-center justify-between text-sm text-gray-600 px-1">
                      <span>{[...pickedTiers][0] ? tiers.find(t => t.key === [...pickedTiers][0])?.name : ''} selected</span>
                      <span className="font-semibold text-gray-900">{fmt(pickedTotal)}</span>
                    </div>
                  )}
                  <button
                    onClick={handleContinue}
                    disabled={noneChecked}
                    className={`w-full py-3 rounded-xl font-semibold text-base transition-all ${noneChecked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#1e3a5f] hover:bg-[#152d4a] text-white shadow-sm'}`}
                  >
                    {noneChecked ? 'Select a package to continue' : 'Continue →'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Step 0b: Sections selection removed — all sections are required and always included */}

        {/* Step 0c: Suggested upgrades selection modal */}
        {showUpgradesSelect && (() => {
          const upgrades: any[] = Array.isArray(quote.upgrades) ? quote.upgrades : [];
          // For upgrade unit price display, use the selected tier; fall back to 'good'
          const tier = (selectedTier && selectedTier !== 'all' ? selectedTier : 'good') as string;
          // The single tier the customer selected
          const selectedTierKeys: string[] = [tier];
          const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v ?? 0);
          const toggleUpgrade = (upg: any) => setCustomerSelectedUpgrades(prev => {
            const key = upg.name || upg.id;
            const exists = prev.some(u => (u.name || u.id) === key);
            return exists ? prev.filter(u => (u.name || u.id) !== key) : [...prev, upg];
          });
          const getPrice = (upg: any) => ((upg.quantity || 1) * ((upg.price ?? upg[tier + '_price'] ?? upg.good_price) || 0));
          const addedTotal = customerSelectedUpgrades.reduce((s, u) => s + getPrice(u), 0);
          const hasRequests = customerServiceRequests.length > 0;
          const proceed = async () => {
            if (hasRequests) {
              // Save requests to DB, notify contractor, show pending screen
              const signerName = `${quote.customer?.first_name || ''} ${quote.customer?.last_name || ''}`.trim() || 'Customer';
              try {
                await supabase.from('quotes').update({
                  status: 'revision_requested',
                  customer_service_requests: customerServiceRequests.map(r => ({
                    text: r,
                    requested_by: signerName,
                    requested_at: new Date().toISOString(),
                  })),
                  ...(customerSelectedUpgrades.length > 0 ? { customer_selected_upgrades: customerSelectedUpgrades } : {}),
                  ...(customerSelectedSections ? { customer_selected_sections: customerSelectedSections } : {}),
                  ...(selectedTier ? { selected_tier: selectedTier } : {}),
                }).eq('id', quoteId);

                // Notify contractor by email
                const contractorEmail = company.quote_sender_email || company.quote_reply_to_email || company.email;
                const shareUrl = quote.share_token ? `${window.location.origin}/?token=${quote.share_token}` : null;
                if (contractorEmail) {
                  supabase.functions.invoke('send-quote-email', {
                    body: {
                      company_id: company.id,
                      share_token: quote.share_token,
                      to_email: contractorEmail,
                      to_name: company.name,
                      from_company: company.name,
                      quote_number: quote.quote_number,
                      quote_url: shareUrl,
                      email_subject: `Service Request from ${signerName} – Quote #${quote.quote_number || ''}`,
                      email_message: `${signerName} is interested in your quote but has requested additional services before signing:\n\n${customerServiceRequests.map(r => `• ${r}`).join('\n')}\n\nPlease update the quote and resend for their review.`,
                    },
                  }).catch(console.error);
                }

                setQuote((prev: any) => ({ ...prev, status: 'revision_requested' }));
                setShowUpgradesSelect(false);
                setShowRevisionPending(true);
              } catch {
                toast.error('Failed to send request. Please try again.');
              }
            } else {
              setShowUpgradesSelect(false);
              openFundingStep();
            }
          };
          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
              <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Add-ons & Upgrades</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Optional enhancements — select any you'd like to include.</p>
                  </div>
                  <button onClick={() => setShowUpgradesSelect(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
                  {upgrades.map((upg, i) => {
                    const key = upg.name || upg.id || i;
                    const isSelected = customerSelectedUpgrades.some(u => (u.name || u.id || upgrades.indexOf(u)) === key);
                    return (
                      <button key={i} onClick={() => toggleUpgrade(upg)}
                        className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${isSelected ? 'border-[#ff6b35] bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'bg-[#ff6b35] border-[#ff6b35]' : 'border-gray-300'}`}>
                          {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-gray-900">{upg.name || upg.item_name}</span>
                            <span className="text-sm font-bold text-[#ff6b35] whitespace-nowrap">+{fmt(getPrice(upg))}</span>
                          </div>
                          {(upg.description || upg.ai_description) && (
                            <p className="text-xs text-gray-500 mt-1 leading-snug">{upg.description || upg.ai_description}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {/* Request Additional Service — shown only when enabled in company settings */}
                  {(company.enable_service_requests ?? true) && <div className="mt-1 border-2 border-dashed border-gray-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Need something not listed?</p>
                    <p className="text-xs text-gray-500 mb-3">Request additional services — we'll update your quote and resend before you sign.</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={serviceRequestInput}
                        onChange={e => setServiceRequestInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && serviceRequestInput.trim()) {
                            setCustomerServiceRequests(prev => [...prev, serviceRequestInput.trim()]);
                            setServiceRequestInput('');
                          }
                        }}
                        placeholder="e.g. Gutters, Gutter guards..."
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                      />
                      <button
                        onClick={() => {
                          if (serviceRequestInput.trim()) {
                            setCustomerServiceRequests(prev => [...prev, serviceRequestInput.trim()]);
                            setServiceRequestInput('');
                          }
                        }}
                        disabled={!serviceRequestInput.trim()}
                        className="px-3 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#162d4a] transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    {customerServiceRequests.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {customerServiceRequests.map((req, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs font-medium px-3 py-1.5 rounded-full">
                            {req}
                            <button onClick={() => setCustomerServiceRequests(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-yellow-900">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>}
                </div>
                <div className="px-4 py-4 border-t border-gray-100 space-y-3">
                  {(() => {
                    // Base = tier total minus any deselected sections
                    // Sum totals across ALL selected tiers/scopes
                    const baseTotal: number = selectedTierKeys.reduce((sum, t) => {
                      const tierTotalKey = (t + '_total') as keyof typeof quote;
                      const manualTotalKey = ('manual_' + t + '_total') as keyof typeof quote;
                      const tTotal = quote.use_manual_totals && quote[manualTotalKey] != null
                        ? (quote[manualTotalKey] as number)
                        : ((quote[tierTotalKey] as number) ?? 0);
                      return sum + tTotal;
                    }, 0);
                    let sectionDeduction = 0;
                    if (customerSelectedSections !== null) {
                      sectionDeduction = selectedTierKeys.reduce((sum, t) => {
                        const priceKey = (t + '_price') as 'good_price' | 'better_price' | 'best_price';
                        const tierItems = lineItems.filter(li =>
                          !li.tiers_applicable || li.tiers_applicable.length === 0 || li.tiers_applicable.includes(t as any)
                        );
                        const allCats = [...new Set(tierItems.map(li => li.category))].filter(Boolean);
                        const deselectedCats = allCats.filter(cat => !customerSelectedSections.includes(cat));
                        return sum + deselectedCats.reduce((total, cat) =>
                          total + tierItems.filter(li => li.category === cat)
                            .reduce((s, li) => s + ((li[priceKey] ?? 0) * (li.quantity ?? 1)), 0), 0);
                      }, 0);
                    }
                    const sectionBase = baseTotal - sectionDeduction;
                    const finalTotal = sectionBase + addedTotal;
                    return (
                      <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                        {sectionDeduction > 0 && (
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>Scope subtotal</span><span>{fmt(sectionBase)}</span>
                          </div>
                        )}
                        {addedTotal > 0 && (
                          <div className="flex justify-between text-sm text-[#ff6b35] font-medium">
                            <span>+ {customerSelectedUpgrades.length} upgrade{customerSelectedUpgrades.length !== 1 ? 's' : ''}</span>
                            <span>+{fmt(addedTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200">
                          <span>Your Total</span><span>{fmt(finalTotal)}</span>
                        </div>
                      </div>
                    );
                  })()}
                  {hasRequests && (
                    <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2.5 text-xs text-yellow-800">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-600" />
                      <span>You have service requests — you won't be able to sign until we update and resend your quote.</span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setShowUpgradesSelect(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>
                    <button onClick={proceed} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors text-white ${hasRequests ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'}`}>
                      {hasRequests ? 'Send Request →' : customerSelectedUpgrades.length > 0 ? 'Add & Continue →' : 'Skip & Continue →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Step 1: Agreement signature modal */}
        {showSignature && signStep === 'agreement' && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
            <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl">
              <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Quote Acceptance Agreement</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Sign to accept the scope and pricing of this proposal.</p>
                </div>
                <button onClick={() => { setShowSignature(false); setSignStep(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              {/* Order summary — tier breakdown + grand total */}
              {(() => {
                const fmtCur = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v ?? 0);
                // Always use a single tier — treat legacy 'all' as 'good' fallback
                const selTier = (!selectedTier || selectedTier === 'all') ? 'good' : selectedTier.split(',')[0];
                const selKeys: string[] = [selTier];
                const calcGood   = lineItems.reduce((s, i) => s + (i.quantity ?? 0) * (i.good_price   ?? 0), 0);
                const calcBetter = lineItems.reduce((s, i) => s + (i.quantity ?? 0) * (i.better_price ?? 0), 0);
                const calcBest   = lineItems.reduce((s, i) => s + (i.quantity ?? 0) * (i.best_price   ?? 0), 0);
                const resolvedMap: Record<string, number> = {
                  good:   quote.use_manual_totals && quote.manual_good_total   != null ? quote.manual_good_total   : (quote.good_total   || calcGood),
                  better: quote.use_manual_totals && quote.manual_better_total != null ? quote.manual_better_total : (quote.better_total || calcBetter),
                  best:   quote.use_manual_totals && quote.manual_best_total   != null ? quote.manual_best_total   : (quote.best_total   || calcBest),
                };
                const tierNameMap: Record<string, string> = {
                  good:   quote.good_tier_name   || 'Good',
                  better: quote.better_tier_name || 'Better',
                  best:   quote.best_tier_name   || 'Best',
                };
                const upgTotal = customerSelectedUpgrades.reduce((s, u: any) => {
                  const t = selKeys[0] || 'good';
                  return s + ((u.quantity || 1) * ((u.price ?? u[t + '_price'] ?? u.good_price) || 0));
                }, 0);
                const baseTotal = resolvedMap[selTier] ?? 0;
                const grandTotal = baseTotal + upgTotal;
                return (
                  <div className="px-5 pt-3 pb-2">
                    <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{tierNameMap[selTier]} Package</span>
                        <span>{fmtCur(baseTotal)}</span>
                      </div>
                      {upgTotal > 0 && (
                        <div className="flex justify-between text-sm text-[#ff6b35] font-medium">
                          <span>+ {customerSelectedUpgrades.length} upgrade{customerSelectedUpgrades.length !== 1 ? 's' : ''}</span>
                          <span>+{fmtCur(upgTotal)}</span>
                        </div>
                      )}
                      <div className={`flex justify-between font-bold text-gray-900 text-base ${upgTotal > 0 ? 'pt-1 border-t border-gray-200' : ''}`}>
                        <span>Total Amount Due</span>
                        <span>{fmtCur(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="p-4">
                <SignatureCanvas
                  onSign={(sigData, _name) => handleAgreementSign(sigData)}
                  signerName={`${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim()}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Cancel notice signature modal */}
        {signStep === 'cancel' && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
            <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl">
              <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-amber-100 bg-amber-50 sm:rounded-t-2xl rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-lg text-amber-900">3-Day Right to Cancel — Step 2 of 2</h3>
                  <p className="text-xs text-amber-700 mt-0.5">Please sign to confirm you received and understood the cancellation notice.</p>
                </div>
                <button onClick={() => setSignStep(null)} className="p-2 hover:bg-amber-100 rounded-lg">
                  <X className="w-5 h-5 text-amber-700" />
                </button>
              </div>
              <div className="p-4">
                <SignatureCanvas
                  onSign={(sigData, _name) => handleCancelSign(sigData)}
                  signerName={`${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim()}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contingency signing modal — must live inside the customer view return so it renders */}
      {showContingencySigning && isInspectionReport && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center sm:justify-center overflow-y-auto">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[95vh] flex flex-col">
            <div className="bg-indigo-700 px-5 py-4 sm:rounded-t-2xl flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    {contingencySignStep === 'agreement' ? 'Insurance Contingency Agreement' : '3-Day Right to Cancel'}
                  </h2>
                  <p className="text-xs text-indigo-200">Step {contingencySignStep === 'agreement' ? '1' : '2'} of 2</p>
                </div>
              </div>
              <button onClick={() => setShowContingencySigning(false)} className="text-white/70 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {contingencySignStep === 'agreement' ? (
                <>
                  <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-center">
                    <p className="font-bold text-amber-900 text-sm">THREE (3) BUSINESS DAY RIGHT TO CANCEL</p>
                    <p className="text-xs text-amber-800 mt-1">You may cancel this agreement without penalty within 3 business days of signing. See Step 2 for the cancellation notice.</p>
                  </div>
                  <div className="space-y-3 text-sm text-gray-700">
                    {([
                      ['1. Contingency Basis', "This Agreement is entered into on a contingency basis. No restoration or repair work will be performed and no payment will be due from the Property Owner unless and until the Property Owner's insurance carrier approves a claim for the repair or replacement of damage to the property described herein."],
                      ['2. Authorization to Act', "Property Owner hereby authorizes Contractor to communicate directly with Property Owner's insurance company, insurance adjuster, and any related parties on Property Owner's behalf for the sole purpose of facilitating the insurance claim and scope of approved repairs. This authorization does not constitute assignment of benefits."],
                      ['3. Scope of Work', 'Contractor agrees to perform all work as outlined and approved in the final insurance scope of loss issued by the insurance carrier. Any supplements or additional line items identified during the course of the project that are approved by the insurance carrier shall be included in the final contract price.'],
                      ['4. Payment Terms', "Property Owner agrees to pay Contractor all insurance proceeds received from the insurance carrier for covered repairs, including any recoverable depreciation released upon completion of work, all approved supplements, and the applicable insurance deductible as stated in the Property Owner's policy. Property Owner shall not profit from the insurance claim proceeds beyond the cost of the completed work."],
                      ['5. No Out-of-Pocket Cost Representation', "Contractor makes no guarantee that Property Owner will owe nothing beyond the deductible. Final amounts owed are determined by the insurance carrier's approved scope and applicable policy terms."],
                      ['6. Property Owner Responsibilities', 'Property Owner agrees to promptly provide Contractor with all insurance documentation, adjuster reports, and claim correspondence. Property Owner shall not independently settle or close the insurance claim without written consent from Contractor while this Agreement is in effect.'],
                      ['7. Contractor Obligations', 'Contractor agrees to provide professional workmanship meeting or exceeding industry standards, maintain all required licenses and insurance coverage, and pursue all legitimate supplements on behalf of the Property Owner at no additional charge to the Property Owner beyond the approved insurance scope.'],
                      ['8. Cancellation', 'Either party may cancel this Agreement within three (3) business days of execution without penalty. After the three-day rescission period, cancellation by the Property Owner after work has commenced may result in liability for costs incurred by Contractor up to the date of cancellation.'],
                    ] as [string, string][]).map(([title, body]) => (
                      <div key={title}>
                        <p className="font-semibold text-gray-900 text-xs">{title}</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-semibold text-gray-800">Sign below to agree to the Insurance Contingency Agreement</p>
                    <SignatureCanvas
                      onSign={handleContingencyAgreementSign}
                      signerName={`${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim()}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 space-y-2">
                    <p className="font-bold text-red-900 text-base text-center">NOTICE OF THREE (3) DAY RIGHT TO CANCEL</p>
                    <p className="text-sm text-red-800 leading-relaxed">
                      You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right.
                    </p>
                    <p className="text-sm text-red-800 leading-relaxed">
                      To cancel this transaction, you may mail or deliver a signed and dated copy of this cancellation notice to:
                    </p>
                    <p className="text-sm font-semibold text-red-900">{company?.name}</p>
                    {company?.address && <p className="text-sm text-red-800">{company.address}</p>}
                    {company?.email && <p className="text-sm text-red-800">{company.email}</p>}
                    <p className="text-sm text-red-800 leading-relaxed">
                      NOT LATER THAN MIDNIGHT OF{' '}
                      <span className="font-bold">
                        {new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>.
                    </p>
                    <p className="text-sm text-red-800 leading-relaxed font-semibold">
                      If you cancel, any property traded in, any payments made by you under the contract or sale, and any negotiable instrument executed by you will be returned within 10 business days following receipt by the seller of your cancellation notice.
                    </p>
                  </div>
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-semibold text-gray-800">Sign below to acknowledge receipt of the 3-Day Right to Cancel notice</p>
                    <SignatureCanvas
                      onSign={savingContingencySign ? () => {} : handleContingencyCancelSign}
                      signerName={contingencySignerName || `${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim()}
                    />
                    {savingContingencySign && (
                      <div className="flex items-center gap-2 justify-center text-indigo-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Saving signatures…</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  const includeAboutPage = quote.include_about_page !== false;
  const includeWarrantyPage = quote.include_warranty_page !== false;
  const includeCancelNotice = quote.include_cancel_notice !== false;
  const includeBetter = quote.include_better !== false;
  const includeBest = quote.include_best !== false;
  const showLineItemPrices = quote.show_line_item_prices !== false;
  const showSectionTotals = quote.show_section_totals !== false;
  const showItemDescriptions2 = quote.show_item_descriptions !== false;

  // Same multi-scope test as above — only use opt.name when items are actually linked
  const tierPages = (isInspectionReport || isInsuranceInvoice || quote?.contingency_enabled)
    ? []
    : isMultiScopePreview
      ? visibleQuoteOptions.map(opt => ({ id: `opt-${opt.id}`, label: `✦ ${opt.name}`, tier: 'good' as const, optionId: opt.id }))
      : (() => {
        const singleTier = !includeBetter && !includeBest;
        return [
          { id: 'option-good', label: singleTier ? '✦ Project Scope' : `✦ ${quote.good_tier_name || 'Good'} Option`, tier: 'good' as const },
          ...(includeBetter ? [{ id: 'option-better', label: `✦ ${quote.better_tier_name || 'Better'} Option`, tier: 'better' as const }] : []),
          ...(includeBest ? [{ id: 'option-best', label: `✦ ${quote.best_tier_name || 'Best'} Option`, tier: 'best' as const }] : []),
        ];
      })();

  const pages = [
    { id: 'cover', label: 'Cover Page' },
    ...(includeAboutPage ? [{ id: 'about', label: 'About Us' }] : []),
    ...(photos.length > 0 ? [{ id: 'photos', label: 'Inspection Photos' }] : []),
    ...tierPages,
    ...((financingOptions.length > 0 || lenderIntegrations.length > 0) ? [{ id: 'financing', label: 'Financing Options' }] : []),
    ...(includeWarrantyPage ? [{ id: 'warranty', label: 'Warranty' }] : []),
    { id: 'signature', label: 'Acceptance & Signature' },
    ...(includeCancelNotice ? [{ id: 'cancel', label: 'Right to Cancel' }] : []),
  ];

  // Group line items by category. Internal-only lines (labor) are left out —
  // the customer sees a total that includes them but not the rows themselves.
  const groupedItems = lineItems.reduce((acc, item) => {
    if (item.hidden_from_customer) return acc;
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, LineItem[]>);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isCustomerView && (
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="font-semibold text-gray-900">{quote.quote_number}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Download Live Button */}
            <button
              onClick={handleDownloadLive}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#ff6b35] text-white rounded-lg hover:bg-[#e55a2b] transition-colors font-medium shadow-sm"
            >
              <>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download Live</span>
                <span className="sm:hidden">PDF</span>
              </>
            </button>
            {!isCustomerView && (
              <>
                {isInspectionReport && onEdit && quote?.status !== 'signed' && (
                  <button
                    onClick={onEdit}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#152d4a] transition-colors font-medium"
                    title="Continue editing this inspection report"
                  >
                    <FileText className="w-4 h-4" /><span className="hidden sm:inline">Continue Editing</span>
                  </button>
                )}
                {isInspectionReport && onConvertToQuote && (
                  <button
                    onClick={handleConvertToQuote}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-medium"
                    title="Convert inspection report to quote"
                  >
                    <ArrowRight className="w-4 h-4" /><span className="hidden sm:inline">Convert to Quote</span>
                  </button>
                )}
                {(photos.length > 0 || quote?.project_type === 'inspection_report') && (
                  <button
                    onClick={handleGenerateInspectionReport}
                    disabled={inspectionGenerating}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-wait shadow-sm"
                    title={quote?.completion_certificate_enabled ? "Generate completion photos & certificate PDF" : "Generate inspection photo report PDF"}
                  >
                    {inspectionGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:inline">{inspectionProgress || 'Generating…'}</span></>
                    ) : (
                      <><Camera className="w-4 h-4" /><span className="hidden sm:inline">{quote?.completion_certificate_enabled ? 'Completion Photos & Cert' : 'Photo Report'}</span></>
                    )}
                  </button>
                )}
                {quote?.status !== 'draft' && (
                  <button
                    onClick={handleSendCertificateFromPreview}
                    disabled={certSending}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-medium disabled:opacity-60 disabled:cursor-wait"
                    title={quote?.completion_certificate_sent_at ? 'Resend Completion Certificate' : 'Send Completion Certificate to customer'}
                  >
                    {certSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                    <span className="sm:hidden">Cert</span>
                    <span className="hidden sm:inline">{quote?.completion_certificate_sent_at ? 'Resend Cert' : 'Send Cert'}</span>
                  </button>
                )}
                <button onClick={handleSendEmail} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                  <Mail className="w-4 h-4" /> <span className="hidden sm:inline">Email</span>
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print</span>
                </button>
                {/* Classic / Professional pill toggle */}
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                  <button
                    onClick={() => { setViewMode('modern'); localStorage.setItem('quotePreviewMode', 'modern'); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === 'modern'
                        ? 'bg-[#1e3a5f] text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Professional</span>
                  </button>
                  <button
                    onClick={() => { setViewMode('classic'); localStorage.setItem('quotePreviewMode', 'classic'); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === 'classic'
                        ? 'bg-[#1e3a5f] text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Classic</span>
                  </button>
                </div>
              </>
            )}
            {isCustomerView && quote.status === 'revision_requested' && (
              <div className="flex items-center gap-1.5 px-3 py-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg font-medium">
                <Clock className="w-4 h-4 flex-shrink-0" /> Quote update pending…
              </div>
            )}
            {(isCustomerView && showTierSignButton && quote.status !== 'signed' && quote.status !== 'revision_requested') && (
              <div className="flex flex-col items-end gap-0.5">
                <button onClick={() => {
                  const multiTier = quote.include_better !== false || quote.include_best !== false;
                  if (multiTier) {
                    // Pre-populate checkboxes from any prior selection
                    const prior = selectedTier ? (selectedTier === 'all' ? new Set(['good','better','best']) : new Set(selectedTier.split(','))) : new Set<string>();
                    setPickedTiers(prior);
                    setShowTierSelect(true);
                  } else { openFundingStep(); }
                }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                  <CheckCircle className="w-4 h-4" /> {(quote.include_better === false && quote.include_best === false) ? 'Accept & Sign' : 'Choose Your Option & Sign'}
                </button>
                <p className="text-xs text-gray-400 hidden sm:block">{(quote.include_better === false && quote.include_best === false) ? 'Review your quote, then sign.' : 'Pick your tier, payment preference, then sign.'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Last Sent Email — staff only */}
      {!isCustomerView && (quote.last_sent_subject || quote.last_sent_message) && (
        <div className="max-w-5xl mx-auto px-4 mt-3">
          <div className="border border-blue-100 rounded-xl bg-blue-50/50 overflow-hidden">
            <button
              onClick={() => setShowSentEmail(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-blue-800 hover:bg-blue-100/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Last Sent Email
              </span>
              <span className="text-blue-400 text-xs">{showSentEmail ? '▲ Hide' : '▼ Show'}</span>
            </button>
            {showSentEmail && (
              <div className="px-4 pb-4 space-y-3">
                {quote.last_sent_subject && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subject</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-800 flex-1">{quote.last_sent_subject}</p>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(quote.last_sent_subject).then(() => toast.success('Subject copied!')).catch(() => toast.error('Copy not supported in this browser')); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
                      >Copy</button>
                    </div>
                  </div>
                )}
                {quote.last_sent_message && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Message</p>
                    <div className="flex items-start gap-2">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap flex-1 font-sans">{quote.last_sent_message}</pre>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(quote.last_sent_message ?? '').then(() => toast.success('Message copied!')).catch(() => toast.error('Copy not supported in this browser')); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0 mt-0.5"
                      >Copy</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financing Status Banner — staff view only */}
      {!isCustomerView && quote.financing_status && (
        <div className="max-w-5xl mx-auto px-4 mt-3">
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            quote.financing_status === 'approved'
              ? 'bg-green-50 border-green-200'
              : quote.financing_status === 'declined'
              ? 'bg-red-50 border-red-200'
              : quote.financing_status === 'pending'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <span className="text-xl flex-shrink-0">
              {quote.financing_status === 'approved' ? '🟢'
                : quote.financing_status === 'declined' ? '🔴'
                : quote.financing_status === 'pending' ? '🟡'
                : 'ℹ️'}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${
                quote.financing_status === 'approved' ? 'text-green-800'
                  : quote.financing_status === 'declined' ? 'text-red-800'
                  : quote.financing_status === 'pending' ? 'text-yellow-800'
                  : 'text-blue-800'
              }`}>
                {quote.financing_status === 'approved' && (
                  <>Financing Approved{quote.financing_approved_amount ? ` — ${quote.financing_lender_key ? quote.financing_lender_key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Lender'} approved $${Number(quote.financing_approved_amount).toLocaleString()}` : ''}{quote.financing_approved_at ? ` on ${new Date(quote.financing_approved_at).toLocaleDateString()}` : ''}</>
                )}
                {quote.financing_status === 'declined' && (
                  <>Financing Declined{quote.financing_lender_key ? ` — ${quote.financing_lender_key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} declined application` : ''}{quote.financing_status_updated_at ? ` on ${new Date(quote.financing_status_updated_at).toLocaleDateString()}` : ''}</>
                )}
                {quote.financing_status === 'pending' && (
                  <>Financing Pending — Application submitted, waiting for decision</>
                )}
                {quote.financing_status === 'more_info_needed' && (
                  <>More Information Needed — Lender requires additional details</>
                )}
              </p>
              {quote.financing_status_note && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{quote.financing_status_note}</p>
              )}
            </div>
            <button
              onClick={async () => {
                await supabase.from('quotes').update({
                  financing_status: null,
                  financing_lender_key: null,
                  financing_application_id: null,
                  financing_approved_at: null,
                  financing_approved_amount: null,
                  financing_status_note: null,
                  financing_status_updated_at: null,
                }).eq('id', quoteId);
                loadQuote();
                toast.success('Financing status cleared');
              }}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium flex-shrink-0 px-2 py-1 hover:bg-white/60 rounded"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Manual Financing Status Update — staff view only */}
      {!isCustomerView && (
        <div className="max-w-5xl mx-auto px-4 mt-3">
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <button
              onClick={() => setShowManualFinancing(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                Update Financing Status Manually
              </span>
              <span className="text-gray-400 text-xs">{showManualFinancing ? '▲ Hide' : '▼ Show'}</span>
            </button>
            {showManualFinancing && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 pt-3">Use this when the lender calls or emails you instead of sending a webhook.</p>
                <div className="flex flex-wrap gap-2">
                  {(['approved', 'declined', 'pending', 'more_info_needed'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setManualFinancingStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        manualFinancingStatus === s
                          ? s === 'approved' ? 'bg-green-600 text-white border-green-600'
                            : s === 'declined' ? 'bg-red-600 text-white border-red-600'
                            : s === 'pending' ? 'bg-yellow-500 text-white border-yellow-500'
                            : 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {s === 'approved' ? 'Approved ✓'
                        : s === 'declined' ? 'Declined ✗'
                        : s === 'pending' ? 'Pending…'
                        : 'More Info Needed'}
                    </button>
                  ))}
                </div>
                {manualFinancingStatus && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Amount approved ($)"
                      value={manualFinancingAmount}
                      onChange={e => setManualFinancingAmount(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Note from lender (optional)"
                      value={manualFinancingNote}
                      onChange={e => setManualFinancingNote(e.target.value)}
                      className="flex-[2] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] outline-none"
                    />
                    <button
                      onClick={async () => {
                        if (!manualFinancingStatus) return;
                        setSavingManualFinancing(true);
                        try {
                          const now = new Date().toISOString();
                          await supabase.from('quotes').update({
                            financing_status: manualFinancingStatus,
                            financing_approved_at: manualFinancingStatus === 'approved' ? now : null,
                            financing_approved_amount: manualFinancingAmount ? Number(manualFinancingAmount) : null,
                            financing_status_note: manualFinancingNote || null,
                            financing_status_updated_at: now,
                          }).eq('id', quoteId);
                          toast.success('Financing status updated');
                          setManualFinancingStatus(null);
                          setManualFinancingAmount('');
                          setManualFinancingNote('');
                          setShowManualFinancing(false);
                          loadQuote();
                        } catch (err: any) {
                          toast.error('Failed to save: ' + err.message);
                        } finally {
                          setSavingManualFinancing(false);
                        }
                      }}
                      disabled={savingManualFinancing}
                      className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-semibold hover:bg-[#152d4a] disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      {savingManualFinancing ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF Generation Progress Overlay */}
      {pdfGenerating && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center">
            <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-[#ff6b35] animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {viewMode === 'modern' ? 'Preparing Professional PDF' : 'Generating Classic PDF'}
            </h3>
            <p className="text-sm text-gray-500">{pdfProgress || 'Please wait...'}</p>
            <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#ff6b35] h-full rounded-full animate-pulse" style={{ width: '70%' }} />
            </div>
          </div>
        </div>
      )}

      {/* Contractor signature banner — shown when customer has signed */}
      {!isCustomerView && isSigned && (
        <div className="max-w-5xl mx-auto px-4 mt-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Customer Signed</p>
                <p className="text-sm text-green-600">
                  Signed by {quote.signed_by}{quote.signed_at ? ` on ${new Date(quote.signed_at).toLocaleDateString()}` : ''}
                  {quote.signature_data && (
                    <img src={quote.signature_data} alt="Customer signature" className="inline-block ml-3 h-6 object-contain bg-white border border-green-200 rounded px-1" />
                  )}
                </p>
              </div>
            </div>
            {quote.contractor_signature_data && !contractorSigBroken ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <img
                  src={quote.contractor_signature_data}
                  alt="Your signature"
                  className="h-8 object-contain bg-white border border-gray-200 rounded px-1"
                  onError={() => setContractorSigBroken(true)}
                />
                <span className="text-xs text-gray-500">{quote.contractor_signed_by}</span>
                <button
                  onClick={() => setShowContractorSign(true)}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Re-sign
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowContractorSign(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                <PenLine className="w-4 h-4" />
                {quote.contractor_signature_data ? 'Signature not showing — Re-sign' : 'Add Your Signature'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Document Content */}
      {viewMode === 'modern' ? (
        <div className="h-[calc(100vh-110px)]">
          {quoteHtml ? (
            <iframe
              ref={previewIframeRef}
              srcDoc={quoteHtml}
              title="Quote Preview"
              className="w-full h-full border-0"
            />
          ) : htmlError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <div>
                <p className="font-semibold text-gray-800 mb-1">Preview could not be generated</p>
                <p className="text-sm text-gray-500 font-mono bg-gray-100 rounded px-3 py-2 max-w-lg">{htmlError}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-semibold hover:bg-[#152d4a]"
              >
                Reload Page
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
            </div>
          )}
        </div>
      ) : (
        /* ── Classic View fallback (not reached — handled by early return above) ── */
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
        </div>
      )}

      {/* Funding choice modal (Step 0 — shared by both classic and staff views) */}
      {showSignature && signStep === 'fundingChoice' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-lg text-gray-900">How would you like to fund this project?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Choose your payment preference before signing.</p>
              </div>
              <button onClick={() => { setShowSignature(false); setSignStep(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={() => setFundingPreference('cash')}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors ${fundingPreference === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'}`}
              >
                <span className="text-2xl shrink-0">💵</span>
                <div>
                  <p className="font-bold text-gray-900">Cash / Check</p>
                  <p className="text-sm text-gray-500 mt-0.5">Pay at project completion or per milestone</p>
                </div>
                {fundingPreference === 'cash' && <CheckCircle className="w-5 h-5 text-green-600 ml-auto shrink-0 mt-0.5" />}
              </button>
              <button
                onClick={() => setFundingPreference('financing')}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors ${fundingPreference === 'financing' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}
              >
                <span className="text-2xl shrink-0">🏦</span>
                <div>
                  <p className="font-bold text-gray-900">Financing</p>
                  <p className="text-sm text-gray-500 mt-0.5">Apply through a financing partner</p>
                </div>
                {fundingPreference === 'financing' && <CheckCircle className="w-5 h-5 text-blue-600 ml-auto shrink-0 mt-0.5" />}
              </button>
              {fundingPreference === 'financing' && (financingOptions.length > 0 || lenderIntegrations.length > 0) && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Available Financing Options</p>
                  {financingOptions.map((opt) => (
                    <div key={opt.id} className="flex items-start justify-between gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-xl">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{opt.lender_name}</p>
                        {opt.program_name && <p className="text-xs text-gray-600">{opt.program_name}</p>}
                        {(opt.apr_low != null || opt.apr_high != null) && (
                          <p className="text-xs text-gray-500">
                            APR: {opt.apr_low != null && opt.apr_high != null && opt.apr_low !== opt.apr_high
                              ? `${opt.apr_low}–${opt.apr_high}%`
                              : `${opt.apr_low ?? opt.apr_high}%`}
                          </p>
                        )}
                        {opt.term_months && <p className="text-xs text-gray-500">Term: {opt.term_months} months</p>}
                      </div>
                      {opt.application_url && (
                        <a href={opt.application_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 whitespace-nowrap">
                          Apply Now <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                disabled={!fundingPreference}
                onClick={() => setSignStep('agreement')}
                className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-4 h-4" /> Continue to Sign
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Two-step signing modals (shared by both views) */}
      {showSignature && signStep === 'agreement' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Quote Acceptance Agreement</h3>
                <p className="text-xs text-gray-500 mt-0.5">Sign to accept the scope and pricing of this proposal.</p>
              </div>
              <button onClick={() => { setShowSignature(false); setSignStep(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <SignatureCanvas
                onSign={(sigData, _name) => handleAgreementSign(sigData)}
                signerName={`${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim()}
              />
            </div>
          </div>
        </div>
      )}
      {signStep === 'cancel' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-amber-100 bg-amber-50 sm:rounded-t-2xl rounded-t-2xl">
              <div>
                <h3 className="font-bold text-lg text-amber-900">3-Day Right to Cancel — Step 2 of 2</h3>
                <p className="text-xs text-amber-700 mt-0.5">Please sign to confirm you received and understood the cancellation notice.</p>
              </div>
              <button onClick={() => setSignStep(null)} className="p-2 hover:bg-amber-100 rounded-lg">
                <X className="w-5 h-5 text-amber-700" />
              </button>
            </div>
            <div className="p-4">
              <SignatureCanvas
                onSign={(sigData, _name) => handleCancelSign(sigData)}
                signerName={`${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim()}
              />
            </div>
          </div>
        </div>
      )}
      {/* Customer-facing contingency signing modal */}
      {showContingencySigning && isInspectionReport && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center sm:justify-center overflow-y-auto">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="bg-indigo-700 px-5 py-4 sm:rounded-t-2xl flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    {contingencySignStep === 'agreement' ? 'Insurance Contingency Agreement' : '3-Day Right to Cancel'}
                  </h2>
                  <p className="text-xs text-indigo-200">Step {contingencySignStep === 'agreement' ? '1' : '2'} of 2</p>
                </div>
              </div>
              <button onClick={() => setShowContingencySigning(false)} className="text-white/70 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {contingencySignStep === 'agreement' ? (
                <>
                  <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-center">
                    <p className="font-bold text-amber-900 text-sm">⚠ THREE (3) BUSINESS DAY RIGHT TO CANCEL</p>
                    <p className="text-xs text-amber-800 mt-1">You may cancel this agreement without penalty within 3 business days of signing. See Step 2 for the cancellation notice.</p>
                  </div>

                  <div className="space-y-3 text-sm text-gray-700">
                    {([
                      ['1. Contingency Basis', 'This Agreement is entered into on a contingency basis. No restoration or repair work will be performed and no payment will be due from the Property Owner unless and until the Property Owner\'s insurance carrier approves a claim for the repair or replacement of damage to the property described herein.'],
                      ['2. Authorization to Act', 'Property Owner hereby authorizes Contractor to communicate directly with Property Owner\'s insurance company, insurance adjuster, and any related parties on Property Owner\'s behalf for the sole purpose of facilitating the insurance claim and scope of approved repairs. This authorization does not constitute assignment of benefits.'],
                      ['3. Scope of Work', 'Contractor agrees to perform all work as outlined and approved in the final insurance scope of loss issued by the insurance carrier. Any supplements or additional line items identified during the course of the project that are approved by the insurance carrier shall be included in the final contract price.'],
                      ['4. Payment Terms', 'Property Owner agrees to pay Contractor all insurance proceeds received from the insurance carrier for covered repairs, including any recoverable depreciation released upon completion of work, all approved supplements, and the applicable insurance deductible as stated in the Property Owner\'s policy. Property Owner shall not profit from the insurance claim proceeds beyond the cost of the completed work.'],
                      ['5. No Out-of-Pocket Cost Representation', 'Contractor makes no guarantee that Property Owner will owe nothing beyond the deductible. Final amounts owed are determined by the insurance carrier\'s approved scope and applicable policy terms.'],
                      ['6. Property Owner Responsibilities', 'Property Owner agrees to promptly provide Contractor with all insurance documentation, adjuster reports, and claim correspondence. Property Owner shall not independently settle or close the insurance claim without written consent from Contractor while this Agreement is in effect.'],
                      ['7. Contractor Obligations', 'Contractor agrees to provide professional workmanship meeting or exceeding industry standards, maintain all required licenses and insurance coverage, and pursue all legitimate supplements on behalf of the Property Owner at no additional charge to the Property Owner beyond the approved insurance scope.'],
                      ['8. Cancellation', 'Either party may cancel this Agreement within three (3) business days of execution without penalty. After the three-day rescission period, cancellation by the Property Owner after work has commenced may result in liability for costs incurred by Contractor up to the date of cancellation.'],
                    ] as [string, string][]).map(([title, body]) => (
                      <div key={title}>
                        <p className="font-semibold text-gray-900 text-xs">{title}</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{body}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-semibold text-gray-800">Sign below to agree to the Insurance Contingency Agreement</p>
                    <SignatureCanvas
                      onSign={handleContingencyAgreementSign}
                      signerName={`${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim()}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 space-y-2">
                    <p className="font-bold text-red-900 text-base text-center">NOTICE OF THREE (3) DAY RIGHT TO CANCEL</p>
                    <p className="text-sm text-red-800 leading-relaxed">
                      You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right.
                    </p>
                    <p className="text-sm text-red-800 leading-relaxed">
                      To cancel this transaction, you may mail or deliver a signed and dated copy of this cancellation notice to:
                    </p>
                    <p className="text-sm font-semibold text-red-900">{company?.name}</p>
                    {company?.address && <p className="text-sm text-red-800">{company.address}</p>}
                    {company?.email && <p className="text-sm text-red-800">{company.email}</p>}
                    <p className="text-sm text-red-800 leading-relaxed">
                      NOT LATER THAN MIDNIGHT OF{' '}
                      <span className="font-bold">
                        {new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>.
                    </p>
                    <p className="text-sm text-red-800 leading-relaxed font-semibold">
                      If you cancel, any property traded in, any payments made by you under the contract or sale, and any negotiable instrument executed by you will be returned within 10 business days following receipt by the seller of your cancellation notice.
                    </p>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-semibold text-gray-800">Sign below to acknowledge receipt of the 3-Day Right to Cancel notice</p>
                    <SignatureCanvas
                      onSign={savingContingencySign ? () => {} : handleContingencyCancelSign}
                      signerName={contingencySignerName || `${quote?.customer?.first_name || ''} ${quote?.customer?.last_name || ''}`.trim()}
                    />
                    {savingContingencySign && (
                      <div className="flex items-center gap-2 justify-center text-indigo-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Saving signatures…</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Insurance Contingency Agreement Modal */}
      {showContingencyModal && isInspectionReport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 bg-[#1e3a5f] rounded-t-2xl flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">Insurance Contingency Agreement</h2>
                <p className="text-xs text-white/60 mt-0.5">Ref: {quote?.quote_number}</p>
              </div>
              <button onClick={() => setShowContingencyModal(false)} className="text-white/70 hover:text-white p-1 mt-0.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 text-sm text-gray-800 space-y-4">
              {/* Parties */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 border border-gray-200 text-xs">
                <div>
                  <p className="font-bold uppercase tracking-widest text-[#ff6b35] text-[9px] mb-1">Contractor</p>
                  <p className="font-semibold">{company.name}</p>
                  {company.address && <p className="text-gray-500">{company.address}</p>}
                  {company.phone && <p className="text-gray-500">{company.phone}</p>}
                  {company.email && <p className="text-gray-500">{company.email}</p>}
                </div>
                <div>
                  <p className="font-bold uppercase tracking-widest text-[#ff6b35] text-[9px] mb-1">Property Owner</p>
                  <p className="font-semibold">{quote?.customer?.first_name} {quote?.customer?.last_name}</p>
                  {quote?.customer?.address && <p className="text-gray-500">{quote.customer.address}</p>}
                  {quote?.customer?.city && <p className="text-gray-500">{quote.customer.city}, {quote.customer.state} {quote.customer.zip}</p>}
                </div>
              </div>

              <p className="text-center font-bold uppercase tracking-wider text-[#1e3a5f] text-xs border-b pb-2">Terms and Conditions</p>

              {[
                ['1. Contingency Basis', 'This Agreement is entered into on a contingency basis. No restoration or repair work will be performed and no payment will be due from Property Owner unless and until Property Owner\'s insurance carrier approves a claim for the repair or replacement of damage to the property described herein.'],
                ['2. Scope of Work', 'Property Owner authorizes Contractor to inspect the property and, where applicable, to assist in documenting damage and supporting an insurance claim. If the carrier approves a claim, Contractor agrees to perform the approved scope of work in accordance with the carrier\'s scope of loss.'],
                ['3. Authorization to Perform Approved Work', 'In the event Property Owner\'s insurance carrier approves coverage, Property Owner hereby authorizes and agrees to retain Contractor as the exclusive contractor to perform all carrier-approved work. Property Owner agrees to cooperate fully in facilitating Contractor\'s access to complete the approved work.'],
                ['4. Compensation and Deductible', 'Contractor\'s compensation shall be limited to the carrier\'s approved amount. Property Owner agrees to: (a) cooperate fully with the claims process; (b) endorse insurance proceeds checks as necessary to facilitate payment; (c) pay Contractor the applicable insurance deductible upon commencement of work. Property Owner shall not be responsible for any amount above the carrier-approved scope without separate written authorization.'],
                ['5. Contractor\'s Obligations', 'Contractor agrees to: (a) conduct a thorough property inspection; (b) prepare documentation to support the insurance claim; (c) meet with the insurance adjuster at Property Owner\'s request; (d) perform all carrier-approved work in a professional and workmanlike manner; (e) obtain all required permits and comply with applicable building codes.'],
                ['6. Claim Denial', 'If the carrier denies the claim in its entirety, Property Owner shall owe nothing for inspection and claim-support services. If the carrier approves coverage but Property Owner elects not to use Contractor to complete the approved work, Property Owner may be liable for Contractor\'s reasonable and documented costs incurred in preparing the claim.'],
                ['7. Governing Law', 'This Agreement shall be governed by the laws of the state in which the property is located. If any provision is found unenforceable, the remaining provisions shall remain in full force and effect.'],
                ['8. Entire Agreement', 'This Agreement constitutes the entire agreement between the parties regarding its subject matter and supersedes all prior representations, agreements, and understandings, whether written or oral.'],
              ].map(([title, body]) => (
                <div key={title}>
                  <p className="font-semibold text-[#1e3a5f] mb-1">{title}</p>
                  <p className="text-gray-700 leading-relaxed text-xs">{body}</p>
                </div>
              ))}

              {/* 3-day right to cancel — highlighted */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                <p className="font-bold text-amber-800 mb-2 text-xs uppercase tracking-wide">⚠ Three (3) Business Day Right to Cancel</p>
                <p className="text-amber-900 text-xs leading-relaxed">
                  You, the Property Owner, may cancel this Agreement without any penalty or obligation within <strong>THREE (3) BUSINESS DAYS</strong> after the date this Agreement is signed. To cancel, provide written notice to Contractor by: (a) personal delivery to Contractor's place of business; (b) email to Contractor's email address shown above; or (c) certified mail to Contractor's mailing address shown above. Any payments made prior to cancellation shall be refunded within ten (10) business days of Contractor's receipt of the cancellation notice.
                </p>
              </div>

              {/* Signature block */}
              <div className="border-t pt-4 mt-2">
                <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Signatures</p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#1e3a5f] mb-2">Property Owner</p>
                    {quote?.contingency_signed_at ? (
                      <div className="flex items-center gap-2 text-green-700 font-semibold text-xs">
                        <Shield className="w-4 h-4" /> Signed — {quote.contingency_signed_by}
                        <span className="font-normal text-gray-500 ml-1">{new Date(quote.contingency_signed_at).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <>
                        <div className="border-b border-gray-400 mb-1 mt-6" />
                        <p className="text-[9px] text-gray-400">Signature</p>
                        <div className="border-b border-gray-400 mb-1 mt-4" />
                        <p className="text-[9px] text-gray-400">Print Name</p>
                        <div className="border-b border-gray-400 mb-1 mt-4" />
                        <p className="text-[9px] text-gray-400">Date</p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#1e3a5f] mb-2">Contractor — {company.name}</p>
                    <div className="border-b border-gray-400 mb-1 mt-6" />
                    <p className="text-[9px] text-gray-400">Authorized Signature</p>
                    <div className="border-b border-gray-400 mb-1 mt-4" />
                    <p className="text-[9px] text-gray-400">Print Name / Title</p>
                    <div className="border-b border-gray-400 mb-1 mt-4" />
                    <p className="text-[9px] text-gray-400">Date</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              {quote?.contingency_signed_at ? (
                <div className="flex items-center gap-2 text-green-700 font-semibold justify-center">
                  <Shield className="w-5 h-5" />
                  Contingency agreement signed by {quote.contingency_signed_by} on {new Date(quote.contingency_signed_at).toLocaleDateString()}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center">
                  To collect a digital signature from the homeowner, print this agreement or use the mobile app to capture their signature on-site.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contractor sign modal */}
      {showContractorSign && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Contractor Acceptance Signature</h3>
                <p className="text-xs text-gray-500 mt-0.5">Sign below to confirm you have reviewed and accepted this quote on behalf of {company.name}.</p>
              </div>
              <button onClick={() => setShowContractorSign(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <SignatureCanvas
                onSign={(sigData, signerName) => handleContractorSign(sigData, signerName)}
                signerName={currentUser?.full_name || company.name}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sign On Site — full-screen kiosk modal for in-person signing */}
      {showSignOnSite && quote && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-green-600" />
              <div>
                <h2 className="font-bold text-gray-900 text-base leading-tight">Sign On Site</h2>
                <p className="text-xs text-gray-500">
                  {signOnSiteStep === 'contractor' ? 'Step 1 — Sales Representative Signs' :
                   signOnSiteStep === 'handoff' ? 'Hand device to customer' :
                   signOnSiteStep === 'agreement' ? (quote?.contingency_enabled ? 'Step 2 — Customer: Contingency Agreement' : 'Step 2 — Customer Signature') :
                   signOnSiteStep === 'cancel' ? 'Step 3 — Customer: 3-Day Right to Cancel' :
                   'All done!'}
                </p>
              </div>
            </div>
            {signOnSiteStep !== 'done' && (
              <button onClick={() => setShowSignOnSite(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">

            {/* Step 1: Contractor/Sales signs first */}
            {signOnSiteStep === 'contractor' && (
              <div className="max-w-lg mx-auto p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900 text-sm">Sales Representative — sign first</p>
                    <p className="text-sm text-blue-700 mt-0.5">Sign below to confirm you presented this document to the customer. Then hand the device to the customer.</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-gray-800">{quote.quote_number} — {quote.customer?.first_name} {quote.customer?.last_name}</p>
                  {quote?.contingency_enabled
                    ? <p className="text-xs text-indigo-700 mt-0.5 font-medium">Insurance Contingency Agreement</p>
                    : <p className="text-xs text-gray-500 mt-0.5">Quote Acceptance</p>}
                </div>
                <SignatureCanvas
                  onSign={(sigData, signerName) => {
                    setSignOnSiteContractorSig(sigData);
                    setSignOnSiteContractorName(signerName || currentUser?.full_name || company.name || '');
                    setSignOnSiteStep('handoff');
                  }}
                  signerName={currentUser?.full_name || company.name}
                  hideCancelNotice
                  signatureConsentText={`I, the undersigned Sales Representative of ${company.name}, confirm that I have reviewed this document with the customer and presented it for their signature.`}
                />
              </div>
            )}

            {/* Handoff screen */}
            {signOnSiteStep === 'handoff' && (
              <div className="max-w-lg mx-auto p-8 flex flex-col items-center gap-6 text-center">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Sales Rep Signed!</h3>
                  <p className="text-gray-500 mt-2">Please hand the device to the customer. They will now review and sign the document.</p>
                </div>
                <button
                  onClick={() => setSignOnSiteStep('agreement')}
                  className="w-full max-w-xs py-4 bg-green-600 text-white rounded-xl font-bold text-base hover:bg-green-700 transition-colors shadow-sm active:scale-95"
                >
                  Customer Ready — Continue
                </button>
              </div>
            )}

            {/* Step 2: Customer signs contingency agreement or standard acceptance */}
            {signOnSiteStep === 'agreement' && (
              <div className="max-w-lg mx-auto p-4 space-y-4">
                {quote?.contingency_enabled ? (
                  <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden">
                    <div className="bg-indigo-700 px-4 py-2.5 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-white" />
                      <span className="text-sm font-bold text-white">Insurance Contingency Agreement</span>
                    </div>
                    <div className="p-4 space-y-2 text-xs text-gray-600">
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-center">
                        <p className="font-bold text-amber-900">⚠ THREE (3) BUSINESS DAY RIGHT TO CANCEL</p>
                      </div>
                      {([
                        ['1. Contingency Basis', 'No work performed and no payment due unless insurance carrier approves a claim for the damage described herein.'],
                        ['2. Authorization to Act', `Property Owner authorizes ${company.name} to communicate directly with the insurance company on their behalf.`],
                        ['3. Scope of Work', 'Contractor agrees to perform all work as outlined in the final insurance scope of loss, including approved supplements.'],
                        ['4. Payment Terms', 'Property Owner agrees to pay all insurance proceeds, released depreciation, approved supplements, and the applicable deductible.'],
                        ['5. No Out-of-Pocket Guarantee', 'Contractor makes no guarantee that Property Owner will owe nothing beyond the deductible.'],
                        ['6. Cancellation', 'Either party may cancel this Agreement within three (3) business days of execution without penalty.'],
                      ] as [string,string][]).map(([t,b]) => (
                        <div key={t}><span className="font-semibold text-gray-800">{t} </span><span>{b}</span></div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="font-semibold mb-1">Quote Acceptance — {quote.quote_number}</p>
                    <p className="text-xs text-gray-500">By signing below, I confirm I have reviewed and accepted this quote from {company.name} and authorize the described work.</p>
                  </div>
                )}
                <SignatureCanvas
                  onSign={(sigData, signerName) => {
                    if (quote?.contingency_enabled) {
                      setSignOnSiteAgreementSig(sigData);
                      setSignOnSiteStep('cancel');
                    } else {
                      void handleSignOnSiteFinish(sigData, signerName, null);
                    }
                  }}
                  signerName={`${quote.customer?.first_name || ''} ${quote.customer?.last_name || ''}`.trim()}
                  hideCancelNotice
                  signatureConsentText={quote?.contingency_enabled
                    ? 'I have read and agree to the Insurance Contingency Agreement terms above.'
                    : 'I have reviewed and accept this quote.'}
                />
              </div>
            )}

            {/* Step 3: Customer signs 3-day right to cancel */}
            {signOnSiteStep === 'cancel' && (
              <div className="max-w-lg mx-auto p-4 space-y-4">
                <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
                  <div className="bg-red-700 px-4 py-2.5 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-white" />
                    <span className="text-sm font-bold text-white">3-Day Right to Cancel</span>
                  </div>
                  <div className="p-4 text-xs text-gray-600 space-y-2">
                    <p className="font-semibold text-gray-800">Notice of Right to Cancel</p>
                    <p>The buyer may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction.</p>
                    <p>To cancel, deliver a signed and dated written notice of cancellation to:</p>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="font-medium">{company.name}</p>
                      {company.email && <p>{company.email}</p>}
                      {company.phone && <p>{company.phone}</p>}
                      {company.address && <p>{company.address}{company.city ? `, ${company.city}` : ''}{company.state ? `, ${company.state}` : ''}</p>}
                    </div>
                    <p>If you cancel, any payments made by you under this contract will be returned within 10 business days of receipt of your cancellation notice.</p>
                  </div>
                </div>
                <SignatureCanvas
                  onSign={(cancelSig, signerName) => {
                    void handleSignOnSiteFinish(signOnSiteAgreementSig!, signerName, cancelSig);
                  }}
                  signerName={`${quote.customer?.first_name || ''} ${quote.customer?.last_name || ''}`.trim()}
                  hideCancelNotice
                  cancelTitle="3-Day Right to Cancel"
                  signatureConsentText="I acknowledge receipt of the 3-Day Right to Cancel notice and understand my right to cancel within 3 business days."
                />
              </div>
            )}

            {/* Done */}
            {signOnSiteStep === 'done' && (
              <div className="max-w-lg mx-auto p-8 flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Signed On Site!</h3>
                <p className="text-gray-500">All signatures have been saved. The document is now fully executed.</p>
                <button onClick={() => setShowSignOnSite(false)} className="mt-4 px-8 py-3 bg-[#1e3a5f] text-white rounded-xl font-semibold hover:bg-[#152d4a] transition-colors">
                  Done
                </button>
              </div>
            )}
          </div>

          {/* Saving overlay */}
          {savingSignOnSite && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-green-600 border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }} />
                <p className="text-sm text-gray-600 font-medium">Saving signatures…</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global lightbox */}
      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onChange={(i) => setLightbox({ ...lightbox, index: i })}
        />
      )}
    </div>
  );
};

export default QuotePreview;
