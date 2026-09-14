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

  // Another screen asked for a quote: open the builder on it, then clear the
  // request so returning to Quotes later does not reopen it.
  useEffect(() => {
    const pending = state.pendingQuote;
    if (!pending) return;
    setEditingQuoteId(pending.quoteId ?? null);
    setBuilderPrefill(pending.quoteId ? null : pending);
    setShowBuilder(true);
    dispatch({ type: 'SET_PENDING_QUOTE', payload: null });
  }, [state.pendingQuote, dispatch]);

  useEffect(() => {
    if (companyId) loadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

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

  const shareUrl = (token: string) => `${window.location.origin}/quote/${token}`;

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

  const openNew = () => { setEditingQuoteId(null); setBuilderPrefill(null); setShowBuilder(true); };
  const openEdit = (id: string) => { setEditingQuoteId(id); setBuilderPrefill(null); setShowBuilder(true); };

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

      {showBuilder && companyId && (
        <QuoteBuilderModal
          companyId={companyId}
          userId={profile?.id}
          quoteId={editingQuoteId}
          prefill={builderPrefill}
          onClose={() => setShowBuilder(false)}
          onSaved={handleSaved}
        />
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

// ── Builder modal ───────────────────────────────────────────────────────

function QuoteBuilderModal({
  companyId, userId, quoteId, prefill, onClose, onSaved,
}: {
  companyId: string;
  userId?: string;
  quoteId: string | null;
  /** New quote only: preselected customer, and optionally a title and line items. */
  prefill?: PendingQuote | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { state } = useCRM();
  // Pre-filled items skip the template picker; a customer alone still offers it.
  const [step, setStep] = useState<'template' | 'build'>(quoteId || prefill?.items?.length ? 'build' : 'template');
  const [loading, setLoading] = useState(!!quoteId);
  const [saving, setSaving] = useState(false);

  const [contactId, setContactId] = useState(prefill?.contactId ?? '');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [projectType, setProjectType] = useState('exterior');
  const [coverPageTitle, setCoverPageTitle] = useState(prefill?.title ?? '');
  const [projectDescription, setProjectDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('draft');
  const [lineItems, setLineItems] = useState<QuoteLineItemRow[]>(() => (prefill?.items ?? []).map(draftToLineItem));

  // Stage 4: contingency agreement, insurance-job linkage, financing note,
  // and a free-form custom page — the "long tail" fields mobile supports.
  const [contingencyEnabled, setContingencyEnabled] = useState(false);
  const [isInsuranceJob, setIsInsuranceJob] = useState(false);
  const [insuranceCompanyName, setInsuranceCompanyName] = useState('');
  const [claimNumber, setClaimNumber] = useState('');
  const [deductibleAmount, setDeductibleAmount] = useState('');
  const [showFinancing, setShowFinancing] = useState(false);
  const [financingNote, setFinancingNote] = useState('');
  const [availableFinancing, setAvailableFinancing] = useState<FinancingOptionRow[]>([]);
  const [selectedFinancingIds, setSelectedFinancingIds] = useState<string[]>([]);

  // The company's active programs, managed in Settings → Financing Options.
  useEffect(() => {
    supabase
      .from('financing_options')
      .select('id, lender_name, program_name, apr_low, apr_high, term_months')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setAvailableFinancing((data || []) as FinancingOptionRow[]));
  }, [companyId]);

  // QuoteMGR's builder restores these only from an unsaved draft. Load them for a
  // saved quote as well, or reopening it would quietly drop the programs offered.
  useEffect(() => {
    if (!quoteId) return;
    supabase
      .from('quote_financing')
      .select('financing_option_id')
      .eq('quote_id', quoteId)
      .order('sort_order')
      .then(({ data }) => setSelectedFinancingIds((data || []).map((r: any) => r.financing_option_id)));
  }, [quoteId]);
  const [includeCustomPage, setIncludeCustomPage] = useState(false);
  const [customPageTitle, setCustomPageTitle] = useState('');
  const [customPageBody, setCustomPageBody] = useState('');
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Load existing quote for editing
  useEffect(() => {
    if (!quoteId) return;
    (async () => {
      setLoading(true);
      try {
        const [{ data: quote, error: qErr }, { data: items, error: iErr }] = await Promise.all([
          supabase.from('quotes').select('*').eq('id', quoteId).single(),
          supabase.from('quote_line_items').select('*').eq('quote_id', quoteId).order('sort_order'),
        ]);
        if (qErr) throw qErr;
        if (iErr) throw iErr;
        setContactId(quote.contact_id || quote.customer_id || '');
        setQuoteNumber(quote.quote_number || '');
        setProjectType(quote.project_type || 'exterior');
        setCoverPageTitle(quote.cover_page_title || '');
        setProjectDescription(quote.project_description || '');
        setNotes(quote.notes || '');
        setStatus(quote.status || 'draft');
        setContingencyEnabled(!!quote.contingency_enabled);
        setIsInsuranceJob(!!(quote.insurance_company_name || quote.claim_number || quote.deductible_amount));
        setInsuranceCompanyName(quote.insurance_company_name || '');
        setClaimNumber(quote.claim_number || '');
        setDeductibleAmount(quote.deductible_amount != null ? String(quote.deductible_amount) : '');
        setShowFinancing(!!quote.show_financing);
        setFinancingNote(quote.financing_note || '');
        setIncludeCustomPage(!!quote.include_custom_page);
        setCustomPageTitle(quote.custom_page_title || '');
        setCustomPageBody(quote.custom_page_body || '');
        setLineItems(
          (items || []).map((i: any) => ({
            id: i.id,
            category: i.category || 'Roofing',
            item_name: i.item_name,
            description: i.description || '',
            unit: i.unit || 'each',
            quantity: Number(i.quantity) || 0,
            good_price: Number(i.good_price) || 0,
            better_price: Number(i.better_price) || 0,
            best_price: Number(i.best_price) || 0,
            fixed_price: !!i.fixed_price,
          }))
        );
      } catch (err: any) {
        toast.error('Failed to load quote: ' + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [quoteId]);

  // Generate the next quote number the same way mobile does: QT-{year}-{count+1}
  useEffect(() => {
    if (quoteId) return;
    (async () => {
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
      setQuoteNumber(`QT-${year}-${String((count || 0) + 1).padStart(3, '0')}`);
    })();
  }, [companyId, quoteId]);

  const applyTemplate = (templateId: string) => {
    if (templateId === 'blank') {
      setStep('build');
      return;
    }
    const template = quoteProjectTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setCoverPageTitle(template.coverPageTitle);
    setProjectDescription(template.projectDescription);
    setProjectType(template.projectType === 'both' ? 'exterior' : template.projectType);
    setLineItems(
      template.lineItems.map((li: TemplateLineItem) => ({
        category: li.category,
        item_name: li.item_name,
        description: li.description,
        unit: li.unit,
        quantity: li.quantity,
        good_price: li.good_price,
        better_price: li.better_price,
        best_price: li.best_price,
        fixed_price: li.fixed_price || false,
      }))
    );
    setStep('build');
  };

  const totals = useMemo(
    () =>
      lineItems.reduce(
        (acc, item) => ({
          good: acc.good + (item.quantity || 0) * (item.good_price || 0),
          better: acc.better + (item.quantity || 0) * (item.better_price || 0),
          best: acc.best + (item.quantity || 0) * (item.best_price || 0),
        }),
        { good: 0, better: 0, best: 0 }
      ),
    [lineItems]
  );

  const updateLineItem = (index: number, patch: Partial<QuoteLineItemRow>) => {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  };
  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };
  const addLineItem = () => setLineItems((prev) => [...prev, emptyLineItem()]);

  const handleSave = async () => {
    if (!contactId) {
      toast.error('Please select a customer');
      return;
    }
    setSaving(true);
    try {
      const contact = state.contacts.find((c) => c.id === contactId);
      const basePayload = {
        company_id: companyId,
        created_by: userId,
        contact_id: contactId,
        customer_id: contactId,
        quote_number: quoteNumber,
        status,
        project_type: projectType,
        project_description: projectDescription,
        cover_page_title: coverPageTitle || `${projectType} Project Proposal`,
        notes,
        good_total: totals.good,
        better_total: totals.better,
        best_total: totals.best,
        quote_structure_type: 'tiered',
        show_good_tier: true,
        show_better_tier: true,
        show_best_tier: true,
        include_better: true,
        include_best: true,
        good_tier_name: 'Good',
        better_tier_name: 'Better',
        best_tier_name: 'Best',
        show_line_item_prices: true,
        show_section_totals: true,
        show_quantity: true,
        show_item_descriptions: true,
        contingency_enabled: contingencyEnabled,
        insurance_company_name: isInsuranceJob ? (insuranceCompanyName.trim() || null) : null,
        claim_number: isInsuranceJob ? (claimNumber.trim() || null) : null,
        deductible_amount: isInsuranceJob && deductibleAmount ? parseFloat(deductibleAmount) : null,
        deductible_included: isInsuranceJob,
        show_financing: showFinancing,
        financing_note: showFinancing ? (financingNote.trim() || null) : null,
        include_custom_page: includeCustomPage,
        custom_page_title: includeCustomPage ? (customPageTitle.trim() || null) : null,
        custom_page_body: includeCustomPage ? (customPageBody.trim() || null) : null,
      };

      let savedId = quoteId;
      if (quoteId) {
        const { error } = await supabase.from('quotes').update(basePayload).eq('id', quoteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('quotes')
          .insert({
            ...basePayload,
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            share_token: generateShareToken(),
          })
          .select()
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      if (savedId) {
        // Insert-before-delete: capture the old row ids first, write the new
        // set, then delete only those captured ids. A failed insert can never
        // leave the quote with zero items (same pattern as mobile).
        const { data: oldRows } = quoteId
          ? await supabase.from('quote_line_items').select('id').eq('quote_id', savedId)
          : { data: [] as { id: string }[] };
        const oldIds = (oldRows || []).map((r) => r.id);

        if (lineItems.length > 0) {
          const toInsert = lineItems.map((item, index) => ({
            quote_id: savedId,
            category: item.category,
            item_name: item.item_name,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            good_price: item.good_price,
            better_price: item.better_price,
            best_price: item.best_price,
            sort_order: index,
            fixed_price: item.fixed_price,
          }));
          const { error: insErr } = await supabase.from('quote_line_items').insert(toInsert);
          if (insErr) throw insErr;
        }
        if (oldIds.length > 0) {
          await supabase.from('quote_line_items').delete().in('id', oldIds);
        }

        // Same replace-all as QuoteMGR: the quote offers whichever programs are ticked now.
        if (availableFinancing.length > 0) {
          await supabase.from('quote_financing').delete().eq('quote_id', savedId);
          if (selectedFinancingIds.length > 0) {
            const { error: finErr } = await supabase.from('quote_financing').insert(
              selectedFinancingIds.map((financing_option_id, sort_order) => ({ quote_id: savedId, financing_option_id, sort_order })),
            );
            // The quote and its line items are already saved; say so rather than reporting a failed save.
            if (finErr) toast.error('Quote saved, but its financing programs could not be saved: ' + finErr.message);
          }
        }
      }

      toast.success(quoteId ? 'Quote updated' : 'Quote created');
      onSaved();
    } catch (err: any) {
      toast.error('Failed to save quote: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {quoteId ? `Edit ${quoteNumber}` : step === 'template' ? 'New Quote — Choose a Template' : 'New Quote'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        {loading ? (
          <div className="p-16 text-center text-gray-400">Loading...</div>
        ) : step === 'template' ? (
          <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {quoteProjectTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.id)}
                  className="text-left p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="text-blue-600 mb-2">{ICON_MAP[t.icon] || <FileText size={28} />}</div>
                  <div className="font-medium text-gray-900 text-sm mb-1">{t.name}</div>
                  <div className="text-xs text-gray-500 line-clamp-2">{t.description}</div>
                </button>
              ))}
              <button
                onClick={() => applyTemplate('blank')}
                className="text-left p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 flex flex-col items-center justify-center text-gray-500 hover:text-blue-600 transition-colors"
              >
                <Plus size={28} className="mb-2" />
                <span className="text-sm font-medium">Start Blank</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User size={14} className="inline mr-1" /> Customer *
                </label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  <option value="">Select a customer...</option>
                  {state.contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quote #</label>
                <input
                  type="text"
                  value={quoteNumber}
                  onChange={(e) => setQuoteNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cover Title</label>
              <input
                type="text"
                value={coverPageTitle}
                onChange={(e) => setCoverPageTitle(e.target.value)}
                placeholder="e.g. Roof Replacement Proposal"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Line Items</label>
                <button
                  onClick={addLineItem}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <Plus size={14} /> Add Item
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs min-w-[720px]">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-2 py-2 w-32">Category</th>
                      <th className="text-left px-2 py-2">Item</th>
                      <th className="text-left px-2 py-2 w-16">Unit</th>
                      <th className="text-right px-2 py-2 w-14">Qty</th>
                      <th className="text-right px-2 py-2 w-20">Good</th>
                      <th className="text-right px-2 py-2 w-20">Better</th>
                      <th className="text-right px-2 py-2 w-20">Best</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((item, i) => (
                      <tr key={i}>
                        <td className="px-1 py-1">
                          <input value={item.category} onChange={(e) => updateLineItem(i, { category: e.target.value })}
                            className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs" />
                        </td>
                        <td className="px-1 py-1">
                          <input value={item.item_name} onChange={(e) => updateLineItem(i, { item_name: e.target.value })}
                            placeholder="Item name" className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs" />
                        </td>
                        <td className="px-1 py-1">
                          <input value={item.unit} onChange={(e) => updateLineItem(i, { unit: e.target.value })}
                            className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" value={item.quantity} onChange={(e) => updateLineItem(i, { quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs text-right" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" value={item.good_price} onChange={(e) => updateLineItem(i, { good_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs text-right" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" value={item.better_price} onChange={(e) => updateLineItem(i, { better_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs text-right" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" value={item.best_price} onChange={(e) => updateLineItem(i, { best_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs text-right" />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button onClick={() => removeLineItem(i)} className="text-gray-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {lineItems.length === 0 && (
                      <tr><td colSpan={8} className="text-center py-6 text-gray-400">No line items yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
              />
            </div>

            <div className="border border-gray-200 rounded-lg">
              <button
                type="button"
                onClick={() => setShowMoreOptions((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                <span>More options — contingency, insurance, financing, custom page</span>
                <ChevronDown size={16} className={`transition-transform ${showMoreOptions ? 'rotate-180' : ''}`} />
              </button>
              {showMoreOptions && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                  <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={contingencyEnabled}
                      onChange={(e) => setContingencyEnabled(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Include a contingency agreement — the customer's signature also accepts this
                      agreement (used for insurance jobs; separate from the standard 3-day right-to-cancel notice).
                    </span>
                  </label>

                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                      <input type="checkbox" checked={isInsuranceJob} onChange={(e) => setIsInsuranceJob(e.target.checked)} />
                      This is an insurance claim
                    </label>
                    {isInsuranceJob && (
                      <div className="grid grid-cols-2 gap-3 pl-6">
                        <input
                          value={insuranceCompanyName}
                          onChange={(e) => setInsuranceCompanyName(e.target.value)}
                          placeholder="Insurance company"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                        <input
                          value={claimNumber}
                          onChange={(e) => setClaimNumber(e.target.value)}
                          placeholder="Claim #"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                        <input
                          type="number"
                          value={deductibleAmount}
                          onChange={(e) => setDeductibleAmount(e.target.value)}
                          placeholder="Deductible $"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none col-span-2"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                      <input type="checkbox" checked={showFinancing} onChange={(e) => setShowFinancing(e.target.checked)} />
                      Offer financing to this customer
                    </label>
                    {showFinancing && (
                      <div className="pl-6 space-y-2">
                        {availableFinancing.length > 0 ? (
                          <>
                            <p className="text-xs text-gray-500">Programs to offer on this quote:</p>
                            {availableFinancing.map((opt) => (
                              <label key={opt.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-blue-300">
                                <input
                                  type="checkbox"
                                  checked={selectedFinancingIds.includes(opt.id)}
                                  onChange={(e) =>
                                    setSelectedFinancingIds((prev) =>
                                      e.target.checked ? [...prev, opt.id] : prev.filter((id) => id !== opt.id),
                                    )
                                  }
                                />
                                <span className="text-sm font-medium text-gray-900">{opt.lender_name}</span>
                                {opt.program_name && <span className="text-xs text-gray-500">{opt.program_name}</span>}
                                {opt.apr_low !== null && (
                                  <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                                    {opt.apr_high !== null && opt.apr_high !== opt.apr_low ? `${opt.apr_low}–${opt.apr_high}% APR` : `${opt.apr_low}% APR`}
                                    {opt.term_months ? ` · ${opt.term_months} mo` : ''}
                                  </span>
                                )}
                              </label>
                            ))}
                          </>
                        ) : (
                          <p className="text-xs text-gray-500">No financing programs yet. Add them in Settings → Financing Options.</p>
                        )}
                        <textarea
                          value={financingNote}
                          onChange={(e) => setFinancingNote(e.target.value)}
                          rows={2}
                          placeholder="Optional note, e.g. As low as $199/mo with approved credit"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                      <input type="checkbox" checked={includeCustomPage} onChange={(e) => setIncludeCustomPage(e.target.checked)} />
                      Include a custom page
                    </label>
                    {includeCustomPage && (
                      <div className="pl-6 space-y-2">
                        <input
                          value={customPageTitle}
                          onChange={(e) => setCustomPageTitle(e.target.value)}
                          placeholder="Page title"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                        <textarea
                          value={customPageBody}
                          onChange={(e) => setCustomPageBody(e.target.value)}
                          rows={3}
                          placeholder="Page content"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'build' && !loading && (
          <div className="border-t border-gray-100 p-5 flex items-center justify-between bg-gray-50 rounded-b-xl">
            <div className="flex gap-6 text-sm">
              <div><span className="text-gray-500">Good</span> <span className="font-semibold text-gray-900">{money(totals.good)}</span></div>
              <div><span className="text-gray-500">Better</span> <span className="font-semibold text-gray-900">{money(totals.better)}</span></div>
              <div><span className="text-gray-500">Best</span> <span className="font-semibold text-gray-900">{money(totals.best)}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !contactId}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
