import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import type { PendingQuote, QuoteDraftItem } from '@/lib/crmStore';
import { toQuoteSummary } from '@/lib/crmData';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import WorkOrderPanel from './WorkOrderPanel';
import ReceiptPanel from './ReceiptPanel';
import InvoiceBuilder from './InvoiceBuilder';
import QuoteBuilder from '@/components/QuoteBuilder';
import QuotePreview from '@/components/QuotePreview';
import type { Company, TeamMember } from '@/data/quoteData';
import { quoteUrl } from '@/lib/appUrl';
import { describeQuoteStatus } from '@/lib/quoteStatus';
import { quoteProjectTemplates, TemplateLineItem } from '@/data/quoteTemplates';
import {
  FileText, Plus, Search, Trash2, X, Save, User, Send, Link2, Eye, ChevronDown,
  Home, Wrench, Hammer, Sun, Droplets, Layers, Grid3x3,
  Scroll, Tablet, PackageOpen, Box, ClipboardList, DollarSign, Archive, ArchiveRestore, Shield,
  MoreHorizontal, Copy, Loader2,
} from 'lucide-react';

// ── QuoteMGR-parity quote builder for web ─────────────────────────────────
// Stage 1 of the web quote builder port: create/edit a quote on the SAME
// `quotes` / `quote_line_items` tables the mobile QuoteBuilderScreen writes
// to — same quote_number scheme, same share_token format, same totals
// formula (sum(qty * tier_price) per tier) — so a quote made here opens
// correctly in the mobile app and vice versa. Later stages add the
// customer-facing preview/PDF, e-signature, and the long tail of mobile-only
// fields (financing, insurance/supplement linkage, custom pages, contingency
// signing). This stage covers the core path: pick a template or start blank,
// price Good/Better/Best line items, save a draft.

interface QuoteLineItemRow {
  id?: string;
  category: string;
  item_name: string;
  description: string;
  unit: string;
  quantity: number;
  good_price: number;
  better_price: number;
  best_price: number;
  fixed_price: boolean;
}

interface QuoteRow {
  id: string;
  quote_number: string;
  status: string;
  contact_id: string | null;
  customer_id: string | null;
  project_type: string | null;
  selected_tier: string | null;
  good_total: number | null;
  better_total: number | null;
  best_total: number | null;
  created_at: string;
  share_token: string | null;
  cover_page_title: string | null;
  project_description: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  signed_at?: string | null;
  contingency_enabled?: boolean | null;
  contingency_signed_at?: string | null;
  inspection_report_sent_at?: string | null;
  inspection_report_viewed_at?: string | null;
  completion_certificate_sent_at?: string | null;
  completion_certificate_viewed_at?: string | null;
  certificate_customer_signed_at?: string | null;
  contractor_signed_at?: string | null;
  countersigned_copy_sent_at?: string | null;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  'home-outline': <Home size={28} />,
  'construct-outline': <Wrench size={28} />,
  'hammer-outline': <Hammer size={28} />,
  'sunny-outline': <Sun size={28} />,
  'water-outline': <Droplets size={28} />,
  'layers-outline': <Layers size={28} />,
  'grid-outline': <Grid3x3 size={28} />,
  'scroll-outline': <Scroll size={28} />,
  'tablet-landscape-outline': <Tablet size={28} />,
  'albums-outline': <PackageOpen size={28} />,
  'build-outline': <Box size={28} />,
};

const emptyLineItem = (): QuoteLineItemRow => ({
  category: 'Roofing',
  item_name: '',
  description: '',
  unit: 'each',
  quantity: 1,
  good_price: 0,
  better_price: 0,
  best_price: 0,
  fixed_price: false,
});

// A draft item carries one price; seed all three tiers with it so the quote is
// valid as-is and the rep can differentiate the tiers before sending.
const draftToLineItem = (item: QuoteDraftItem): QuoteLineItemRow => ({
  ...emptyLineItem(),
  item_name: item.description,
  unit: item.unit || 'each',
  quantity: item.quantity,
  good_price: item.unitPrice,
  better_price: item.unitPrice,
  best_price: item.unitPrice,
});

const generateShareToken = (): string => {
  const bytes = new Uint8Array(16);
  (window.crypto || (window as any).msCrypto).getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const money = (n: number | null | undefined) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

interface FinancingOptionRow {
  id: string;
  lender_name: string;
  program_name: string | null;
  apr_low: number | null;
  apr_high: number | null;
  term_months: number | null;
}

export default function QuotesView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // The row whose ⋯ Actions menu is open, and where to draw it (fixed, so the table's scroll box can't clip it).
  const [actionMenu, setActionMenu] = useState<{ quote: QuoteRow; top: number; right: number } | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [builderPrefill, setBuilderPrefill] = useState<PendingQuote | null>(null);
  const [workOrderQuote, setWorkOrderQuote] = useState<QuoteRow | null>(null);
  const [workOrderCompany, setWorkOrderCompany] = useState<{ name: string; phone?: string; email?: string; license_number?: string } | null>(null);
  const [receiptQuote, setReceiptQuote] = useState<any | null>(null);
  const [receiptCompany, setReceiptCompany] = useState<{ name: string; default_deposit_percent?: number | null; receipt_cc_emails?: string[] | null } | null>(null);
  const [invoiceQuote, setInvoiceQuote] = useState<any | null>(null);
  const [invoiceCompany, setInvoiceCompany] = useState<{ name: string; email?: string; phone?: string; address?: string; logo_url?: string } | null>(null);
  // QuoteMGR's quote builder and preview open full page inside Quotes.
  const [previewQuoteId, setPreviewQuoteId] = useState<string | null>(null);
  const [previewReturnStep, setPreviewReturnStep] = useState<number | null>(null);
  const [builderNonce, setBuilderNonce] = useState(0);
  // Inspection reports use the builder's inspection mode (contingency + 3-day cancel steps).
  const [builderInspection, setBuilderInspection] = useState(false);
  const [quoteCompany, setQuoteCompany] = useState<Company | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [builderContextError, setBuilderContextError] = useState<string | null>(null);

  // Another screen asked for a quote: open the builder on it, then clear the
  // request so returning to Quotes later does not reopen it.
  useEffect(() => {
    const pending = state.pendingQuote;
    if (!pending) return;
    setEditingQuoteId(pending.quoteId ?? null);
    setBuilderPrefill(pending.quoteId ? null : pending);
    setBuilderInspection(!!pending.inspection);
    if (pending.quoteId) {
      supabase.from('quotes').select('project_type').eq('id', pending.quoteId).maybeSingle()
        .then(({ data }) => { if (data?.project_type === 'inspection_report') setBuilderInspection(true); });
    }
    setPreviewQuoteId(null);
    setPreviewReturnStep(null);
    setBuilderNonce((n) => n + 1);
    setShowBuilder(true);
    setReturnContactId(state.currentView === 'contact-detail' ? state.selectedContactId : null);
    if (!pending.quoteId && pending.items?.length) {
      // QuoteMGR's builder imports measurement reports itself, in its Line Items
      // step, so rows parsed elsewhere are not carried over.
      toast.info('Upload the measurement report in the Line Items step to add it to this quote.');
    }
    dispatch({ type: 'SET_PENDING_QUOTE', payload: null });
  }, [state.pendingQuote, dispatch]);

  useEffect(() => {
    if (companyId) loadQuotes();
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, showArchived]);

  // The builder and preview take QuoteMGR's company and team-member rows.
  useEffect(() => {
    if (!companyId || !profile?.id) return;
    let cancelled = false;
    const failed = () => {
      if (!cancelled) setBuilderContextError('Could not load your company or team profile for the quote builder. Refresh and try again.');
    };
    setBuilderContextError(null);
    Promise.all([
      db.getCompany(companyId),
      supabase
        .from('team_members')
        .select('*')
        .eq('company_id', companyId)
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .maybeSingle(),
    ])
      .then(([company, member]) => {
        if (cancelled) return;
        if (!company || member.error || !member.data) { failed(); return; }
        setQuoteCompany(company as unknown as Company);
        setTeamMember(member.data as TeamMember);
      })
      .catch(failed);
    return () => { cancelled = true; };
  }, [companyId, profile?.id]);

  const loadQuotes = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, status, contact_id, customer_id, project_type, good_total, better_total, best_total, selected_tier, created_at, share_token, cover_page_title, project_description, sent_at, viewed_at, signed_at, contingency_enabled, contingency_signed_at, inspection_report_sent_at, inspection_report_viewed_at, completion_certificate_sent_at, completion_certificate_viewed_at, certificate_customer_signed_at, contractor_signed_at, countersigned_copy_sent_at')
        .eq('company_id', companyId)
        .eq('is_archived', showArchived)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuotes((data || []) as QuoteRow[]);
      // Keep the dashboard and pipeline values in step with the active quotes only.
      if (!showArchived) dispatch({ type: 'SET_QUOTES', payload: (data || []).map(toQuoteSummary) });
    } catch (err: any) {
      toast.error('Failed to load quotes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const contactName = (id: string | null) => {
    if (!id) return 'No customer';
    const c = state.contacts.find((c) => c.id === id);
    return c ? `${c.firstName} ${c.lastName}`.trim() : 'Unknown';
  };

  // Same link format as QuoteMGR and the backend's quote emails: /?token=<share_token>.
  const shareUrl = (token: string) => quoteUrl(token);

  const handleCopyLink = async (q: QuoteRow) => {
    if (!q.share_token) { toast.error('This quote has no share link yet.'); return; }
    try {
      await navigator.clipboard.writeText(shareUrl(q.share_token));
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  // Sends through the same send-quote-email function as the quote preview, so the
  // customer gets the same email (greeting, layout, inspection wording) whichever way
  // it is sent, and the quote moves to Sent without un-signing one that is signed.
  const handleSendQuote = async (q: QuoteRow) => {
    if (!q.share_token) { toast.error('This quote has no share link yet.'); return; }
    const contact = state.contacts.find((c) => c.id === (q.contact_id || q.customer_id));
    if (!contact?.email) { toast.error('This customer has no email on file.'); return; }
    if (!companyId) return;
    if (isReadOnlyProject()) { toast.error('Quotes are read-only in this environment.'); return; }
    try {
      const loaded = await loadFullQuote(q);
      if (!loaded) return;
      const { full, company } = loaded;
      const companyName = company.name || 'Your Company';
      const customerName = `${contact.firstName} ${contact.lastName}`.trim();
      const isReport = q.project_type === 'inspection_report';

      // The total the customer is quoted: the tier they picked, else the tier the quote includes.
      const tierTotal = (tier: 'good' | 'better' | 'best') => {
        const manual = full[`manual_${tier}_total`];
        return Number(full.use_manual_totals && manual != null ? manual : full[`${tier}_total`]) || 0;
      };
      const picked = full.selected_tier;
      const quoteTotal =
        picked === 'all' ? tierTotal('good') + tierTotal('better') + tierTotal('best')
        : picked === 'good' || picked === 'better' || picked === 'best' ? tierTotal(picked)
        : full.include_better !== false ? tierTotal('better') || tierTotal('good')
        : full.include_best !== false ? tierTotal('best') || tierTotal('good')
        : tierTotal('good');

      const repName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
      const fromName = repName ? `${company.quote_sender_name || companyName} | ${repName}` : (company.quote_sender_name || companyName);
      const subject = isReport
        ? `Your inspection report from ${companyName} — Quote #${q.quote_number}`
        : `${q.cover_page_title || 'Your Proposal'} — ${companyName}`;
      const message = isReport
        ? `Hi ${contact.firstName || 'there'},\n\nThank you for the opportunity to inspect your property. Please review your inspection report using the link below.\n\nThank you,\n${companyName}`
        : `Hi ${contact.firstName || 'there'},\n\nYour quote is ready to review. Please click the link to view your proposal.\n\nThank you,\n${companyName}`;

      const { error: sendError } = await supabase.functions.invoke('send-quote-email', {
        body: {
          company_id: companyId,
          to_email: contact.email,
          to_name: customerName,
          from_company: companyName,
          from_name: fromName,
          from_email: company.quote_sender_email || company.email,
          reply_to_email: profile?.email || company.quote_reply_to_email || company.email,
          bcc_email: profile?.email || company.quote_sender_email || company.email,
          bcc_customer_name: customerName,
          quote_number: q.quote_number,
          share_token: q.share_token,
          quote_url: shareUrl(q.share_token),
          quote_type: q.project_type,
          quote_total: quoteTotal,
          project_description: q.project_description,
          dashboard_url: `${window.location.origin}/?view=estimate-preview&estimate_id=${q.id}`,
          email_subject: subject,
          email_message: message,
        },
      });
      if (sendError) {
        let detail = sendError.message;
        try {
          const ctx = (sendError as any).context;
          const parsed = ctx && typeof ctx.json === 'function' ? await ctx.json() : ctx;
          if (parsed?.details) detail = parsed.details;
          else if (parsed?.error) detail = parsed.error;
        } catch { /* keep the generic message */ }
        throw new Error(detail);
      }

      const nowIso = new Date().toISOString();
      const alreadySigned = q.status === 'signed' || !!q.signed_at;
      const { error } = await supabase
        .from('quotes')
        .update({
          ...(alreadySigned ? {} : { status: 'sent', viewed_at: null }),
          sent_at: nowIso,
          ...(isReport ? { inspection_report_sent_at: nowIso, inspection_report_viewed_at: null } : {}),
          last_sent_subject: subject,
          last_sent_message: message,
        })
        .eq('id', q.id)
        .eq('company_id', companyId);
      if (error) throw error;

      toast.success('Sent to ' + contact.email);
      loadQuotes();
    } catch (err: any) {
      toast.error('Failed to send quote: ' + (err.message || 'unknown error'));
    }
  };

  // Only TrussCTR's own project may be written to; QuoteMGR's projects are read-only.
  const isReadOnlyProject = () =>
    !String((supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '').includes('llamtjsquoqlejznmyjl');

  // Copies a quote into a new draft, as QuoteMGR's Duplicate Quote does: the scope
  // options, line items and photos come along; signatures, payments, the share link,
  // sent history and the chosen tier do not.
  const duplicateQuote = async (q: QuoteRow) => {
    if (!companyId) return;
    if (isReadOnlyProject()) { toast.error('Quotes are read-only in this environment.'); return; }
    setDuplicatingId(q.id);
    try {
      const { data: src, error: srcErr } = await supabase
        .from('quotes').select('*').eq('id', q.id).eq('company_id', companyId).single();
      if (srcErr || !src) throw srcErr ?? new Error('Quote not found');

      const { data: srcOptions } = await supabase
        .from('quote_options').select('*').eq('quote_id', q.id).order('sort_order');
      const { data: items } = await supabase
        .from('quote_line_items').select('*').eq('quote_id', q.id);

      // A quote can outlive its customer. Copy it without the link rather than fail on it.
      let keepCustomer = false;
      const customerId = src.customer_id || src.contact_id;
      if (customerId) {
        const { data: cust } = await supabase
          .from('customers').select('id').eq('id', customerId).eq('company_id', companyId).maybeSingle();
        keepCustomer = !!cust;
      }

      // A multi-scope quote keeps each scope's total on its own tier column.
      let goodTotal = src.good_total;
      let betterTotal = src.better_total;
      let bestTotal = src.best_total;
      const isMultiScope = !!(srcOptions?.length && items?.some((i: any) => i.quote_option_id != null));
      if (isMultiScope && items && srcOptions) {
        const sorted = [...srcOptions].sort((a: any, b: any) => a.sort_order - b.sort_order);
        const optTotal = (optId: string) =>
          items.filter((i: any) => i.quote_option_id === optId)
            .reduce((sum: number, i: any) => sum + (i.quantity ?? 0) * (i.good_price ?? 0), 0);
        goodTotal = sorted[0] ? optTotal(sorted[0].id) : 0;
        betterTotal = sorted[1] ? optTotal(sorted[1].id) : 0;
        bestTotal = sorted[2] ? optTotal(sorted[2].id) : 0;
      }

      const OMIT = new Set([
        'id', 'created_at', 'updated_at', 'share_token', 'status', 'is_archived',
        'signed_at', 'signed_by', 'signature_data', 'cancel_signature_data', 'cancel_signed_at',
        'contractor_signature_data', 'contractor_signed_by', 'contractor_signed_at', 'signed_pdf_url',
        'viewed_at', 'sent_at', 'final_offer_sent_at', 'final_offer_pending_at',
        'final_offer_pending_discount_pct', 'final_offer_submitted_by',
        'completion_certificate_sent_at', 'certificate_customer_signed_at',
        'inspection_report_viewed_at', 'last_sent_subject', 'last_sent_message', 'last_sent_cc_emails',
        'selected_tier', 'customer_selected_upgrades', 'financing_status',
        'quote_number', 'cover_page_title', 'company_id', 'created_by', 'customer_id', 'contact_id',
        'good_total', 'better_total', 'best_total',
      ]);
      const copyFields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(src)) if (!OMIT.has(k)) copyFields[k] = v;

      const quoteNumber = `${src.project_type === 'inspection_report' ? 'IC' : 'QT'}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const { data: newQuote, error } = await supabase
        .from('quotes')
        .insert({
          ...copyFields,
          company_id: companyId,
          created_by: profile?.id ?? null,
          customer_id: keepCustomer ? customerId : null,
          quote_number: quoteNumber,
          status: 'draft',
          cover_page_title: src.cover_page_title
            ? `Copy of ${String(src.cover_page_title).replace(/^(copy of\s+)+/i, '')}`
            : null,
          good_total: goodTotal,
          better_total: betterTotal,
          best_total: bestTotal,
        })
        .select()
        .single();
      if (error || !newQuote) throw error ?? new Error('Could not create the copy');

      // From here on a failure removes the half-built copy instead of leaving a broken draft.
      try {
        const optIdMap: Record<string, string> = {};
        if (srcOptions?.length) {
          const rows = srcOptions.map(({ id: _id, quote_id: _qid, created_at: _ca, updated_at: _ua, ...rest }: any) => ({
            ...rest, quote_id: newQuote.id,
          }));
          const { data: newOpts, error: optsErr } = await supabase.from('quote_options').insert(rows).select();
          if (optsErr) throw new Error(`Failed to copy scope options: ${optsErr.message}`);
          srcOptions.forEach((old: any) => {
            const match = (newOpts as any[] | null)?.find((n) => n.sort_order === old.sort_order);
            if (match) optIdMap[old.id] = match.id;
          });
        }
        if (items?.length) {
          const rows = items.map(({ id: _id, quote_id: _qid, created_at: _ca, ...rest }: any) => ({
            ...rest,
            quote_id: newQuote.id,
            quote_option_id: rest.quote_option_id ? (optIdMap[rest.quote_option_id] ?? null) : null,
          }));
          const { error: itemsErr } = await supabase.from('quote_line_items').insert(rows);
          if (itemsErr) throw new Error(`Failed to copy line items: ${itemsErr.message}`);
        }
        const { data: photos } = await supabase.from('quote_photos').select('*').eq('quote_id', q.id);
        if (photos?.length) {
          const rows = photos.map(({ id: _id, quote_id: _qid, created_at: _ca, ...rest }: any) => ({
            ...rest, quote_id: newQuote.id,
          }));
          await supabase.from('quote_photos').insert(rows);
        }
      } catch (copyErr) {
        await supabase.from('quotes').delete().eq('id', newQuote.id).eq('company_id', companyId);
        throw copyErr;
      }

      toast.success(`Duplicated as ${quoteNumber}`);
      loadQuotes();
      openEdit(newQuote.id); // open the copy ready to edit
    } catch (err: any) {
      console.error('Duplicate error:', err);
      toast.error(`Failed to duplicate: ${err?.message || 'Unknown error'}`);
    } finally {
      setDuplicatingId(null);
    }
  };

  const setArchived = async (ids: string[], archived: boolean) => {
    if (!ids.length) return;
    if (isReadOnlyProject()) { toast.error('Quotes are read-only in this environment.'); return; }
    setBulkBusy(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ is_archived: archived, updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('company_id', companyId);
      if (error) throw error;
      toast.success(`${ids.length} quote${ids.length === 1 ? '' : 's'} ${archived ? 'archived' : 'restored'}`);
      setSelectedIds(new Set());
      loadQuotes();
    } catch (err: any) {
      toast.error(`Failed to ${archived ? 'archive' : 'restore'}: ${err.message || 'unknown error'}`);
    } finally {
      setBulkBusy(false);
    }
  };

  // Deleting cascades to line items, options and signatures, so signed quotes
  // can only be archived.
  const deleteQuotes = (ids: string[]) => {
    const targets = quotes.filter((q) => ids.includes(q.id));
    const deletable = targets.filter((q) => q.status !== 'signed');
    const skipped = targets.length - deletable.length;
    if (!deletable.length) { toast.error('Signed quotes can\'t be deleted — archive them instead.'); return; }
    if (isReadOnlyProject()) { toast.error('Quotes are read-only in this environment.'); return; }
    toast.warning(
      `Permanently delete ${deletable.length} quote${deletable.length === 1 ? '' : 's'}?${skipped ? ` ${skipped} signed quote${skipped === 1 ? '' : 's'} will be skipped.` : ''} This cannot be undone.`,
      {
        duration: 10000,
        cancel: { label: 'Cancel', onClick: () => {} },
        action: {
          label: 'Delete',
          onClick: async () => {
            setBulkBusy(true);
            try {
              const { error } = await supabase
                .from('quotes')
                .delete()
                .in('id', deletable.map((q) => q.id))
                .eq('company_id', companyId)
                .neq('status', 'signed');
              if (error) throw error;
              toast.success(`${deletable.length} quote${deletable.length === 1 ? '' : 's'} deleted`);
              setSelectedIds(new Set());
              loadQuotes();
            } catch (err: any) {
              toast.error('Failed to delete: ' + (err.message || 'unknown error'));
            } finally {
              setBulkBusy(false);
            }
          },
        },
      },
    );
  };

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((quote) =>
      quote.quote_number.toLowerCase().includes(q) ||
      contactName(quote.contact_id || quote.customer_id).toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, search, state.contacts]);

  const openNew = () => {
    setEditingQuoteId(null); setBuilderPrefill(null); setPreviewQuoteId(null); setPreviewReturnStep(null);
    setBuilderInspection(false);
    setBuilderNonce((n) => n + 1); setShowBuilder(true);
  };
  const openNewInspection = () => {
    openNew();
    setBuilderInspection(true);
  };
  const openEdit = (id: string) => {
    setBuilderInspection(quotes.find((q) => q.id === id)?.project_type === 'inspection_report');
    setEditingQuoteId(id); setBuilderPrefill(null); setPreviewQuoteId(null); setPreviewReturnStep(null); setShowBuilder(true);
  };
  const openPreview = (id: string) => { setPreviewReturnStep(null); setPreviewQuoteId(id); };
  /** Set when the builder was opened from a contact, so closing returns there. */
  const [returnContactId, setReturnContactId] = useState<string | null>(null);

  const closeBuilder = () => {
    setShowBuilder(false); setEditingQuoteId(null); setBuilderPrefill(null); setPreviewReturnStep(null); loadQuotes();
    // Opened from a contact (its Next step button, or a quote on its page):
    // closing the builder goes back to that contact, not the quote list.
    if (returnContactId) {
      const contactId = returnContactId;
      setReturnContactId(null);
      dispatch({ type: 'SELECT_CONTACT', payload: contactId });
    }
  };

  // As in QuoteMGR, a signed quote is what becomes a work order. The printed
  // work order carries the company's name, contact details and license number.
  const openWorkOrder = async (q: QuoteRow) => {
    if (!companyId) return;
    const company: any = await db.getCompany(companyId).catch(() => null);
    if (!company) { toast.error('Could not load your company details for the work order.'); return; }
    setWorkOrderCompany({
      name: company.name || '',
      phone: company.phone || undefined,
      email: company.email || undefined,
      license_number: company.license_number || undefined,
    });
    setWorkOrderQuote(q);
  };

  // Receipts and invoices need the tier names, manual totals and the customer's
  // contact details, which the list does not load.
  const loadFullQuote = async (q: QuoteRow): Promise<{ full: any; company: any } | null> => {
    if (!companyId) return null;
    const [{ data: full, error }, company] = await Promise.all([
      supabase
        .from('quotes')
        .select(`id, quote_number, project_description, cover_page_title, selected_tier,
          include_better, include_best, completion_certificate_enabled, use_per_tier_items,
          good_total, better_total, best_total, good_tier_name, better_tier_name, best_tier_name,
          use_manual_totals, manual_good_total, manual_better_total, manual_best_total,
          customer_id, customer:customers(id, first_name, last_name, email, address, city, state, zip)`)
        .eq('id', q.id)
        .single(),
      db.getCompany(companyId).catch(() => null) as Promise<any>,
    ]);
    if (error || !full) { toast.error('Could not load this quote.'); return null; }
    if (!company) { toast.error('Could not load your company details.'); return null; }
    return { full, company };
  };

  // As in QuoteMGR, any quote can take payments.
  const openReceipts = async (q: QuoteRow) => {
    const loaded = await loadFullQuote(q);
    if (!loaded) return;
    const { full, company } = loaded;
    if (!full.customer_id) { toast.error('Add a customer to this quote before recording a payment.'); return; }
    setReceiptCompany({
      name: company.name || '',
      default_deposit_percent: company.default_deposit_percent ?? null,
      receipt_cc_emails: company.receipt_cc_emails ?? null,
    });
    setReceiptQuote(full);
  };

  // As in QuoteMGR, a signed quote is what gets invoiced.
  const openInvoice = async (q: QuoteRow) => {
    const loaded = await loadFullQuote(q);
    if (!loaded) return;
    const { full, company } = loaded;
    if (!full.customer_id) { toast.error('Add a customer to this quote before invoicing it.'); return; }
    setInvoiceCompany({
      name: company.name || '',
      email: company.email || undefined,
      phone: company.phone || undefined,
      address: [company.address, company.city, company.state, company.zip].filter(Boolean).join(', ') || undefined,
      logo_url: company.logo_url || undefined,
    });
    setInvoiceQuote(full);
  };

  const handleSaved = () => {
    setShowBuilder(false);
    setEditingQuoteId(null);
    loadQuotes();
  };

  // Another screen asked to invoice a customer's job or take a payment on it.
  // As in QuoteMGR both start from a quote: invoices from the newest signed quote,
  // payments from the newest quote of any status.
  useEffect(() => {
    const request = state.pendingQuoteAction;
    if (!request || loading) return;
    dispatch({ type: 'SET_PENDING_QUOTE_ACTION', payload: null });
    const customerQuotes = quotes.filter((q) => (q.customer_id || q.contact_id) === request.contactId);
    const target = request.action === 'invoice'
      ? customerQuotes.find((q) => q.status === 'signed')
      : customerQuotes[0];
    if (target) {
      if (request.action === 'invoice') openInvoice(target); else openReceipts(target);
      return;
    }
    if (request.action === 'invoice' && customerQuotes.length > 0) {
      toast.info('Invoices are created from a signed quote. Get this customer\'s quote signed first.');
      return;
    }
    toast.info(request.action === 'invoice'
      ? 'Invoices are created from a signed quote. Start by building a quote for this customer.'
      : 'Payments are recorded against a quote. Start by building a quote for this customer.');
    setEditingQuoteId(null);
    setBuilderPrefill({ contactId: request.contactId });
    setShowBuilder(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingQuoteAction, loading, quotes]);

  if (previewQuoteId || showBuilder) {
    if (builderContextError) {
      return <div className="p-8 text-sm text-red-600">{builderContextError}</div>;
    }
    if (!quoteCompany || !teamMember || !companyId) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      );
    }
  }

  if (previewQuoteId && quoteCompany) {
    const currentPreviewId = previewQuoteId;
    return (
      <QuotePreview
        quoteId={currentPreviewId}
        company={quoteCompany}
        currentUser={teamMember}
        onBack={() => {
          setPreviewQuoteId(null);
          // Opened from the list: go back to it. Opened from the builder: the
          // builder is still mounted underneath and returns at the same step.
          if (previewReturnStep === null) { setShowBuilder(false); loadQuotes(); }
        }}
        onEdit={() => openEdit(currentPreviewId)}
      />
    );
  }

  if (showBuilder && quoteCompany && teamMember && companyId) {
    return (
      <QuoteBuilder
        key={`${editingQuoteId ?? `new-${builderNonce}`}-${builderInspection ? 'inspection' : 'quote'}`}
        companyId={companyId}
        userId={teamMember.id}
        currentUser={teamMember}
        company={quoteCompany}
        editQuoteId={editingQuoteId}
        prefilledCustomerId={builderPrefill?.contactId ?? null}
        initialStep={previewReturnStep ?? 0}
        inspectionOnly={builderInspection}
        onSave={(id) => setEditingQuoteId(id)}
        onSent={closeBuilder}
        onPreview={(id, step) => { setEditingQuoteId(id); setPreviewReturnStep(step); setPreviewQuoteId(id); }}
        onBack={closeBuilder}
        onOpenSettings={() => dispatch({ type: 'SET_VIEW', payload: 'settings' })}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="text-blue-600" size={26} /> Quotes
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Tiered Good / Better / Best proposals — shared with the mobile app.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openNewInspection}
            className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg font-medium transition-colors"
            title="Inspection report with contingency agreement and 3-day cancel notice"
          >
            <Shield size={18} /> New Inspection Report
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} /> New Quote
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Search by quote # or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 rounded-md font-medium ${!showArchived ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 ${showArchived ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Archive size={14} /> Archived
          </button>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">{selectedIds.size} selected</span>
            <button
              disabled={bulkBusy}
              onClick={() => setArchived(Array.from(selectedIds), !showArchived)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {showArchived ? <><ArchiveRestore size={14} /> Restore</> : <><Archive size={14} /> Archive</>}
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => deleteQuotes(Array.from(selectedIds))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 size={14} /> Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="p-1.5 text-gray-400 hover:text-gray-600" title="Clear selection">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading quotes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 mb-4">{showArchived ? 'No archived quotes' : 'No quotes yet'}</p>
          {!showArchived && (
            <button onClick={openNew} className="text-blue-600 font-medium hover:underline">
              Create your first quote
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all quotes"
                    checked={filtered.length > 0 && filtered.every((q) => selectedIds.has(q.id))}
                    onChange={(e) => setSelectedIds(e.target.checked ? new Set(filtered.map((q) => q.id)) : new Set())}
                  />
                </th>
                <th className="text-left px-4 py-3">Quote #</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Good</th>
                <th className="text-right px-4 py-3">Better</th>
                <th className="text-right px-4 py-3">Best</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => openEdit(q.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select quote ${q.quote_number}`}
                      checked={selectedIds.has(q.id)}
                      onChange={() => toggleSelected(q.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{q.quote_number}</td>
                  <td className="px-4 py-3 text-gray-700">{contactName(q.contact_id || q.customer_id)}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const st = describeQuoteStatus(q);
                      return (
                        <>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.pill}`}>{st.label}</span>
                          {st.details.map((d) => (
                            <p key={d.text} className={`mt-1 text-[11px] font-medium ${d.tone}`}>{d.text}</p>
                          ))}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{money(q.good_total)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{money(q.better_total)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{money(q.best_total)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(q.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      <button
                        onClick={(e) => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setActionMenu(actionMenu?.quote.id === q.id ? null : { quote: q, top: r.bottom + 4, right: window.innerWidth - r.right });
                        }}
                        disabled={bulkBusy || duplicatingId === q.id}
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                        title="Actions"
                        aria-haspopup="menu"
                        aria-expanded={actionMenu?.quote.id === q.id}
                      >
                        {duplicatingId === q.id ? <Loader2 size={16} className="animate-spin" /> : <MoreHorizontal size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionMenu && (() => {
        const q = actionMenu.quote;
        const close = () => setActionMenu(null);
        const item = (label: string, icon: React.ReactNode, onClick: () => void, tone = 'text-gray-700 hover:bg-gray-50') => (
          <button
            key={label}
            role="menuitem"
            onClick={() => { close(); onClick(); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left ${tone}`}
          >
            {icon}{label}
          </button>
        );
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
            <div
              role="menu"
              className="fixed z-50 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              style={{ top: Math.min(actionMenu.top, window.innerHeight - 420), right: actionMenu.right }}
              onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
            >
              {q.share_token && item('View customer page', <Eye size={15} />, () => window.open(shareUrl(q.share_token as string), '_blank', 'noopener'))}
              {item('Preview quote', <FileText size={15} />, () => openPreview(q.id))}
              {item('Copy share link', <Link2 size={15} />, () => handleCopyLink(q))}
              {item('Email to customer', <Send size={15} />, () => handleSendQuote(q))}
              {item('Payments & receipts', <DollarSign size={15} />, () => openReceipts(q))}
              {q.status === 'signed' && item('Create invoice', <FileText size={15} />, () => openInvoice(q))}
              {q.status === 'signed' && item('Create work order', <ClipboardList size={15} />, () => openWorkOrder(q))}
              <div className="my-1 border-t border-gray-100" />
              {item('Duplicate', <Copy size={15} />, () => duplicateQuote(q))}
              {item(showArchived ? 'Restore' : 'Archive', showArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />, () => setArchived([q.id], !showArchived))}
              {q.status !== 'signed' && item('Delete', <Trash2 size={15} />, () => deleteQuotes([q.id]), 'text-red-600 hover:bg-red-50')}
            </div>
          </>
        );
      })()}

      {workOrderQuote && workOrderCompany && companyId && (() => {
        const customerId = workOrderQuote.customer_id || workOrderQuote.contact_id;
        const contact = state.contacts.find((c) => c.id === customerId);
        const tier = (workOrderQuote.selected_tier || '').toLowerCase();
        return (
          <WorkOrderPanel
            quoteId={workOrderQuote.id}
            quoteNumber={workOrderQuote.quote_number}
            companyId={companyId}
            customerId={customerId || undefined}
            customerName={contact ? `${contact.firstName} ${contact.lastName}`.trim() : 'Customer'}
            customerAddress={contact ? [contact.address, contact.city, contact.state, contact.zip].filter(Boolean).join(', ') : ''}
            projectDescription={workOrderQuote.project_description || workOrderQuote.cover_page_title || ''}
            signedTier={tier === 'good' || tier === 'better' || tier === 'best' ? tier : undefined}
            company={workOrderCompany}
            onClose={() => setWorkOrderQuote(null)}
            onSaved={() => setWorkOrderQuote(null)}
          />
        );
      })()}

      {receiptQuote && receiptCompany && companyId && profile?.id && (
        <ReceiptPanel
          companyId={companyId}
          userId={profile.id}
          userRole={profile.role}
          quote={receiptQuote}
          company={receiptCompany}
          onClose={(paymentSaved?: boolean) => {
            setReceiptQuote(null);
            if (paymentSaved) loadQuotes();
          }}
        />
      )}

      {invoiceQuote && invoiceCompany && companyId && (() => {
        const iq = invoiceQuote;
        const st = iq.selected_tier;
        // Same tier choice as QuoteMGR: a multi-tier or unset selection invoices the
        // highest tier the quote offers.
        const tier: 'good' | 'better' | 'best' =
          st === 'good' || st === 'better' || st === 'best' ? st
            : iq.include_better === false && iq.include_best === false ? 'good'
            : iq.include_best === false ? 'better' : 'best';
        const tierTotal = (manual: number | null, stored: number | null) =>
          iq.use_manual_totals && manual != null ? Number(manual) : stored != null ? Number(stored) : undefined;
        const cust = iq.customer;
        return (
          <InvoiceBuilder
            quoteId={iq.id}
            quoteNumber={iq.quote_number}
            selectedTier={tier}
            includeBetter={iq.include_better !== false}
            includeBest={iq.include_best !== false}
            usePerTierItems={iq.use_per_tier_items === true}
            goodTotal={tierTotal(iq.manual_good_total, iq.good_total)}
            betterTotal={tierTotal(iq.manual_better_total, iq.better_total)}
            bestTotal={tierTotal(iq.manual_best_total, iq.best_total)}
            useManualTotal={!!iq.use_manual_totals}
            goodTierName={iq.good_tier_name || 'Good'}
            betterTierName={iq.better_tier_name || 'Better'}
            bestTierName={iq.best_tier_name || 'Best'}
            companyId={companyId}
            customerId={iq.customer_id ?? cust?.id}
            customerName={cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Customer' : 'Customer'}
            customerEmail={cust?.email || ''}
            customerAddress={cust ? [cust.address, cust.city, cust.state, cust.zip].filter(Boolean).join(', ') : ''}
            company={invoiceCompany}
            onClose={() => setInvoiceQuote(null)}
            onSaved={() => setInvoiceQuote(null)}
          />
        );
      })()}
    </div>
  );
}
