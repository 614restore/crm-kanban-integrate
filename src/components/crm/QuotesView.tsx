import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/lib/crmStore';
import type { PendingQuote, QuoteDraftItem } from '@/lib/crmStore';
import { toQuoteSummary } from '@/lib/crmData';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/emailApi';
import { toast } from 'sonner';
import WorkOrderPanel from './WorkOrderPanel';
import ReceiptPanel from './ReceiptPanel';
import InvoiceBuilder from './InvoiceBuilder';
import QuoteBuilder from '@/components/QuoteBuilder';
import QuotePreview from '@/components/QuotePreview';
import type { Company, TeamMember } from '@/data/quoteData';
import { quoteUrl } from '@/lib/appUrl';
import { quoteProjectTemplates, TemplateLineItem } from '@/data/quoteTemplates';
import {
  FileText, Plus, Search, Trash2, X, Save, User, Send, Link2, Eye, ChevronDown,
  Home, Wrench, Hammer, Sun, Droplets, Layers, Grid3x3,
  Scroll, Tablet, PackageOpen, Box, ClipboardList, DollarSign,
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

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  signed: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};

export default function QuotesView() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

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
        .select('id, quote_number, status, contact_id, customer_id, project_type, good_total, better_total, best_total, selected_tier, created_at, share_token, cover_page_title, project_description')
        .eq('company_id', companyId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuotes((data || []) as QuoteRow[]);
      // Keep the dashboard and pipeline values in step with what was just loaded.
      dispatch({ type: 'SET_QUOTES', payload: (data || []).map(toQuoteSummary) });
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

  const handleSendQuote = async (q: QuoteRow) => {
    if (!q.share_token) { toast.error('This quote has no share link yet.'); return; }
    const contact = state.contacts.find((c) => c.id === (q.contact_id || q.customer_id));
    if (!contact?.email) { toast.error('This customer has no email on file.'); return; }
    if (!companyId) return;
    try {
      const companyProfile = await db.getCompany(companyId).catch(() => null);
      const companyName = (companyProfile as any)?.name || 'Your Company';
      const companyPhone = (companyProfile as any)?.phone || '';
      const companyAddress = (companyProfile as any)?.address || '';
      const url = shareUrl(q.share_token);

      await sendEmail({
        to: contact.email,
        subject: `${q.cover_page_title || 'Your Proposal'} — ${companyName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1e40af;color:white;padding:24px;border-radius:8px 8px 0 0">
              <h2 style="margin:0;font-size:24px">${companyName}</h2>
              ${companyAddress ? `<p style="margin:4px 0 0 0;opacity:0.9;font-size:13px">${companyAddress}</p>` : ''}
              ${companyPhone ? `<p style="margin:2px 0 0 0;opacity:0.9;font-size:13px">${companyPhone}</p>` : ''}
            </div>
            <div style="padding:24px;background:#f9fafb">
              <h3 style="color:#1e40af;margin-top:0">${q.cover_page_title || 'Your Proposal'}</h3>
              <p>Hi ${contact.firstName},</p>
              <p>Your quote <strong>${q.quote_number}</strong> is ready to view. Please click below to review the details and sign.</p>
              <div style="text-align:center;margin:28px 0">
                <a href="${url}" style="background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                  View & Sign Quote
                </a>
              </div>
              <p style="font-size:12px;color:#6b7280">Or copy this link: ${url}</p>
            </div>
          </div>
        `,
      });

      const { error } = await supabase
        .from('quotes')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', q.id);
      if (error) throw error;

      toast.success('Quote sent to ' + contact.email);
      loadQuotes();
    } catch (err: any) {
      toast.error('Failed to send quote: ' + (err.message || 'unknown error'));
    }
  };

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
    setBuilderNonce((n) => n + 1); setShowBuilder(true);
  };
  const openEdit = (id: string) => {
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
          include_better, include_best, completion_certificate_enabled,
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
        key={editingQuoteId ?? `new-${builderNonce}`}
        companyId={companyId}
        userId={teamMember.id}
        currentUser={teamMember}
        company={quoteCompany}
        editQuoteId={editingQuoteId}
        prefilledCustomerId={builderPrefill?.contactId ?? null}
        initialStep={previewReturnStep ?? 0}
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
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} /> New Quote
        </button>
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

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading quotes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 mb-4">No quotes yet</p>
          <button onClick={openNew} className="text-blue-600 font-medium hover:underline">
            Create your first quote
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
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
                  <td className="px-4 py-3 font-medium text-gray-900">{q.quote_number}</td>
                  <td className="px-4 py-3 text-gray-700">{contactName(q.contact_id || q.customer_id)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-700'}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{money(q.good_total)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{money(q.better_total)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{money(q.best_total)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(q.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {q.share_token && (
                        <a
                          href={shareUrl(q.share_token)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View customer page"
                        >
                          <Eye size={15} />
                        </a>
                      )}
                      <button
                        onClick={() => openPreview(q.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Preview quote"
                      >
                        <FileText size={15} />
                      </button>
                      <button
                        onClick={() => handleCopyLink(q)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Copy share link"
                      >
                        <Link2 size={15} />
                      </button>
                      <button
                        onClick={() => handleSendQuote(q)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Email quote to customer"
                      >
                        <Send size={15} />
                      </button>
                      <button
                        onClick={() => openReceipts(q)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                        title="Payments & receipts"
                      >
                        <DollarSign size={15} />
                      </button>
                      {q.status === 'signed' && (
                        <button
                          onClick={() => openInvoice(q)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Create invoice"
                        >
                          <FileText size={15} />
                        </button>
                      )}
                      {q.status === 'signed' && (
                        <button
                          onClick={() => openWorkOrder(q)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Create work order"
                        >
                          <ClipboardList size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
